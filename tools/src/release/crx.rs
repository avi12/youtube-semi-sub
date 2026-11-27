//! Packing the CRX with the packer built into a Chrome binary.

use std::path::{Path, PathBuf};

use super::error::{ReleaseError, Result};
use super::extension::Extension;
use crate::process::Invocation;

const CHROME_CANDIDATES: [&str; 6] = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
];

fn find_chrome(preferred: Option<PathBuf>) -> Result<PathBuf> {
    preferred
        .into_iter()
        .chain(CHROME_CANDIDATES.into_iter().map(PathBuf::from))
        .find(|candidate| candidate.is_file())
        .ok_or(ReleaseError::NoBrowser)
}

fn require(path: &Path) -> Result<()> {
    if path.exists() {
        return Ok(());
    }
    Err(ReleaseError::Missing(path.to_owned()))
}

fn flag(name: &str, path: &Path) -> String {
    format!("{name}={}", path.display())
}

/// Packs the build into the CRX of the release.
pub(super) async fn pack(
    extension: &Extension,
    key_path: &Path,
    chrome: Option<PathBuf>,
) -> Result<()> {
    require(key_path)?;
    require(&extension.build_dir)?;
    require(&extension.output_file(&extension.zip_file_name()))?;
    // Chrome writes the CRX beside the directory; an older one must not pass for this run
    let packed = extension.build_dir.with_extension("crx");
    if packed.exists() {
        std::fs::remove_file(&packed)?;
    }
    // The packer reads relative paths against its own directory, so both are made absolute
    let build_dir = std::path::absolute(&extension.build_dir)?;
    let key_path = std::path::absolute(key_path)?;
    Invocation::new(find_chrome(chrome)?)
        .args([
            flag("--pack-extension", &build_dir),
            flag("--pack-extension-key", &key_path),
            "--no-message-box".to_owned(),
        ])
        .capture_checked()
        .await?;
    require(&packed)?;
    std::fs::copy(packed, extension.output_file(&extension.crx_file_name()))?;
    Ok(())
}
