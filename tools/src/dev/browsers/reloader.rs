//! The full extension reload, which also resets the background swapper.

use std::sync::Arc;

use tokio::sync::Mutex;

use super::error::Result;
use super::swap::{BackgroundSwapper, LogFn};
use super::target::ReloadTarget;
use crate::output::reload::{describe_extension_reload, ExtensionReloadPlan};

/// Reloads the extension of one target, and owns the background swapper a reload resets.
pub(crate) struct ExtensionReloader {
    target: Arc<dyn ReloadTarget>,
    swapper: BackgroundSwapper,
    /// Held across a reload, so two never run at once. Keeps a failed plan for the next one.
    pending: Mutex<Option<ExtensionReloadPlan>>,
}

impl ExtensionReloader {
    /// A reloader over one target; `log` receives what the swapper does after a call returned.
    pub(crate) fn new(target: Arc<dyn ReloadTarget>, log: LogFn) -> Self {
        let swapper = BackgroundSwapper::new(Arc::clone(&target), log);
        Self {
            target,
            swapper,
            pending: Mutex::default(),
        }
    }

    pub(super) fn swapper(&self) -> &BackgroundSwapper {
        &self.swapper
    }

    /// Reloads now and returns the logged sentence. A failed reload is covered by the next one.
    pub(super) async fn reload(&self, plan: &ExtensionReloadPlan) -> Result<String> {
        let mut pending = self.pending.lock().await;
        let plan = match pending.take() {
            Some(older) => older.merge(plan.clone()),
            None => plan.clone(),
        };
        self.swapper.forget();
        match self.target.reload_extension(&plan).await {
            Ok(result) => Ok(describe_extension_reload(&plan, &result)),
            Err(error) => {
                *pending = Some(plan);
                Err(error)
            }
        }
    }
}
