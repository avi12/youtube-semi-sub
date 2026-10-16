import { readYtcfg, YtcfgKey } from "@/lib/youtube/page/globals";
import { InnerTubePath } from "@/lib/youtube/site";
import { z } from "@/lib/zod";

// MAIN world only: reads the page's `ytcfg` and signs requests the way the page does, so the response
// carries the same renderer shapes the page itself renders (WEB on www.youtube.com, MWEB on m.youtube.com)

export enum InnerTubeEndpoint {
  browse = `${InnerTubePath.browse}?prettyPrint=false`
}

const APISID_COOKIE_NAMES = ["SAPISID", "__Secure-3PAPISID", "__Secure-1PAPISID"] as const;
const OWN_REQUEST_MARKER_HEADER = "X-Youtube-Semi-Sub";

const innerTubeContextSchema = z.looseObject({
  client: z.looseObject({
    clientName: z.string(),
    clientVersion: z.string()
  })
});

const clientNameNumberSchema = z.union([z.number(), z.string()]);

function readApisidCookie() {
  const cookies = new Map(document.cookie.split("; ").map(cookie => {
    const iSeparator = cookie.indexOf("=");
    return [cookie.slice(0, iSeparator), cookie.slice(iSeparator + 1)];
  }));
  for (const name of APISID_COOKIE_NAMES) {
    const value = cookies.get(name);
    if (value) {
      return value;
    }
  }
  return null;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function buildAuthorization() {
  const apisid = readApisidCookie();
  if (!apisid) {
    return null;
  }

  const seconds = Math.floor(Date.now() / 1000);
  const digest = await crypto.subtle
    .digest("SHA-1", new TextEncoder().encode(`${seconds} ${apisid} ${location.origin}`))
    .catch(() => null);
  if (!digest) {
    return null;
  }

  const signature = `${seconds}_${toHex(digest)}`;
  return `SAPISIDHASH ${signature} SAPISID3PHASH ${signature}`;
}

function getInnerTubeContext() {
  const parsed = innerTubeContextSchema.safeParse(readYtcfg(YtcfgKey.innerTubeContext));
  return parsed.success ? parsed.data : null;
}

async function buildHeaders(clientVersion: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [OWN_REQUEST_MARKER_HEADER]: "1",
    "X-Origin": location.origin,
    "X-Goog-AuthUser": String(readYtcfg(YtcfgKey.sessionIndex) ?? "0"),
    "X-Youtube-Client-Version": clientVersion
  };

  const clientNameNumber = clientNameNumberSchema.safeParse(readYtcfg(YtcfgKey.clientNameNumber));
  if (clientNameNumber.success) {
    headers["X-Youtube-Client-Name"] = String(clientNameNumber.data);
  }

  const authorization = await buildAuthorization();
  if (authorization) {
    headers.Authorization = authorization;
  }

  const delegatedSessionId = readYtcfg(YtcfgKey.delegatedSessionId);
  if (typeof delegatedSessionId === "string") {
    headers["X-Goog-PageId"] = delegatedSessionId;
  }

  return headers;
}

/** POSTs to InnerTube with the page's own client context; resolves to the parsed JSON or null */
export async function postInnerTube({ endpoint, payload }: {
  endpoint: InnerTubeEndpoint;
  payload: Record<string, unknown>;
}) {
  const context = getInnerTubeContext();
  if (!context) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: await buildHeaders(context.client.clientVersion),
    body: JSON.stringify({
      context,
      ...payload
    })
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const parsed: unknown = await response.json().catch(() => null);
  return parsed;
}
