import { pageDataSchema, PageKind } from "#channel-button/page/page-channel-schema";
import { readChannelPageChannel } from "#channel-button/page/readers/channel-page";
import { readWatchChannel } from "#channel-button/page/readers/watch-page";

// Pure readers over a page's InnerTube data ({ response, playerResponse }), shared by www and m.youtube.com

/**
 * The channel the current page is about, whatever its URL: a channel page's data carries the channel's metadata, a
 * watch page's the video's details, so the content says which kind of page it is (`/@handle`, `/c/`, `/user/`, a
 * custom URL and a legacy id all read alike)
 */
export function readPageChannelByContent(pageData: unknown) {
  return (
    readPageChannel({
      pageData,
      kind: PageKind.CHANNEL
    }) ??
    readPageChannel({
      pageData,
      kind: PageKind.WATCH
    })
  );
}

/**
 * The channel a watch or channel page is about, read from the page's data, plus what the data says about the viewer's
 * relation to it. `hasSubscribeControl` is false on a channel page without YouTube's Subscribe button - the viewer's
 * own channel when signed in
 */
export function readPageChannel({ pageData, kind }: { pageData: unknown; kind: PageKind }) {
  const parsed = pageDataSchema.safeParse(pageData);
  if (!parsed.success) {
    return null;
  }

  if (kind === PageKind.WATCH) {
    return readWatchChannel(parsed.data);
  }

  return readChannelPageChannel(parsed.data.response);
}
