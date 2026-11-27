//! The adb commands the Android target needs, all on one device: starting Firefox there,
//! forwarding its debugger socket, and writing files into a folder Firefox can read.

use std::ffi::OsStr;
use std::path::PathBuf;

use super::{AndroidError, Result};
use crate::process::Invocation;

/// The state `adb devices` lists a usable device in.
const READY_STATE: &str = "device";
/// Firefox for Android's debugger listens on this abstract socket, named after the app.
const DEBUGGER_SOCKET_NAME: &str = "firefox-debugger-socket";
const VIEW_ACTION: &str = "android.intent.action.VIEW";

/// adb bound to one device.
#[derive(Debug, Clone)]
pub(crate) struct Adb {
    binary: PathBuf,
    serial: String,
}

/// The serials `adb devices` lists as ready.
fn parse_ready_devices(listing: &str) -> Vec<String> {
    listing
        .lines()
        .filter_map(|line| line.split_once('\t'))
        .filter(|(_, state)| state.trim() == READY_STATE)
        .map(|(serial, _)| serial.trim().to_owned())
        .collect()
}

/// The requested device when it is connected, else the only one connected.
fn pick_device(ready: Vec<String>, requested: Option<&str>) -> Result<String> {
    if let Some(serial) = requested {
        return ready
            .into_iter()
            .find(|candidate| candidate == serial)
            .ok_or_else(|| AndroidError::Device(format!("no device {serial} is connected")));
    }
    match <[String; 1]>::try_from(ready) {
        Ok([serial]) => Ok(serial),
        Err(ready) if ready.is_empty() => Err(AndroidError::Device(
            "no Android device or emulator is connected".to_owned(),
        )),
        Err(ready) => Err(AndroidError::Device(format!(
            "several devices are connected ({}); pass --android-serial",
            ready.join(", ")
        ))),
    }
}

/// A path quoted for the device's shell.
fn quoted(path: &str) -> String {
    format!("'{}'", path.replace('\'', r"'\''"))
}

impl Adb {
    /// The device `requested` names, or the only one connected.
    pub(crate) async fn connect(binary: PathBuf, requested: Option<&str>) -> Result<Self> {
        let listing = Invocation::new(&binary)
            .args(["devices"])
            .capture_checked()
            .await?;
        let serial = pick_device(parse_ready_devices(&listing), requested)?;
        Ok(Self { binary, serial })
    }

    pub(crate) fn serial(&self) -> &str {
        &self.serial
    }

    fn invocation<I, S>(&self, args: I) -> Invocation
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        Invocation::new(&self.binary)
            .args(["-s", self.serial.as_str()])
            .args(args)
    }

    async fn shell(&self, command: &str) -> Result<String> {
        Ok(self
            .invocation(["shell", command])
            .capture_checked()
            .await?)
    }

    /// Opens `url` in the app, starting it when it isn't running.
    pub(crate) async fn open_url(&self, package: &str, url: &str) -> Result<()> {
        let command = format!(
            "am start -a {VIEW_ACTION} -d {} -p {}",
            quoted(url),
            quoted(package)
        );
        self.shell(&command).await?;
        Ok(())
    }

    /// Whether the app has a running process.
    pub(crate) async fn is_running(&self, package: &str) -> bool {
        let pid = self
            .invocation(["shell", "pidof", package])
            .capture()
            .await
            .map_or_default(|captured| captured.stdout);
        !pid.is_empty()
    }

    /// A free local port forwarded to the app's debugger socket.
    pub(crate) async fn forward_debugger(&self, package: &str) -> Result<u16> {
        let remote = format!("localabstract:{package}/{DEBUGGER_SOCKET_NAME}");
        let port = self
            .invocation(["forward", "tcp:0", remote.as_str()])
            .capture_checked()
            .await?;
        port.trim().parse().map_err(|_| {
            AndroidError::Device(format!("adb forwarded to an unreadable port {port}"))
        })
    }

    pub(crate) async fn remove_forward(&self, port: u16) {
        let local = format!("tcp:{port}");
        self.invocation(["forward", "--remove", local.as_str()])
            .capture()
            .await
            .ok();
    }

    /// Unpacks a tar archive into `folder` on the device, creating it first. The archive travels
    /// as a file: adb forwards a large stdin unreliably, so piping it would cut it short.
    pub(crate) async fn extract(&self, folder: &str, archive: &[u8]) -> Result<()> {
        let local = std::env::temp_dir().join(format!(
            "devtool-android-{}-{}.tar",
            std::process::id(),
            self.serial
                .replace(|character: char| !character.is_ascii_alphanumeric(), "-")
        ));
        tokio::fs::write(&local, archive).await?;
        let device_archive = format!("{folder}.tar");
        let pushed = self
            .invocation([
                OsStr::new("push"),
                local.as_os_str(),
                OsStr::new(&device_archive),
            ])
            .capture_checked()
            .await;
        tokio::fs::remove_file(&local).await.ok();
        pushed?;
        let command = format!(
            "mkdir -p {folder} && tar -xf {archive} -C {folder} && rm -f {archive}",
            folder = quoted(folder),
            archive = quoted(&device_archive)
        );
        self.shell(&command).await?;
        Ok(())
    }

    /// Deletes `folder` and everything in it.
    pub(crate) async fn remove_folder(&self, folder: &str) -> Result<()> {
        self.shell(&format!("rm -rf {}", quoted(folder))).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LISTING: &str = "List of devices attached\nemulator-5554\tdevice\nR5CT\tunauthorized\n\n";

    #[test]
    fn only_ready_devices_are_listed() {
        assert_eq!(parse_ready_devices(LISTING), ["emulator-5554"]);
    }

    #[test]
    fn the_only_device_is_picked_and_a_choice_is_required_among_several() {
        let one = vec!["a".to_owned()];
        assert_eq!(pick_device(one.clone(), None).unwrap(), "a");
        assert!(pick_device(one, Some("b")).is_err());
        assert!(pick_device(Vec::new(), None).is_err());
        let two = vec!["a".to_owned(), "b".to_owned()];
        assert!(pick_device(two.clone(), None).is_err());
        assert_eq!(pick_device(two, Some("b")).unwrap(), "b");
    }

    #[test]
    fn shell_paths_are_single_quoted() {
        assert_eq!(quoted("/a b/it's"), r"'/a b/it'\''s'");
    }
}
