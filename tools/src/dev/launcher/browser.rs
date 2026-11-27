//! Launching the dev browser without web-ext-run: Chrome for Testing with `--load-extension`, or
//! Firefox with a debugger server and a temporary add-on.

mod cft;
mod chrome;
mod firefox;
mod marionette;

use std::path::Path;
use std::sync::Arc;

use dev_hot::types::Port;
use tokio::process::Child;

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

/// A running dev browser: the process this launcher started, and how to reach it.
#[derive(Debug)]
pub(super) struct RunningBrowser {
    pub(super) child: Child,
    pub(super) firefox: Option<FirefoxIdentity>,
}

impl RunningBrowser {
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
            child: chrome::launch(launch).await?,
            firefox: None,
        }),
        BuildBrowser::Firefox => {
            let (child, identity) = firefox::launch(launch).await?;
            Ok(RunningBrowser {
                child,
                firefox: Some(identity),
            })
        }
    }
}
