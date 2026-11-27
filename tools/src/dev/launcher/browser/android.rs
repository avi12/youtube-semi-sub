//! Firefox for Android on a device or emulator, over adb: opened on the start URL, its debugger
//! socket forwarded to a local port, and the extension installed as a temporary add-on from a
//! device folder the session keeps in step with the build output. From there it is the same RDP
//! target as desktop Firefox. The app is the user's: the session never stops it.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use dev_hot::driver::rdp::message::Addon;
use tokio::time::sleep;

use super::{BrowserLaunch, FirefoxIdentity};
use crate::android::{Adb, DeviceMirror};
use crate::dev::launcher::error::{LauncherError, Result};
use crate::dev::launcher::process::find_on_path;
use crate::firefox::rdp::client::Rdp;
use crate::output::manifest::ExtensionManifest;
use crate::output::options::{AndroidOptions, HostEnvironment, OsPlatform};

const SDK_ROOT_VARIABLES: [&str; 2] = ["ANDROID_HOME", "ANDROID_SDK_ROOT"];
const PLATFORM_TOOLS_DIR: &str = "platform-tools";
const RDP_CONNECT_ATTEMPTS: u32 = 30;
const RDP_RETRY_DELAY: Duration = Duration::from_millis(500);
const RDP_REPLY_TIMEOUT: Duration = Duration::from_secs(10);
/// How often the session checks that Firefox still runs on the device.
const APP_POLL_INTERVAL: Duration = Duration::from_secs(3);
const MOZ_EXTENSION_PREFIX: &str = "moz-extension://";

fn adb_name(platform: OsPlatform) -> &'static str {
    match platform {
        OsPlatform::Windows => "adb.exe",
        OsPlatform::MacOs | OsPlatform::Linux => "adb",
    }
}

/// Where Android Studio puts the SDK unless told otherwise.
fn default_sdk_root(host: &HostEnvironment) -> PathBuf {
    match host.platform {
        OsPlatform::Windows => host.local_app_data.join("Android").join("Sdk"),
        OsPlatform::MacOs => host.home.join("Library").join("Android").join("sdk"),
        OsPlatform::Linux => host.home.join("Android").join("Sdk"),
    }
}

/// adb on `PATH`, else in the SDK the environment names, else in Android Studio's default SDK.
fn find_adb(host: &HostEnvironment) -> Result<PathBuf> {
    let name = adb_name(host.platform);
    let sdk_roots = SDK_ROOT_VARIABLES
        .iter()
        .filter_map(std::env::var_os)
        .map(PathBuf::from)
        .chain([default_sdk_root(host)]);
    find_on_path(name)
        .or_else(|| {
            sdk_roots
                .map(|root| root.join(PLATFORM_TOOLS_DIR).join(name))
                .find(|candidate| candidate.is_file())
        })
        .ok_or_else(|| {
            LauncherError::Browser(
                "could not find adb: put it on PATH or set ANDROID_HOME".to_owned(),
            )
        })
}

/// Firefox answers on its debugger socket only while "Remote debugging via USB" is on.
async fn connect_debugger(port: u16) -> Result<Rdp> {
    for _ in 0..RDP_CONNECT_ATTEMPTS {
        if let Ok(rdp) = Rdp::connect(port, RDP_REPLY_TIMEOUT).await {
            return Ok(rdp);
        }
        sleep(RDP_RETRY_DELAY).await;
    }
    Err(LauncherError::Browser(
        "Firefox on the device does not answer: turn on Settings > Remote debugging via USB"
            .to_owned(),
    ))
}

/// The per-install `moz-extension://` host, read off the add-on's manifest URL.
fn extension_uuid(addon: &Addon) -> Option<String> {
    let host = addon
        .manifest_url
        .as_deref()?
        .strip_prefix(MOZ_EXTENSION_PREFIX)?
        .split('/')
        .next()?;
    Some(host.to_owned()).filter(|uuid| !uuid.is_empty())
}

/// The device side of a running session.
pub(crate) struct DeviceSession {
    mirror: Arc<DeviceMirror>,
    package: String,
    rdp_port: u16,
}

impl DeviceSession {
    pub(super) fn mirror(&self) -> Arc<DeviceMirror> {
        Arc::clone(&self.mirror)
    }

    pub(super) fn serial(&self) -> &str {
        self.mirror.adb().serial()
    }

    pub(super) fn device_dir(&self) -> &str {
        self.mirror.device_dir()
    }

    /// Resolves once Firefox no longer runs on the device (or the device is gone).
    pub(super) async fn wait_closed(&self) {
        while self.mirror.adb().is_running(&self.package).await {
            sleep(APP_POLL_INTERVAL).await;
        }
    }

    /// Drops the port forward; Firefox keeps running.
    pub(super) async fn release(&self) {
        self.mirror.adb().remove_forward(self.rdp_port).await;
    }
}

/// Opens Firefox on the device and installs the extension from a device folder.
pub(super) async fn launch(
    launch: BrowserLaunch<'_>,
    android: &AndroidOptions,
) -> Result<(DeviceSession, FirefoxIdentity)> {
    let BrowserLaunch {
        options,
        host,
        output_dir,
    } = launch;
    let adb = Adb::connect(find_adb(host)?, android.serial.as_deref()).await?;
    adb.open_url(&android.package, &options.start_url).await?;
    let rdp_port = adb.forward_debugger(&android.package).await?;
    let mut rdp = connect_debugger(rdp_port).await?;
    let extension_id = ExtensionManifest::read(output_dir)?.gecko_id();
    let mirror = DeviceMirror::create(adb, output_dir.to_owned(), &extension_id).await?;
    let addon = rdp
        .install_temporary_addon(mirror.device_dir())
        .await
        .map_err(|error| LauncherError::Browser(error.to_string()))?;
    let uuid = extension_uuid(&addon).ok_or_else(|| {
        LauncherError::Browser("the installed add-on names no moz-extension host".to_owned())
    })?;
    let session = DeviceSession {
        mirror: Arc::new(mirror),
        package: android.package.clone(),
        rdp_port,
    };
    let identity = FirefoxIdentity {
        rdp_port,
        extension_id,
        uuid,
    };
    Ok((session, identity))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_uuid_is_the_manifest_url_host() {
        let addon = Addon {
            manifest_url: Some("moz-extension://42d2f6ba-b2ea/manifest.json".to_owned()),
            ..Addon::default()
        };
        assert_eq!(extension_uuid(&addon).as_deref(), Some("42d2f6ba-b2ea"));
        assert_eq!(extension_uuid(&Addon::default()), None);
    }

    #[test]
    fn the_sdk_default_follows_the_platform() {
        let host = HostEnvironment {
            platform: OsPlatform::Windows,
            is_wsl: false,
            home: PathBuf::from("/home"),
            local_app_data: PathBuf::from("/local"),
            app_data: PathBuf::new(),
            lang: "en".to_owned(),
        };
        assert_eq!(default_sdk_root(&host), PathBuf::from("/local/Android/Sdk"));
    }
}
