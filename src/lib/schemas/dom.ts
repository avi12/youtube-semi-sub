import { z } from "@/lib/zod";

// DOM nodes held in a typed shape. The class is read inside the check, so importing this never touches the DOM

export const elementSchema = z.custom<Element>(value => value instanceof Element);

export const htmlElementSchema = z.custom<HTMLElement>(value => value instanceof HTMLElement);
