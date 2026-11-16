const REPOSITORY_SLUG = "avi12/youtube-semi-sub";
export const REPOSITORY_URL = `https://github.com/${REPOSITORY_SLUG}`;
export const LATEST_RELEASE_URL = `${REPOSITORY_URL}/releases/latest`;
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPOSITORY_SLUG}/releases/latest`;

export const CHROME_UPDATE_MANIFEST_FILE = "updates.xml";
/** GitHub redirects `latest/download` to the newest release's asset, so the manifest needs no hosting of its own */
export const CHROME_UPDATE_MANIFEST_URL = `${LATEST_RELEASE_URL}/download/${CHROME_UPDATE_MANIFEST_FILE}`;
/** The public half of the release signing key: pins the extension's ID, so a zip, a CRX and every update share one */
export const CHROME_EXTENSION_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyS8AL+KKqZbgTfk+0G8glOLiFwVyfW3w5+1TnQnZ/NdORz6h6fbNeacwVzj0at9K8gSSbBnPKNg+altytyxicg1q8voByyPZzAFJTDx+EmPo7pEUACywh3f48r08e/FHpoaZe6rNxSQApn4abugSjDWj29D/qiwmpO0/TppkvN8ZH6RXcnsXePMQkcv//9vD3GbhJ/tFwXYO1vHW+0lp0FJGIr12Z7htJ+gxStwIvIk8DEsCYou0qKN1y+10NQ1P21n0ZkSq7upDCkzrZLD641jXhdxnKEwg4ZN9sJ79H0mA9cCi/4iicN2SrBfDL06Ti1URGp6HdZIn2MxNg7voOQIDAQAB";
