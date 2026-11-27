//! The CDP plumbing of the browser targets: one WebSocket session, the debug port's HTTP
//! endpoints and the execution contexts a page announces.

mod contexts;
mod error;
mod http;
mod session;

pub(crate) use dev_hot::driver::cdp::protocol::{Method, NoParams};

pub(crate) use self::contexts::ContextKind;
pub(crate) use self::error::CdpError;
pub(crate) use self::http::{close_target, open_tab};
pub(crate) use self::session::{evaluate_on, ContextEvaluation, RemoteObject, Session};
