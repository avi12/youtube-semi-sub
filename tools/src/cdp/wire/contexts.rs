//! The events a session keeps: the execution contexts of a page, and the exception of an evaluation.

use serde::Deserialize;
use serde_json::Value;

const CONTEXT_CREATED_METHOD: &str = "Runtime.executionContextCreated";

/// One JavaScript context of a page.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub(crate) struct ExecutionContext {
    /// The id `Runtime.evaluate` takes as `contextId`.
    pub(crate) id: u64,
    /// The context's name (an extension's isolated world carries its extension name).
    #[serde(default)]
    pub(crate) name: String,
    /// What kind of context it is.
    #[serde(default, rename = "auxData")]
    pub(crate) aux: ContextAux,
}

/// What kind of context it is.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
pub(crate) struct ContextAux {
    /// What runs in it.
    #[serde(default, rename = "type")]
    pub(crate) kind: ContextKind,
}

/// What runs in a JavaScript context.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ContextKind {
    /// A content script's own world.
    Isolated,
    /// The page's world, a worker or anything else.
    #[default]
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct ContextCreated {
    context: ExecutionContext,
}

impl ExecutionContext {
    /// The context an event frame announces; any other event announces none.
    pub(super) fn announced(method: &str, params: Value) -> Option<Self> {
        if method != CONTEXT_CREATED_METHOD {
            return None;
        }
        let ContextCreated { context } = serde_json::from_value(params).ok()?;
        Some(context)
    }
}

#[derive(Debug, Deserialize)]
pub(super) struct ExceptionDetails {
    text: Option<String>,
    exception: Option<ExceptionObject>,
}

#[derive(Debug, Deserialize)]
struct ExceptionObject {
    description: Option<String>,
}

impl ExceptionDetails {
    /// The page's own description when it has one, else the short text.
    pub(super) fn message(self) -> String {
        self.exception
            .and_then(|exception| exception.description)
            .or(self.text)
            .unwrap_or_else(|| "?".to_owned())
    }
}
