import { describe, expect, it } from "vitest";

import { HANDLE_CHANNEL, HANDLELESS_CHANNEL } from "#subscription-lists/guide/fixtures/guide-fixtures";

import {
  buildSemiGuideEntry,
  readSemiGuideEntryChannelId,
  readSubscribedGuideEntryChannelId
} from "./semi-guide-entries";

describe("buildSemiGuideEntry", () => {
  it("navigates through YouTube's channel endpoint and is tagged as ours", () => {
    const { guideEntryRenderer } = buildSemiGuideEntry(HANDLE_CHANNEL);

    expect(guideEntryRenderer.navigationEndpoint).toEqual({
      commandMetadata: {
        webCommandMetadata: {
          url: "/@MrBeast",
          webPageType: "WEB_PAGE_TYPE_CHANNEL",
          rootVe: 3611,
          apiUrl: "/youtubei/v1/browse"
        }
      },
      browseEndpoint: {
        browseId: HANDLE_CHANNEL.channelId,
        canonicalBaseUrl: "/@MrBeast"
      }
    });
    expect(guideEntryRenderer.formattedTitle).toEqual({ simpleText: "MrBeast" });
    expect(readSemiGuideEntryChannelId(guideEntryRenderer)).toBe(HANDLE_CHANNEL.channelId);
  });

  it("leaves out the guide entry id YouTube keys subscribe actions on", () => {
    expect(buildSemiGuideEntry(HANDLE_CHANNEL).guideEntryRenderer).not.toHaveProperty("entryData");
  });

  it("uses the avatar when there is one and a generic icon otherwise", () => {
    expect(buildSemiGuideEntry(HANDLE_CHANNEL).guideEntryRenderer).toHaveProperty(
      "thumbnail.thumbnails.0.url",
      HANDLE_CHANNEL.avatarUrl
    );

    const { guideEntryRenderer } = buildSemiGuideEntry(HANDLELESS_CHANNEL);
    expect(guideEntryRenderer).toHaveProperty("icon.iconType", "ACCOUNT_CIRCLE");
    expect(guideEntryRenderer.navigationEndpoint.commandMetadata.webCommandMetadata.url).toBe(
      `/channel/${HANDLELESS_CHANNEL.channelId}`
    );
  });

  it("does not mistake YouTube's own entries for ours", () => {
    expect(
      readSemiGuideEntryChannelId({
        formattedTitle: {
          simpleText: "Home"
        }
      })
    ).toBeNull();
  });
});

describe("readSubscribedGuideEntryChannelId", () => {
  it("reads the channel of YouTube's own subscription entry, and nothing from ours", () => {
    expect(
      readSubscribedGuideEntryChannelId({
        entryData: {
          guideEntryData: {
            guideEntryId: HANDLE_CHANNEL.channelId
          }
        }
      })
    ).toBe(HANDLE_CHANNEL.channelId);
    expect(readSubscribedGuideEntryChannelId(buildSemiGuideEntry(HANDLE_CHANNEL).guideEntryRenderer)).toBeNull();
  });
});
