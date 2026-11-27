import { describe, expect, it } from "vitest";

import { MKBHD_ID, RICK_ASTLEY_ID } from "#channel-button/page/fixtures/channel-ids";

import { readSubscriptionEntities } from "./subscription-state";

describe("readSubscriptionEntities", () => {
  it("maps each subscription entity to the channel id its key encodes", () => {
    const entities = readSubscriptionEntities({
      frameworkUpdates: {
        entityBatchUpdate: {
          mutations: [
            {
              payload: {
                subscriptionStateEntity: {
                  key: "EhhVQ3VBWEZrZ3N3MUw3eGFDZm5kNUpKT3cgMygB",
                  subscribed: false
                }
              }
            },
            {
              payload: {
                subscriptionStateEntity: {
                  key: "EhhVQ0JKeWNzbWR1dllFTDgzUl9VNEpyaVEgMygB",
                  subscribed: true
                }
              }
            },
            {
              payload: {
                likeStatusEntity: {
                  key: "x"
                }
              }
            },
            {
              payload: {
                subscriptionStateEntity: {
                  key: "not base64!",
                  subscribed: true
                }
              }
            }
          ]
        }
      }
    });
    expect([...entities]).toEqual([
      [RICK_ASTLEY_ID, false],
      [MKBHD_ID, true]
    ]);
  });

  it("returns nothing for a response without framework updates", () => {
    expect(readSubscriptionEntities({}).size).toBe(0);
  });
});
