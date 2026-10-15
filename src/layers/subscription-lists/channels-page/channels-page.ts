import ChannelsGroup from "./ChannelsGroup.svelte";
import { FeedPathname } from "@/lib/youtube/site";
import { SemiListSurface, startSemiListSurface } from "#subscription-lists/semi-list-surface";

// www.youtube.com/feed/channels is page "subscriptions-channels" in YouTube's page manager - a ytd-browse of its own

const PAGE_MANAGER_SELECTOR = "ytd-page-manager";
const SECTION_LIST_SELECTOR = "ytd-browse[page-subtype='subscriptions-channels'] ytd-section-list-renderer";
/** The sort menu and the list both follow; the group goes before whichever the section list stamped first */
const SECTION_LIST_START_SELECTOR = ":scope > #header-container, :scope > #contents";

function findChannelsPagePlacement() {
  const elSectionList = document.querySelector(SECTION_LIST_SELECTOR);
  if (!elSectionList) {
    return null;
  }

  return {
    target: elSectionList,
    anchor: elSectionList.querySelector(SECTION_LIST_START_SELECTOR)
  };
}

export function startChannelsPageList() {
  startSemiListSurface({
    surface: SemiListSurface.channels,
    pathname: FeedPathname.channels,
    observedSelector: PAGE_MANAGER_SELECTOR,
    findPlacement: findChannelsPagePlacement,
    component: ChannelsGroup
  });
}
