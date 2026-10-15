import { z } from "@/lib/zod";

/** A www.youtube.com Polymer element: renders from `data` and accepts model writes through `set` */
export interface PolymerElement extends HTMLElement {
  data: unknown;
  set(path: string, value: unknown): void;
}

const polymerElementSchema = z.object({
  set: z.custom<PolymerElement["set"]>(value => typeof value === "function")
});

/** `data` is checked with `in`: Polymer defines it on the prototype, and an unset one reads as undefined */
export function isPolymerElement(element: Element): element is PolymerElement {
  return "data" in element && polymerElementSchema.safeParse(element).success;
}
