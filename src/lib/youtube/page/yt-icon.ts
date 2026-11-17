// YouTube's own icons: www's Polymer `<yt-icon icon="icons:...">` (the iron-icons set), and the same filter glyph's
// path for m.youtube.com, which has no Polymer

export enum YtIconName {
  FILTER_LIST = "icons:filter-list"
}

/** The FILTER icon `yt-button-view-model` draws, so the channel button and the lists show the same glyph */
export const FILTER_ICON_PATH =
  "M21 5H3a1 1 0 000 2h18a1 1 0 100-2Zm-3 6H6a1 1 0 000 2h12a1 1 0 000-2Zm-3 6H9a1 1 0 000 2h6a1 1 0 000-2Z";

/** Sets a `yt-icon`'s icon once it is in the page: YouTube's component only picks it up after it has upgraded */
export function attachIcon(icon: YtIconName) {
  return (elIcon: Element) => {
    const frame = requestAnimationFrame(() => {
      elIcon.setAttribute("icon", icon);
    });
    return () => cancelAnimationFrame(frame);
  };
}
