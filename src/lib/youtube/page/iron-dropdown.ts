import { functionSchema } from "@/lib/schemas/function";
import { z } from "@/lib/zod";

/** YouTube's popup menus: a fixed-position overlay lined up with the element that opened it */
export interface IronDropdownElement extends HTMLElement {
  opened: boolean;
  positionTarget: Element | null;
  refit(): void;
  close(): void;
}

export const IRON_DROPDOWN_SELECTOR = "tp-yt-iron-dropdown";

const ironDropdownSchema = z.object({
  refit: functionSchema,
  close: functionSchema
});

export function isIronDropdown(target: unknown): target is IronDropdownElement {
  return target instanceof HTMLElement && "positionTarget" in target && ironDropdownSchema.safeParse(target).success;
}

export const ironDropdownElementSchema = z.custom<IronDropdownElement>(isIronDropdown);
