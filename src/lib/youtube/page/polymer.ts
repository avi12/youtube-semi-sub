import { z } from "@/lib/zod";
import { createGuard, VOID_METHOD_SCHEMA } from "@/lib/zod-guard";

/** A www.youtube.com Polymer element: renders from `data` and accepts model writes through `set` */
export interface PolymerElement extends HTMLElement {
  data: unknown;
  set(path: string, value: unknown): void;
}

const POLYMER_GLOBAL = "Polymer";

const isPolymerGlobal = createGuard(z.object({ flush: VOID_METHOD_SCHEMA }));

const hasPolymerSetter = createGuard(
  z.object({
    set: z.function({
      input: [z.string(), z.unknown()],
      output: z.void()
    })
  })
);

/** `data` is checked with `in`: Polymer defines it on the prototype, and an unset one reads as undefined */
export function isPolymerElement(element: Element): element is PolymerElement {
  return "data" in element && hasPolymerSetter(element);
}

/** Renders Polymer's pending DOM changes now, so they can be measured; a no-op where Polymer isn't loaded (m) */
export function flushPolymer() {
  const polymer: unknown = Object.getOwnPropertyDescriptor(globalThis, POLYMER_GLOBAL)?.value;
  if (isPolymerGlobal(polymer)) {
    polymer.flush.call(polymer);
  }
}
