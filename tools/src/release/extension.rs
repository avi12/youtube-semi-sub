//! What a release says about the extension, read from `package.json` and the built manifest, so
//! the key and the addresses have one home (`src/lib/release.ts`, through `wxt.config.ts`).

use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use dev_hot::types::ContentHash;
use serde::de::DeserializeOwned;
use serde::Deserialize;

use super::error::{ReleaseError, Result};

const OUTPUT_DIR: &str = ".output";
const BUILD_DIR: &str = "chrome-mv3";
/// Two hex digits for each of the 16 bytes a Chrome extension id comes from.
const ID_HEX_CHARS: usize = 32;

#[derive(Debug, Deserialize)]
struct Package {
    name: String,
    version: String,
}

#[derive(Debug, Deserialize)]
struct BuiltManifest {
    key: String,
    update_url: String,
    homepage_url: String,
}

/// The extension being released.
#[derive(Debug)]
pub(super) struct Extension {
    name: String,
    pub(super) version: String,
    output_dir: PathBuf,
    pub(super) build_dir: PathBuf,
    manifest: BuiltManifest,
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    if !path.exists() {
        return Err(ReleaseError::Missing(path.to_owned()));
    }
    Ok(serde_json::from_str(&std::fs::read_to_string(path)?)?)
}

/// The id Chrome gives a key: the first 16 bytes of its SHA-256, each nibble written `a` to `p`.
fn extension_id(public_key: &str) -> Result<String> {
    let der = STANDARD.decode(public_key)?;
    Ok(ContentHash::from_bytes(&der)
        .prefix(ID_HEX_CHARS)
        .chars()
        .filter_map(|digit| digit.to_digit(16))
        .filter_map(|nibble| char::from_u32(u32::from('a') + nibble))
        .collect())
}

impl Extension {
    pub(super) fn read(project_root: &Path) -> Result<Self> {
        let package: Package = read_json(&project_root.join("package.json"))?;
        let output_dir = project_root.join(OUTPUT_DIR);
        let build_dir = output_dir.join(BUILD_DIR);
        let manifest = read_json(&build_dir.join("manifest.json"))?;
        Ok(Self {
            name: package.name,
            version: package.version,
            output_dir,
            build_dir,
            manifest,
        })
    }

    pub(super) fn release_tag(&self) -> String {
        format!("v{}", self.version)
    }

    pub(super) fn crx_file_name(&self) -> String {
        format!("{}-{}-chrome.crx", self.name, self.version)
    }

    pub(super) fn zip_file_name(&self) -> String {
        format!("{}-{}-chrome.zip", self.name, self.version)
    }

    pub(super) fn output_file(&self, name: &str) -> PathBuf {
        self.output_dir.join(name)
    }

    fn render_update_manifest(&self) -> Result<String> {
        let codebase = format!(
            "{}/releases/download/{}/{}",
            self.manifest.homepage_url,
            self.release_tag(),
            self.crx_file_name()
        );
        Ok(format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="{}">
    <updatecheck codebase="{codebase}" version="{}" />
  </app>
</gupdate>
"#,
            extension_id(&self.manifest.key)?,
            self.version
        ))
    }

    /// Writes the update manifest under the name the `update_url` of the build ends with.
    pub(super) fn write_update_manifest(&self) -> Result<PathBuf> {
        let name = self.manifest.update_url.rsplit('/').next();
        let path = self.output_file(name.unwrap_or_default());
        std::fs::write(&path, self.render_update_manifest()?)?;
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_id_is_32_letters_from_a_to_p() -> Result<()> {
        // The SHA-256 of "abc" starts ba7816bf
        let id = extension_id("YWJj")?;
        assert_eq!(id.len(), ID_HEX_CHARS);
        assert!(id.starts_with("lkhibglp"));
        Ok(())
    }
}
