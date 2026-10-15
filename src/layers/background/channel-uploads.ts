import { fetchRssUploads } from "./rss-feed";
import { fetchVideosTabUploads } from "./videos-tab-uploads";
import type { FeedVideo } from "@/lib/feed-video";

export enum UploadsSource {
  /** Every upload kind, exact publish times */
  rss = "rss",
  /** Regular videos only, publish times approximated from relative text */
  videosTab = "videos-tab"
}

export interface ChannelUploads {
  channelId: string;
  source: UploadsSource;
  /** Newest first */
  videos: FeedVideo[];
}

const pendingFetchByChannel = new Map<string, Promise<ChannelUploads | null>>();

async function fetchFromNetwork(channelId: string) {
  const rssVideos = await fetchRssUploads(channelId);
  if (rssVideos) {
    const uploads: ChannelUploads = {
      channelId,
      source: UploadsSource.rss,
      videos: rssVideos
    };
    return uploads;
  }

  const tabVideos = await fetchVideosTabUploads(channelId);
  if (!tabVideos) {
    return null;
  }

  const uploads: ChannelUploads = {
    channelId,
    source: UploadsSource.videosTab,
    videos: tabVideos
  };
  return uploads;
}

/** RSS first, the Videos tab when RSS fails; concurrent calls for one channel share a single request */
export function fetchChannelUploads(channelId: string) {
  const pending = pendingFetchByChannel.get(channelId);
  if (pending) {
    return pending;
  }

  const request = fetchFromNetwork(channelId).finally(() => pendingFetchByChannel.delete(channelId));
  pendingFetchByChannel.set(channelId, request);
  return request;
}
