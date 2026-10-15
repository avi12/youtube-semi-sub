import { type BrowseResponse, browseResponseSchema, type BrowseTab } from "#feed/items/feed-schemas";

// Recognizes the first page of the subscriptions feed in a /browse response or ytInitialData - www nests it under
// twoColumnBrowseResultsRenderer, m under singleColumnBrowseResultsRenderer - and swaps its grid contents

export const SUBSCRIPTIONS_BROWSE_ID = "FEsubscriptions";
const SUBSCRIPTIONS_GRID_TARGET_ID = `browse-feed${SUBSCRIPTIONS_BROWSE_ID}`;
const BROWSE_ID_TRACKING_KEY = "browse_id";
const INITIAL_DATA_PATTERN = /(var ytInitialData = )(\{.+?\});<\/script>/s;
const ESCAPED_LESS_THAN = "\\u003c";

enum BrowseColumn {
  twoColumn = "twoColumnBrowseResultsRenderer",
  singleColumn = "singleColumnBrowseResultsRenderer"
}

function isSubscriptionsBrowseIdTracked(response: BrowseResponse) {
  const trackingParams = response.responseContext?.serviceTrackingParams ?? [];
  return trackingParams.some(service => service.params?.some(param =>
    param.key === BROWSE_ID_TRACKING_KEY && param.value === SUBSCRIPTIONS_BROWSE_ID));
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
  const isSubscriptionsFeed = isSubscriptionsBrowseIdTracked(response)
    || tabRenderer.tabIdentifier === SUBSCRIPTIONS_BROWSE_ID
    || grid.targetId === SUBSCRIPTIONS_GRID_TARGET_ID;
  if (!isSubscriptionsFeed) {
    return null;
  }

  return {
    contents: grid.contents,
    /** A copy of the response with the grid contents replaced; the original is left untouched */
    withContents(contents: unknown[]) {
      const tab = column.tabs[iTab];
      const patchedTab = {
        ...tab,
        tabRenderer: {
          ...tabRenderer,
          content: {
            ...tabRenderer.content,
            richGridRenderer: {
              ...grid,
              contents
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

/** The ytInitialData object a page's HTML carries (www), and a way to swap it */
export function readInitialDataHtml(html: string) {
  const match = INITIAL_DATA_PATTERN.exec(html);
  const [, declaration = "", json = ""] = match ?? [];
  if (!match) {
    return null;
  }

  const data: unknown = JSON.parse(json);
  const iJsonStart = match.index + declaration.length;
  return {
    data,
    withData(newData: unknown) {
      // `<` escaped so no string inside can close the script element
      const serialized = JSON.stringify(newData).replaceAll("<", ESCAPED_LESS_THAN);
      return html.slice(0, iJsonStart) + serialized + html.slice(iJsonStart + json.length);
    }
  };
}
