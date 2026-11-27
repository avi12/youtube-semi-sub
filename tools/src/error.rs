//! The one error type of the tooling binary.

use thiserror::Error;

use crate::dev::{BrowserError, HmrError, LauncherError};
use crate::firefox::FirefoxError;
use crate::output::OutputError;
use crate::release::ReleaseError;

/// Everything that can go wrong in a tool command.
#[derive(Debug, Error)]
#[non_exhaustive]
pub(crate) enum Error {
    /// The shared CDP, RDP or file-watching library failed.
    #[error(transparent)]
    Library(#[from] dev_hot::Error),
    /// A `firefox` command failed.
    #[error(transparent)]
    Firefox(#[from] FirefoxError),
    /// A `release` command failed.
    #[error(transparent)]
    Release(#[from] ReleaseError),
    /// An `output` command failed.
    #[error(transparent)]
    Output(#[from] OutputError),
    /// A `dev` browser target failed.
    #[error(transparent)]
    Browser(#[from] BrowserError),
    /// A `dev` HMR build failed.
    #[error(transparent)]
    Hmr(#[from] HmrError),
    /// The `dev` launcher failed.
    #[error(transparent)]
    Launcher(#[from] LauncherError),
    /// Reading or writing a file or pipe failed.
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    /// A JSON document did not parse or did not match its type.
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

/// The tooling's result type.
pub(crate) type Result<T> = std::result::Result<T, Error>;
