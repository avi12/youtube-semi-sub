import { z } from "@/lib/zod";

type PolymerSet = (path: string, value: unknown) => void;

/** A www.youtube.com Polymer element: renders from `data` and accepts model writes through `set` */
export interface PolymerElement extends HTMLElement {
  data: unknown;
  set: PolymerSet;
}

const polymerElementSchema = z.object({
  set: z.custom<PolymerSet>(value => typeof value === "function")
});

export function isPolymerElement(element: Element): element is PolymerElement {
  return polymerElementSchema.safeParse(element).success;
}
