import { describe, expect, it } from "vitest";

import { isMembersOnlyClassicRenderer, isMembersOnlyLockup } from "./members-only";

describe("isMembersOnlyLockup", () => {
  it("reads the badge on a lockup's metadata row, as a real Videos tab writes it", () => {
    const lockup = {
      contentId: "CNbsMah32Ss",
      metadata: {
        lockupMetadataViewModel: {
          metadata: {
            contentMetadataViewModel: {
              metadataRows: [
                {
                  metadataParts: [
                    {
                      text: {
                        content: "2d ago"
                      }
                    }
                  ]
                },
                {
                  badges: [
                    {
                      badgeViewModel: {
                        badgeText: "Members only",
                        badgeStyle: "BADGE_MEMBERS_ONLY"
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
      }
    };
    expect(isMembersOnlyLockup(lockup)).toBe(true);
    expect(isMembersOnlyLockup({ contentId: "QVv3mQzlrN0" })).toBe(false);
  });
});

describe("isMembersOnlyClassicRenderer", () => {
  it("reads m's badge list", () => {
    expect(
      isMembersOnlyClassicRenderer({
        videoId: "CNbsMah32Ss",
        badges: [
          {
            metadataBadgeRenderer: {
              style: "BADGE_STYLE_TYPE_MEMBERS_ONLY"
            }
          }
        ]
      })
    ).toBe(true);
    expect(isMembersOnlyClassicRenderer({ videoId: "QVv3mQzlrN0" })).toBe(false);
  });
});
