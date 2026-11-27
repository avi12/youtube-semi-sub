//! What a rebuild does to the running pages, as the in-page runtime decides it from the manifest.
//! The one classification every log line about it reads.

const RESTART_LINE: &str = "HMR: the bridge content script restarts in place";
const PAGE_RELOAD_LINE: &str =
    "HMR: the dependency graph changed - the pages running HMR modules reload";

/// The two manifest hashes whose change the runtime answers with more than a module swap.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct RuntimeHashes {
    pub(super) vendor: String,
    pub(super) restart: String,
}

/// What the running pages do with a build, beyond swapping components.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum ContentScriptUpdate {
    /// Nothing, or the first build.
    #[default]
    Unchanged,
    /// The `YouTube` content script restarts in place.
    Restarted,
    /// Every page running HMR modules reloads.
    PageReloaded,
}

impl ContentScriptUpdate {
    /// In the order `applyHotUpdates` of `runtime.js` checks them.
    pub(super) fn between(previous: Option<&RuntimeHashes>, next: &RuntimeHashes) -> Self {
        let Some(previous) = previous else {
            return Self::Unchanged;
        };
        if previous.vendor != next.vendor {
            return Self::PageReloaded;
        }
        if previous.restart != next.restart {
            return Self::Restarted;
        }
        Self::Unchanged
    }

    /// The line the HMR build logs.
    pub(super) fn log_line(self) -> Option<&'static str> {
        match self {
            Self::Unchanged => None,
            Self::Restarted => Some(RESTART_LINE),
            Self::PageReloaded => Some(PAGE_RELOAD_LINE),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hashes(vendor: &str, restart: &str) -> RuntimeHashes {
        RuntimeHashes {
            vendor: vendor.to_owned(),
            restart: restart.to_owned(),
        }
    }

    #[test]
    fn the_changed_hash_decides_the_update() {
        let before = hashes("v", "r");
        let between = |next| ContentScriptUpdate::between(Some(&before), &next);
        assert_eq!(between(hashes("v", "r")), ContentScriptUpdate::Unchanged);
        assert_eq!(between(hashes("v", "r2")), ContentScriptUpdate::Restarted);
        assert_eq!(
            between(hashes("v2", "r2")),
            ContentScriptUpdate::PageReloaded
        );
        assert_eq!(
            ContentScriptUpdate::between(None, &before),
            ContentScriptUpdate::Unchanged
        );
    }
}
