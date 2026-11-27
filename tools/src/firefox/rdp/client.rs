//! A Firefox RDP session: request/reply correlation by actor, typed replies and the lookups every
//! RDP command shares (add-ons).

use std::collections::VecDeque;
use std::time::Duration;

use dev_hot::driver::rdp::message::{
    encode_request, ActorId, Addon, EvaluateParams, InstallTemporaryAddonParams, NoParams,
    PacketKind, RequestKind, ResultId,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::time::{timeout_at, Instant};

use super::replies::{AddonList, InstallReply, RootReply};
use crate::firefox::framed::Framed;
use crate::firefox::{FirefoxError, Result};

/// The header every packet is routed by; the rest of it is read per request.
#[derive(Debug, Deserialize)]
struct Header {
    from: ActorId,
    #[serde(rename = "type")]
    kind: Option<PacketKind>,
    #[serde(rename = "resultID")]
    result_id: Option<ResultId>,
}

/// One packet from an actor.
#[derive(Debug, Clone)]
pub(crate) struct Message {
    pub(crate) from: ActorId,
    pub(crate) kind: Option<PacketKind>,
    result_id: Option<ResultId>,
    /// The whole packet, which commands print or parse further.
    pub(crate) body: Value,
}

impl Message {
    fn from_value(body: Value) -> Option<Self> {
        let Header {
            from,
            kind,
            result_id,
        } = Header::deserialize(&body).ok()?;
        Some(Self {
            from,
            kind,
            result_id,
            body,
        })
    }

    pub(crate) fn parse<T: DeserializeOwned>(&self) -> Result<T> {
        Ok(T::deserialize(&self.body)?)
    }
}

/// One RDP connection; packets nobody asked for yet wait in a queue.
#[derive(Debug)]
pub(crate) struct Rdp {
    framed: Framed,
    queue: VecDeque<Message>,
    reply_timeout: Duration,
    pub(crate) greeting: Value,
}

impl Rdp {
    /// Connects and waits for the root actor's greeting.
    pub(crate) async fn connect(port: u16, reply_timeout: Duration) -> Result<Self> {
        let mut rdp = Self {
            framed: Framed::connect(port).await?,
            queue: VecDeque::new(),
            reply_timeout,
            greeting: Value::Null,
        };
        let greeting = rdp.wait_from(&ActorId::root(), reply_timeout).await?;
        rdp.greeting = greeting.body;
        Ok(rdp)
    }

    async fn read_one(&mut self) -> Result<()> {
        let body = self.framed.recv().await?;
        self.queue.extend(Message::from_value(body));
        Ok(())
    }

    /// The first packet from `actor` that `matches`, within `limit`.
    pub(crate) async fn wait_matching(
        &mut self,
        actor: &ActorId,
        limit: Duration,
        matches: impl Fn(&Message) -> bool + Send,
    ) -> Result<Message> {
        let deadline = Instant::now() + limit;
        loop {
            let found = self
                .queue
                .iter()
                .position(|message| message.from == *actor && matches(message));
            if let Some(message) = found.and_then(|index| self.queue.remove(index)) {
                return Ok(message);
            }
            timeout_at(deadline, self.read_one())
                .await
                .map_err(|_| FirefoxError::Timeout(actor.to_string()))??;
        }
    }

    /// Waits for the next packet from `actor`.
    pub(crate) async fn wait_from(&mut self, actor: &ActorId, limit: Duration) -> Result<Message> {
        self.wait_matching(actor, limit, |_| true).await
    }

    /// Sends a request without waiting for its reply.
    pub(crate) async fn send<P: Serialize + Sync>(
        &mut self,
        actor: &ActorId,
        kind: RequestKind,
        params: &P,
    ) -> Result<()> {
        let packet = encode_request(actor, kind, params)?;
        self.framed.write(&packet).await
    }

    /// Sends a request and waits for the next packet from the same actor.
    pub(crate) async fn request<P: Serialize + Sync>(
        &mut self,
        actor: &ActorId,
        kind: RequestKind,
        params: &P,
    ) -> Result<Message> {
        self.send(actor, kind, params).await?;
        self.wait_from(actor, self.reply_timeout).await
    }

    /// Evaluates `text` in a console actor and returns the `evaluationResult` packet (or the
    /// reply itself when it carried no `resultID`).
    pub(crate) async fn evaluate(
        &mut self,
        console: &ActorId,
        text: &str,
        limit: Duration,
    ) -> Result<Message> {
        let params = EvaluateParams::new(text).not_eager();
        self.evaluate_with(console, params, limit).await
    }

    /// Like [`Self::evaluate`], awaiting the promise the text resolves to (top-level `await`).
    pub(crate) async fn evaluate_awaiting(
        &mut self,
        console: &ActorId,
        text: &str,
        limit: Duration,
    ) -> Result<Message> {
        let params = EvaluateParams::new(text).not_eager().awaiting();
        self.evaluate_with(console, params, limit).await
    }

    async fn evaluate_with(
        &mut self,
        console: &ActorId,
        params: EvaluateParams<'_>,
        limit: Duration,
    ) -> Result<Message> {
        let ack = self
            .request(console, RequestKind::EvaluateJsAsync, &params)
            .await?;
        let Some(result_id) = ack.result_id.clone() else {
            return Ok(ack);
        };
        self.wait_matching(console, limit, |message| {
            message.kind == Some(PacketKind::EvaluationResult)
                && message.result_id.as_ref() == Some(&result_id)
        })
        .await
    }

    pub(crate) async fn addons(&mut self) -> Result<Vec<Addon>> {
        let reply = self
            .request(&ActorId::root(), RequestKind::ListAddons, &NoParams {})
            .await?;
        Ok(reply.parse::<AddonList>()?.addons)
    }

    /// Installs the add-on at `addon_path` - a path on the browser's own file system, which on an
    /// Android device is not the host's - until the browser closes, and returns it as `listAddons`
    /// describes it.
    pub(crate) async fn install_temporary_addon(&mut self, addon_path: &str) -> Result<Addon> {
        let root = self
            .request(&ActorId::root(), RequestKind::GetRoot, &NoParams {})
            .await?;
        let addons_actor = root.parse::<RootReply>()?.addons_actor.ok_or_else(|| {
            FirefoxError::Failed("the browser offers no add-ons actor".to_owned())
        })?;
        let reply = self
            .request(
                &addons_actor,
                RequestKind::InstallTemporaryAddon,
                &InstallTemporaryAddonParams { addon_path },
            )
            .await?
            .parse::<InstallReply>()?;
        let Some(id) = reply.addon.and_then(|addon| addon.id) else {
            let reason = reply.message.unwrap_or_default();
            return Err(FirefoxError::Failed(format!(
                "installing {addon_path} failed: {reason}"
            )));
        };
        self.addons()
            .await?
            .into_iter()
            .find(|addon| addon.id.as_deref() == Some(id.as_str()))
            .ok_or_else(|| FirefoxError::Failed(format!("{id} is missing after its install")))
    }
}

#[cfg(test)]
mod tests;
