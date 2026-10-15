import { z } from "@/lib/zod";

/** A www.youtube.com Polymer element: renders from `data` and accepts model writes through `set` */
export interface PolymerElement extends HTMLElement {
  data: unknown;
  set(path: string, value: unknown): void;
}

const polymerElementSchema = z.object({
  set: z.custom<PolymerElement["set"]>(value => typeof value === "function")
});

export function isPolymerElement(element: Element): element is PolymerElement {
  return polymerElementSchema.safeParse(element).success;
}
