export enum ToastMessage {
  SEMI_SUBSCRIBED = "Semi-subscribed - matching videos will show up in your feed",
  FILTER_SAVED = "Filter saved - your feed follows it right away",
  HIDE_FILTER_SAVED = "Filter saved - matching videos are hidden from your feed",
  REMOVED = "Semi-subscription removed",
  HIDE_FILTER_REMOVED = "Filter removed - you'll see all their videos again"
}

/** The values of `dir` m.youtube.com's stylesheet slides its `c3-toast` by */
export enum MobileToastDirection {
  ENTERING = "in",
  LEAVING = "out"
}
