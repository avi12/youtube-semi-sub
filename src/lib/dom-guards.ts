import { z } from "@/lib/zod";
import { createLazyGuard } from "@/lib/zod-guard";

// The DOM classes the extension tells apart: schemas for object shapes and guards for narrowing, both built on first
// use, so importing this never touches the DOM

export const elementSchema = z.lazy(() => z.instanceof(Element));
export const htmlElementSchema = z.lazy(() => z.instanceof(HTMLElement));

export const isNode = createLazyGuard(() => z.instanceof(Node));
export const isElement = createLazyGuard(() => z.instanceof(Element));
export const isHtmlElement = createLazyGuard(() => z.instanceof(HTMLElement));
export const isButtonElement = createLazyGuard(() => z.instanceof(HTMLButtonElement));
export const isInputElement = createLazyGuard(() => z.instanceof(HTMLInputElement));
export const isCustomEvent = createLazyGuard(() => z.instanceof(CustomEvent));
export const isRequest = createLazyGuard(() => z.instanceof(Request));
export const isUrl = createLazyGuard(() => z.instanceof(URL));
