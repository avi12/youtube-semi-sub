import type { ClassicRenderer, Lockup } from "@/lib/youtube/schemas/renderers";

// A members-only video carries a badge on its tile: a lockup's metadata row on www, a classic renderer's badge list on
// m. RSS lists these videos too, unmarked, so only a tile tells them apart

const LOCKUP_MEMBERS_ONLY_STYLE = "BADGE_MEMBERS_ONLY";
const CLASSIC_MEMBERS_ONLY_STYLE = "BADGE_STYLE_TYPE_MEMBERS_ONLY";

export function isMembersOnlyLockup(lockup: Lockup) {
  const rows = lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
  return rows.some(row => row.badges?.some(badge => badge.badgeViewModel?.badgeStyle === LOCKUP_MEMBERS_ONLY_STYLE));
}

export function isMembersOnlyClassicRenderer(renderer: ClassicRenderer) {
  return renderer.badges?.some(badge => badge.metadataBadgeRenderer?.style === CLASSIC_MEMBERS_ONLY_STYLE) ?? false;
}
