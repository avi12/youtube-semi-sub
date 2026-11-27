//! Launching the dev browser without web-ext-run: Chrome for Testing with `--load-extension`, or
//! Firefox with a debugger server and a temporary add-on, on this machine or an Android device.

mod android;
mod cft;
mod chrome;
mod firefox;
mod marionette;

use std::path::Path;
use std::sync::Arc;

use dev_hot::types::Port;
use tokio::process::Child;

use self::android::DeviceSession;
use crate::android::DeviceMirror;

use super::error::Result;
use crate::dev::browsers::{ChromeTarget, FirefoxTarget, FirefoxTargetConfig, ReloadTarget};
use crate::output::manifest::ExtensionManifest;
use crate::output::options::{BuildBrowser, DevOptions, HostEnvironment};

/// What launching needs to know.
#[derive(Debug, Clone, Copy)]
pub(super) struct BrowserLaunch<'a> {
    pub(super) options: &'a DevOptions,
    pub(super) host: &'a HostEnvironment,
    pub(super) output_dir: &'a Path,
}

/// The ids Firefox is reached by once it runs.
#[derive(Debug, Clone)]
pub(super) struct FirefoxIdentity {
    pub(super) rdp_port: u16,
    pub(super) extension_id: String,
    pub(super) uuid: String,
}

/// Where the dev browser runs.
pub(super) enum BrowserProcess {
    /// A process this launcher started on this machine.
    Local(Box<Child>),
    /// Firefox on an Android device, which the user owns.
    Device(DeviceSession),
}

/// A running dev browser: where it runs, and how to reach it.
pub(super) struct RunningBrowser {
    pub(super) process: BrowserProcess,
    pub(super) firefox: Option<FirefoxIdentity>,
}

impl RunningBrowser {
    /// The device folder kept in step with the build output, for a browser on a device.
    pub(super) fn device_mirror(&self) -> Option<Arc<DeviceMirror>> {
        match &self.process {
            BrowserProcess::Local(_) => None,
            BrowserProcess::Device(session) => Some(session.mirror()),
        }
    }

    /// Where the extension was loaded, for the launch line.
    pub(super) fn describe_location(&self, options: &DevOptions) -> String {
        let relative = |path: &Path| {
            path.strip_prefix(&options.project_root)
                .unwrap_or(path)
                .display()
                .to_string()
        };
        match &self.process {
            BrowserProcess::Local(_) => format!(
                "debug port {}, profile {}",
                self.debug_port(options),
                relative(&options.profile_dir)
            ),
            BrowserProcess::Device(session) => format!(
                "device {}, debug port {}, folder {}",
                session.serial(),
                self.debug_port(options),
                session.device_dir()
            ),
        }
    }

    /// Resolves once the browser is gone.
    pub(super) async fn wait_closed(&mut self) {
        match &mut self.process {
            BrowserProcess::Local(child) => {
                let _ = child.wait().await;
            }
            BrowserProcess::Device(session) => session.wait_closed().await,
        }
    }

    /// Stops what this launcher started: its own browser process, or only the device's port
    /// forward - Firefox on the device keeps running.
    pub(super) async fn stop(&mut self) {
        match &mut self.process {
            BrowserProcess::Local(child) => {
                let _ = child.kill().await;
            }
            BrowserProcess::Device(session) => session.release().await,
        }
    }

    /// The port the hot loop talks to: CDP for Chrome, RDP for Firefox.
    pub(super) fn debug_port(&self, options: &DevOptions) -> u16 {
        self.firefox
            .as_ref()
            .map_or(options.cdp_port, |identity| identity.rdp_port)
    }

    /// The reload target of this browser.
    pub(super) fn reload_target(
        &self,
        options: &DevOptions,
        output_dir: &Path,
    ) -> Result<Arc<dyn ReloadTarget>> {
        let Some(identity) = &self.firefox else {
            let chrome = ChromeTarget::new(Port::new(options.cdp_port)?);
            // An idle service worker leaves no target to read the id from, so it is looked up by name
            let name = ExtensionManifest::read(output_dir)?
                .name()
                .map(str::to_owned);
            return Ok(Arc::new(match name {
                Some(name) => chrome.with_extension_name(name),
                None => chrome,
            }));
        };
        Ok(Arc::new(FirefoxTarget::new(FirefoxTargetConfig {
            rdp_port: Port::new(identity.rdp_port)?,
            marionette_port: Port::new(options.marionette_port)?,
            extension_id: identity.extension_id.clone(),
            uuid: identity.uuid.clone(),
        })))
    }
}

/// Starts the browser the options name, with the extension from the output directory loaded.
pub(super) async fn launch(launch: BrowserLaunch<'_>) -> Result<RunningBrowser> {
    match launch.options.browser() {
        BuildBrowser::Chrome => Ok(RunningBrowser {
            process: BrowserProcess::Local(Box::new(chrome::launch(launch).await?)),
            firefox: None,
        }),
        BuildBrowser::Firefox => {
            let (process, identity) = if let Some(android) = &launch.options.android {
                let (session, identity) = android::launch(launch, android).await?;
                (BrowserProcess::Device(session), identity)
            } else {
                let (child, identity) = firefox::launch(launch).await?;
                (BrowserProcess::Local(Box::new(child)), identity)
            };
            Ok(RunningBrowser {
                process,
                firefox: Some(identity),
            })
        }
    }
}
