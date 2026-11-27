import type { composeFeedContents } from "#feed/compose/feed-compose";

export const insertedVideoIds = new Set<string>();

export function recordFeedChange({
  insertedIds,
  removedIds
}: Pick<NonNullable<ReturnType<typeof composeFeedContents>>, "insertedIds" | "removedIds">) {
  for (const videoId of insertedIds) {
    insertedVideoIds.add(videoId);
  }

  for (const videoId of removedIds) {
    insertedVideoIds.delete(videoId);
  }
}
