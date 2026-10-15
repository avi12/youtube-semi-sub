const FETCH_TIMEOUT_MS = 15_000;

/** GETs a URL as text; resolves to null on any network or HTTP failure */
export async function fetchText({ url, credentials }: {
  url: URL;
  credentials: RequestCredentials;
}) {
  const response = await fetch(url, {
    credentials,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  }).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  return await response.text().catch(() => null);
}
