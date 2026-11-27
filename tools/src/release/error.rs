//! The error of the release group.

use std::path::PathBuf;

use thiserror::Error;

use crate::process::ProcessError;

/// Everything that can stop a release from being packed.
#[derive(Debug, Error)]
pub(crate) enum ReleaseError {
    /// A file or a build the release needs is not there.
    #[error("{} is missing: run `bun run build` and `bun run zip` first, with the signing key in place", .0.display())]
    Missing(PathBuf),
    /// Reading or writing a file failed.
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    /// A JSON document did not parse.
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    /// The key of the built manifest is not base64.
    #[error("the manifest key does not decode: {0}")]
    Key(#[from] base64::DecodeError),
    /// The pushed tag names another version.
    #[error("the tag does not match the version of package.json, {0}")]
    TagMismatch(String),
    /// No browser was found to pack with.
    #[error("no Chrome binary found to pack the CRX; install Chrome or set CHROME_BIN")]
    NoBrowser,
    /// The browser could not be run, or failed.
    #[error(transparent)]
    Process(#[from] ProcessError),
}

/// The result type of the group.
pub(crate) type Result<T> = std::result::Result<T, ReleaseError>;
