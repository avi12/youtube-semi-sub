import { functionSchema } from "@/lib/schemas/function";
import { z } from "@/lib/zod";

/** A www.youtube.com Polymer element: renders from `data` and accepts model writes through `set` */
export interface PolymerElement extends HTMLElement {
  data: unknown;
  set(path: string, value: unknown): void;
}

const POLYMER_GLOBAL = "Polymer";

const polymerGlobalSchema = z.looseObject({
  flush: functionSchema
});

const polymerElementSchema = z.object({
  set: functionSchema
});

/** `data` is checked with `in`: Polymer defines it on the prototype, and an unset one reads as undefined */
export function isPolymerElement(element: Element): element is PolymerElement {
  return "data" in element && polymerElementSchema.safeParse(element).success;
}

/** Renders Polymer's pending DOM changes now, so they can be measured; a no-op where Polymer isn't loaded (m) */
export function flushPolymer() {
  const polymer: unknown = Object.getOwnPropertyDescriptor(globalThis, POLYMER_GLOBAL)?.value;
  const parsed = polymerGlobalSchema.safeParse(polymer);
  if (parsed.success) {
    parsed.data.flush.call(polymer);
  }
}
