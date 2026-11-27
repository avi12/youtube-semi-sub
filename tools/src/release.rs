//! The `release` command group: packs what `bun run build` and `bun run zip` produced into the
//! release's CRX, signed with the release key, and the update manifest Chrome reads to find the
//! next one.

mod crx;
mod error;
mod extension;

use std::path::PathBuf;

use clap::{Args, Subcommand};

pub(crate) use self::error::ReleaseError;
use self::error::Result;
use self::extension::Extension;

/// The commands of this group.
#[derive(Debug, Subcommand)]
pub(crate) enum Command {
    /// Packs the signed CRX and writes the update manifest
    Package(PackageArgs),
}

/// What packaging needs.
#[derive(Debug, Args)]
pub(crate) struct PackageArgs {
    /// The repository root
    #[arg(long, default_value = ".")]
    project_root: PathBuf,
    /// The release signing key
    #[arg(long, env = "CHROME_CRX_PRIVATE_KEY_PATH")]
    key_path: PathBuf,
    /// The pushed tag, which must match the version of package.json
    #[arg(long, env = "GITHUB_REF_NAME")]
    tag: Option<String>,
    /// The browser that packs the CRX, when it is not in its usual place
    #[arg(long, env = "CHROME_BIN")]
    chrome: Option<PathBuf>,
}

async fn package(args: PackageArgs) -> Result<()> {
    let extension = Extension::read(&args.project_root)?;
    let release_tag = extension.release_tag();
    // A branch run names the branch here, so only a version tag is compared
    let is_tag_mismatched = args
        .tag
        .is_some_and(|tag| tag.starts_with('v') && tag != release_tag);
    if is_tag_mismatched {
        return Err(ReleaseError::TagMismatch(extension.version));
    }
    crx::pack(&extension, &args.key_path, args.chrome).await?;
    let manifest_path = extension.write_update_manifest()?;
    println!(
        "Packed {} and {} for {release_tag}",
        extension.crx_file_name(),
        manifest_path.display()
    );
    Ok(())
}

/// Runs one command of this group.
pub(crate) async fn run(command: Command) -> crate::error::Result<()> {
    match command {
        Command::Package(args) => Ok(package(args).await?),
    }
}
