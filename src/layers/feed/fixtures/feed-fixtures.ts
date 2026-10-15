import type { FeedVideo } from "@/lib/schemas/feed-video";

// Test data trimmed from real InnerTube payloads: www (WEB client) feed lockups carry the channel on a row of
// its own, m (MWEB client) feed lockups lead their single row with it; channel Videos tabs omit it entirely

export const NOW = Date.UTC(2026, 9, 15, 12);
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export const CHANNEL_ID = "UCsemisubscribedchannel1";
const OTHER_CHANNEL_ID = "UCalreadysubscribedchan2";

export function videoId(index: number) {
  return `video${String(index).padStart(6, "0")}`;
}

function hoursAgo(hours: number) {
  return NOW - hours * MILLISECONDS_PER_HOUR;
}

export function feedVideo({ index, hours, channelId = CHANNEL_ID }: {
  index: number;
  hours: number;
  channelId?: string;
}) {
  return {
    videoId: videoId(index),
    channelId,
    channelTitle: "Semi Channel",
    title: `Semi video ${index}`,
    publishedAt: hoursAgo(hours),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId(index)}/hqdefault.jpg`
  } satisfies FeedVideo;
}

function avatarImage(channelTitle: string) {
  return {
    decoratedAvatarViewModel: {
      avatar: {
        avatarViewModel: {
          image: {
            sources: [{ url: "https://yt3.ggpht.com/other=s68" }]
          },
          avatarImageSize: "AVATAR_SIZE_M"
        }
      },
      a11yLabel: `Go to channel ${channelTitle}`,
      rendererContext: {
        commandContext: {
          onTap: {
            innertubeCommand: {
              browseEndpoint: {
                browseId: OTHER_CHANNEL_ID
              }
            }
          }
        }
      }
    }
  };
}

function thumbnailViewModel(id: string) {
  return {
    image: {
      sources: [{ url: `https://i.ytimg.com/vi/${id}/hq720.jpg` }]
    },
    overlays: [{
      thumbnailBottomOverlayViewModel: {
        badges: [{
          thumbnailBadgeViewModel: {
            text: "11:47",
            rendererContext: {
              accessibilityContext: {
                label: "11 minutes, 47 seconds"
              }
            }
          }
        }]
      }
    }]
  };
}

export function richItem(content: Record<string, unknown>) {
  return {
    richItemRenderer: {
      content
    }
  };
}

/** A subscriptions-feed tile of a subscribed channel; www and m only lay out its metadata rows differently */
function subscribedFeedItem({ index, contentMetadataViewModel }: {
  index: number;
  contentMetadataViewModel: Record<string, unknown>;
}) {
  return richItem({
    lockupViewModel: {
      contentId: videoId(index),
      contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
      contentImage: {
        thumbnailViewModel: thumbnailViewModel(videoId(index))
      },
      metadata: {
        lockupMetadataViewModel: {
          title: {
            content: `Subscribed video ${index}`
          },
          image: avatarImage("Subscribed Channel"),
          metadata: {
            contentMetadataViewModel
          }
        }
      }
    }
  });
}

/** A www subscriptions-feed tile: channel row, then views and published time */
export function desktopFeedItem({ index, published }: {
  index: number;
  published: string;
}) {
  return subscribedFeedItem({
    index,
    contentMetadataViewModel: {
      metadataRows: [
        {
          metadataParts: [{
            text: {
              content: "Subscribed Channel"
            }
          }]
        },
        {
          metadataParts: [
            {
              text: {
                content: "13M"
              },
              accessibilityLabel: "13 million views"
            },
            {
              text: {
                content: published
              }
            }
          ]
        }
      ],
      delimiter: " "
    }
  });
}

/** An m subscriptions-feed tile: one row led by the channel name */
export function mobileFeedItem({ index, published }: {
  index: number;
  published: string;
}) {
  return subscribedFeedItem({
    index,
    contentMetadataViewModel: {
      metadataRows: [{
        metadataParts: [
          {
            text: {
              content: "Subscribed Channel"
            }
          },
          {
            text: {
              content: "4.5M views"
            }
          },
          {
            text: {
              content: published
            },
            accessibilityLabel: published
          }
        ]
      }],
      delimiter: " • "
    }
  });
}

/** A www channel Videos-tab tile: no channel row, no avatar, but a menu */
export function desktopChannelTabLockup(index: number) {
  return {
    contentId: videoId(index),
    contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
    contentImage: {
      thumbnailViewModel: thumbnailViewModel(videoId(index))
    },
    metadata: {
      lockupMetadataViewModel: {
        title: {
          content: `Semi video ${index}`
        },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [{
              metadataParts: [
                {
                  text: {
                    content: "6.8M"
                  },
                  accessibilityLabel: "6.8 million views"
                },
                {
                  text: {
                    content: "1d ago"
                  },
                  accessibilityLabel: "1 day ago"
                }
              ]
            }],
            delimiter: " "
          }
        },
        menuButton: {
          buttonViewModel: {
            iconName: "MORE_VERT"
          }
        }
      }
    }
  };
}

/** An m channel Videos-tab tile */
export function mobileChannelTabRenderer(index: number) {
  return {
    videoId: videoId(index),
    title: {
      runs: [{ text: `Semi video ${index}` }]
    },
    thumbnail: {
      thumbnails: [{ url: `https://i.ytimg.com/vi/${videoId(index)}/hq720.jpg` }]
    },
    publishedTimeText: {
      runs: [{ text: "1 day ago" }]
    },
    shortViewCountText: {
      runs: [{ text: "6.8M views" }]
    },
    lengthText: {
      runs: [{ text: "11:47" }],
      accessibility: {
        accessibilityData: {
          label: "11 minutes, 47 seconds"
        }
      }
    },
    navigationEndpoint: {
      watchEndpoint: {
        videoId: videoId(index)
      }
    }
  };
}

export function contextRendererItem({ index, published }: {
  index: number;
  published: string;
}) {
  return richItem({
    videoWithContextRenderer: {
      videoId: videoId(index),
      headline: {
        runs: [{ text: `Subscribed video ${index}` }]
      },
      publishedTimeText: {
        runs: [{ text: published }]
      }
    }
  });
}

export function shortsShelf(indexes: number[]) {
  return {
    richSectionRenderer: {
      content: {
        richShelfRenderer: {
          title: {
            runs: [{ text: "Shorts" }]
          },
          contents: indexes.map(index => richItem({
            shortsLockupViewModel: {
              onTap: {
                innertubeCommand: {
                  reelWatchEndpoint: {
                    videoId: videoId(index)
                  }
                }
              }
            }
          }))
        }
      }
    }
  };
}

export function continuationItem() {
  return {
    continuationItemRenderer: {
      continuationEndpoint: {
        continuationCommand: {
          token: "next-page"
        }
      }
    }
  };
}

function trackingParams(browseId: string) {
  return {
    serviceTrackingParams: [{
      service: "GFEEDBACK",
      params: [{
        key: "browse_id",
        value: browseId
      }]
    }]
  };
}

export function desktopFeedResponse(contents: unknown[]) {
  return {
    responseContext: trackingParams("FEsubscriptions"),
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [{
          tabRenderer: {
            selected: true,
            content: {
              richGridRenderer: {
                contents
              }
            }
          }
        }]
      }
    },
    header: {
      feedTabbedHeaderRenderer: {}
    }
  };
}

export function mobileFeedResponse(contents: unknown[]) {
  return {
    responseContext: {},
    contents: {
      singleColumnBrowseResultsRenderer: {
        tabs: [{
          tabRenderer: {
            tabIdentifier: "FEsubscriptions",
            content: {
              richGridRenderer: {
                contents,
                targetId: "browse-feedFEsubscriptions"
              }
            }
          }
        }]
      }
    }
  };
}

export function channelVideosTabResponse(contents: unknown[]) {
  return {
    responseContext: trackingParams(CHANNEL_ID),
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              title: "Home"
            }
          },
          {
            tabRenderer: {
              title: "Videos",
              selected: true,
              content: {
                richGridRenderer: {
                  contents
                }
              }
            }
          }
        ]
      }
    },
    metadata: {
      channelMetadataRenderer: {
        avatar: {
          thumbnails: [{ url: "https://yt3.googleusercontent.com/semi=s900" }]
        }
      }
    }
  };
}
