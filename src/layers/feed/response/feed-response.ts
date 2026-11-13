import { type BrowseResponse, browseResponseSchema, continuationResponseSchema } from "#feed/items/feed-schemas";
import { findInitialDataJson } from "@/lib/youtube/initial-data";
import type { BrowseTab } from "@/lib/youtube/schemas/browse";

// Recognizes the first page of the subscriptions feed in a /browse response or ytInitialData - www nests it under
// twoColumnBrowseResultsRenderer, m under singleColumnBrowseResultsRenderer - and swaps its grid contents, listing
// beside them the videos a hide filter took out. A later page, a continuation of that grid, is recognized and swapped
// the same way

export const SUBSCRIPTIONS_BROWSE_ID = "FEsubscriptions";
const SUBSCRIPTIONS_GRID_TARGET_ID = `browse-feed${SUBSCRIPTIONS_BROWSE_ID}`;
const BROWSE_ID_TRACKING_KEY = "browse_id";
const ESCAPED_LESS_THAN = "\\u003c";

/** Beside the grid's contents, the ids a hide filter took out of them - for YouTube Auto Feed to drop as well */
const HIDDEN_VIDEO_IDS_KEY = "yssHiddenVideoIds";

enum BrowseColumn {
  twoColumn = "twoColumnBrowseResultsRenderer",
  singleColumn = "singleColumnBrowseResultsRenderer"
}

function isSubscriptionsBrowseIdTracked(response: Pick<BrowseResponse, "responseContext">) {
  const trackingParams = response.responseContext?.serviceTrackingParams ?? [];
  return trackingParams.some(service =>
    service.params?.some(param => param.key === BROWSE_ID_TRACKING_KEY && param.value === SUBSCRIPTIONS_BROWSE_ID)
  );
}

function findGridTab(tabs: BrowseTab[]) {
  const iTab = tabs.findIndex(tab => !!tab.tabRenderer?.content?.richGridRenderer);
  const tabRenderer = tabs[iTab]?.tabRenderer;
  const grid = tabRenderer?.content?.richGridRenderer;
  return tabRenderer && grid
    ? {
        iTab,
        tabRenderer,
        grid
      }
    : null;
}

export function readSubscriptionsFeed(data: unknown) {
  const parsed = browseResponseSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }

  const response = parsed.data;
  const isTwoColumn = !!response.contents.twoColumnBrowseResultsRenderer;
  const columnKey = isTwoColumn ? BrowseColumn.twoColumn : BrowseColumn.singleColumn;
  const column = response.contents[columnKey];
  const gridTab = column && findGridTab(column.tabs);
  if (!column || !gridTab) {
    return null;
  }

  const { iTab, tabRenderer, grid } = gridTab;
  const isSubscriptionsFeed =
    isSubscriptionsBrowseIdTracked(response) ||
    tabRenderer.tabIdentifier === SUBSCRIPTIONS_BROWSE_ID ||
    grid.targetId === SUBSCRIPTIONS_GRID_TARGET_ID;
  if (!isSubscriptionsFeed) {
    return null;
  }

  return {
    contents: grid.contents,
    /**
     * A copy of the response with the grid contents replaced, and the hidden ids listed beside them unless null; the
     * original is left untouched
     */
    withContents({ contents, hiddenVideoIds }: { contents: unknown[]; hiddenVideoIds: string[] | null }) {
      const tab = column.tabs[iTab];
      const hiddenVideoIdsEntry = hiddenVideoIds ? { [HIDDEN_VIDEO_IDS_KEY]: hiddenVideoIds } : {};
      const patchedTab = {
        ...tab,
        tabRenderer: {
          ...tabRenderer,
          content: {
            ...tabRenderer.content,
            richGridRenderer: {
              ...grid,
              contents,
              ...hiddenVideoIdsEntry
            }
          }
        }
      };
      return {
        ...response,
        contents: {
          ...response.contents,
          [columnKey]: {
            ...column,
            tabs: column.tabs.with(iTab, patchedTab)
          }
        }
      };
    }
  };
}

/** A later page of the subscriptions feed: the items a continuation appends to its grid */
export function readSubscriptionsContinuation(data: unknown) {
  const parsed = continuationResponseSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }

  const response = parsed.data;
  const actions = response.onResponseReceivedActions;
  const iAction = actions.findIndex(action => !!action.appendContinuationItemsAction);
  const appendAction = actions[iAction]?.appendContinuationItemsAction;
  const isSubscriptionsFeed =
    appendAction?.targetId === SUBSCRIPTIONS_GRID_TARGET_ID || isSubscriptionsBrowseIdTracked(response);
  if (!appendAction || !isSubscriptionsFeed) {
    return null;
  }

  return {
    contents: appendAction.continuationItems,
    /** A copy of the response with the appended items replaced; the original is left untouched */
    withContents(contents: unknown[]) {
      return {
        ...response,
        onResponseReceivedActions: actions.with(iAction, {
          ...actions[iAction],
          appendContinuationItemsAction: {
            ...appendAction,
            continuationItems: contents
          }
        })
      };
    }
  };
}

/** The ytInitialData object a page's HTML carries (www), and a way to swap it */
export function readInitialDataHtml(html: string) {
  const initialData = findInitialDataJson(html);
  if (!initialData) {
    return null;
  }

  const { json, iJsonStart } = initialData;
  const data: unknown = JSON.parse(json);
  return {
    data,
    withData(newData: unknown) {
      // `<` escaped so no string inside can close the script element
      const serialized = JSON.stringify(newData).replaceAll("<", ESCAPED_LESS_THAN);
      return html.slice(0, iJsonStart) + serialized + html.slice(iJsonStart + json.length);
    }
  };
}
