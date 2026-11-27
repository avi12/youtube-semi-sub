//! The Firefox protocol clients the dev server's browser targets use.

mod framed;
pub(crate) mod marionette;
pub(crate) mod rdp;

/// The port Firefox's Marionette server listens on unless told otherwise.
pub(crate) const MARIONETTE_DEFAULT_PORT: u16 = 2838;

/// Everything that can go wrong in a Firefox command.
#[derive(Debug, thiserror::Error)]
pub(crate) enum FirefoxError {
    /// The shared RDP framing library failed.
    #[error(transparent)]
    Library(#[from] dev_hot::Error),
    /// Reading or writing a socket or running a process failed.
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    /// A JSON document did not parse or did not match its type.
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    /// A wait ran out.
    #[error("timeout waiting for {0}")]
    Timeout(String),
    /// A lookup, a protocol answer or a precondition failed in a way the caller must see.
    #[error("{0}")]
    Failed(String),
}

/// The group's result type.
pub(crate) type Result<T> = std::result::Result<T, FirefoxError>;
