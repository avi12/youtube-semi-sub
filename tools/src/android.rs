//! Firefox for Android as a dev browser, over adb: the device, and the folder on it Firefox runs the
//! extension from. Everything else - reloads, background swaps, HMR - goes through the same RDP
//! target as desktop Firefox, on the port adb forwards.

mod adb;
mod mirror;
mod tar;

pub(crate) use adb::Adb;
pub(crate) use mirror::DeviceMirror;

use crate::output::OutputError;
use crate::process::ProcessError;

/// The app Firefox for Android is published as; Beta and Nightly are separate packages.
pub(crate) const DEFAULT_FIREFOX_PACKAGE: &str = "org.mozilla.firefox";

/// What can go wrong on the device side.
#[derive(Debug, thiserror::Error)]
pub(crate) enum AndroidError {
    /// adb could not start or failed.
    #[error(transparent)]
    Process(#[from] ProcessError),
    /// The build output could not be read.
    #[error(transparent)]
    Output(#[from] OutputError),
    /// Reading a build file failed.
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    /// The device is missing, ambiguous or answered something unexpected.
    #[error("{0}")]
    Device(String),
}

/// The group's result type.
pub(crate) type Result<T> = std::result::Result<T, AndroidError>;
