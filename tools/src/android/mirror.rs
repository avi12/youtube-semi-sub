//! Keeps a folder on the device current with the build output, which Firefox runs the extension
//! from: after every build only the files whose content changed are copied over, with the HMR
//! manifest last - the pages poll it, so it must never name a module that hasn't landed yet. Files
//! a build drops stay on the device: an extension build clears the HMR modules before the HMR
//! build writes them again, and deleting them meanwhile would pull them from under the open pages.
//! Each session starts from a fresh folder, so nothing stale outlives it.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

use tokio::sync::Mutex;

use super::adb::Adb;
use super::tar::{archive, TarFile};
use super::Result;
use crate::output::patches::hmr_names::{HMR_MANIFEST_FILE, HMR_OUT_SUBDIR};
use crate::output::reload::hash_output_files;

/// Where the device keeps the copies: the one folder adb's shell can write and Firefox can read.
const DEVICE_ROOT: &str = "/data/local/tmp/devtool";

/// What a sync did, for the log.
#[derive(Debug, Clone, Copy)]
pub(crate) struct SyncReport {
    pub(crate) written: usize,
    pub(crate) elapsed_ms: u128,
}

fn hmr_manifest_path() -> String {
    format!("{HMR_OUT_SUBDIR}/{HMR_MANIFEST_FILE}")
}

/// The files to write, in order: the ones whose content the device lacks, the HMR manifest last.
fn plan_writes(pushed: &BTreeMap<String, String>, next: &BTreeMap<String, String>) -> Vec<String> {
    let manifest = hmr_manifest_path();
    let mut written: Vec<String> = next
        .iter()
        .filter(|(file, hash)| pushed.get(*file) != Some(*hash))
        .map(|(file, _)| file.clone())
        .collect();
    // The listing is sorted, so a stable partition keeps every other file in order
    written.sort_by_key(|file| *file == manifest);
    written
}

/// The device folder of one extension's build output.
pub(crate) struct DeviceMirror {
    adb: Adb,
    local_dir: PathBuf,
    device_dir: String,
    /// The content hash of every file the device holds.
    pushed: Mutex<BTreeMap<String, String>>,
}

impl DeviceMirror {
    /// A fresh device folder for `extension_id`, holding the whole build output.
    pub(crate) async fn create(adb: Adb, local_dir: PathBuf, extension_id: &str) -> Result<Self> {
        let device_dir = format!("{DEVICE_ROOT}/{extension_id}");
        adb.remove_folder(&device_dir).await?;
        let mirror = Self {
            adb,
            local_dir,
            device_dir,
            pushed: Mutex::default(),
        };
        mirror.sync().await?;
        Ok(mirror)
    }

    /// The folder Firefox installs the extension from.
    pub(crate) fn device_dir(&self) -> &str {
        &self.device_dir
    }

    pub(crate) const fn adb(&self) -> &Adb {
        &self.adb
    }

    /// Brings the device folder in line with the build output.
    pub(crate) async fn sync(&self) -> Result<SyncReport> {
        let started = Instant::now();
        let mut pushed = self.pushed.lock().await;
        let next = hash_output_files(&self.local_dir)?;
        let written = plan_writes(&pushed, &next);
        if !written.is_empty() {
            let contents = written
                .iter()
                .map(|file| fs::read(self.local_dir.join(file)))
                .collect::<std::io::Result<Vec<_>>>()?;
            let files: Vec<TarFile<'_>> = written
                .iter()
                .zip(&contents)
                .map(|(path, bytes)| TarFile { path, bytes })
                .collect();
            self.adb
                .extract(&self.device_dir, &archive(&files)?)
                .await?;
        }
        pushed.extend(next);
        Ok(SyncReport {
            written: written.len(),
            elapsed_ms: started.elapsed().as_millis(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hashes(entries: &[(&str, &str)]) -> BTreeMap<String, String> {
        entries
            .iter()
            .map(|(file, hash)| ((*file).to_owned(), (*hash).to_owned()))
            .collect()
    }

    #[test]
    fn only_changed_files_are_written_with_the_hmr_manifest_last() {
        let pushed = hashes(&[("a.js", "1"), ("gone.js", "1"), ("hmr/manifest.json", "1")]);
        let next = hashes(&[
            ("a.js", "2"),
            ("hmr/manifest.json", "2"),
            ("hmr/x.js", "1"),
            ("same.js", "1"),
        ]);
        assert_eq!(
            plan_writes(&pushed, &next),
            ["a.js", "hmr/x.js", "same.js", "hmr/manifest.json"]
        );
        assert_eq!(plan_writes(&next, &next), Vec::<String>::new());
    }
}
