const RESPONSE_PROTOTYPE = Response.prototype;

/**
 * The `json` and `text` readers `Response` has right now, so an override installed later chains onto whatever earlier
 * ones (other extensions' too) already left in place
 */
export function captureResponseReaders() {
  const jsonDescriptor = Object.getOwnPropertyDescriptor(RESPONSE_PROTOTYPE, "json");
  const textDescriptor = Object.getOwnPropertyDescriptor(RESPONSE_PROTOTYPE, "text");
  const json: (this: Response) => Promise<unknown> = jsonDescriptor?.value;
  const text: (this: Response) => Promise<string> = textDescriptor?.value;
  return {
    json,
    text
  };
}
