import { isHtmlElement } from "@/lib/dom-guards";
import { z } from "@/lib/zod";
import { createGuard, VOID_METHOD_SCHEMA } from "@/lib/zod-guard";

/** YouTube's popup menus: a fixed-position overlay lined up with the element that opened it */
export interface IronDropdownElement extends HTMLElement {
  opened: boolean;
  positionTarget: Element | null;
  refit(): void;
  close(): void;
}

export const IRON_DROPDOWN_SELECTOR = "tp-yt-iron-dropdown";

const hasDropdownMethods = createGuard(
  z.object({
    refit: VOID_METHOD_SCHEMA,
    close: VOID_METHOD_SCHEMA
  })
);

export function isIronDropdown(target: unknown): target is IronDropdownElement {
  return isHtmlElement(target) && "positionTarget" in target && hasDropdownMethods(target);
}

export const ironDropdownElementSchema = z.custom<IronDropdownElement>(isIronDropdown);
