import { describe, expect, it } from "vitest";

import { CHANNEL_ID, desktopChannelTabLockup, shortsLockup, videoId } from "#feed/fixtures/feed-fixtures";
import { RendererKind } from "@/lib/youtube/schemas/renderers";

import { SEMI_UNSUBSCRIBE_LABEL, withSemiUnsubscribeItem } from "./semi-unsubscribe-menu";

const OWN_LIST_ITEM = {
  listItemViewModel: {
    title: {
      content: SEMI_UNSUBSCRIBE_LABEL
    },
    leadingImage: {
      sources: [
        {
          clientResource: {
            imageName: "PERSON_MINUS"
          }
        }
      ]
    },
    rendererContext: {
      commandContext: {
        onTap: {
          innertubeCommand: {
            semiUnsubscribeCommand: {
              channelId: CHANNEL_ID
            }
          }
        }
      }
    }
  }
};

const QUEUE_ITEM = {
  listItemViewModel: {
    title: {
      content: "Add to queue"
    }
  }
};

function inlineSheetButton(listItems: unknown[]) {
  return {
    buttonViewModel: {
      iconName: "MORE_VERT",
      style: "BUTTON_VIEW_MODEL_STYLE_MONO",
      onTap: {
        innertubeCommand: {
          showSheetCommand: {
            panelLoadingStrategy: {
              inlineContent: {
                sheetViewModel: {
                  content: {
                    listViewModel: {
                      listItems
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

function lockupWithMenu(menuButton: unknown) {
  const lockup = desktopChannelTabLockup(1);
  return {
    ...lockup,
    metadata: {
      lockupMetadataViewModel: {
        ...lockup.metadata.lockupMetadataViewModel,
        menuButton
      }
    }
  };
}

function addItem({
  renderer,
  kind = RendererKind.LOCKUP_VIEW_MODEL
}: {
  renderer: object;
  kind?: Parameters<typeof withSemiUnsubscribeItem>[0]["kind"];
}) {
  return withSemiUnsubscribeItem({
    kind,
    renderer,
    channelId: CHANNEL_ID
  });
}

describe("withSemiUnsubscribeItem", () => {
  it("appends the item after YouTube's own in a lockup's inline sheet", () => {
    const original = lockupWithMenu(inlineSheetButton([QUEUE_ITEM]));
    const built = addItem({ renderer: original });
    expect(built).toMatchObject({
      contentId: videoId(1),
      metadata: {
        lockupMetadataViewModel: {
          menuButton: inlineSheetButton([QUEUE_ITEM, OWN_LIST_ITEM])
        }
      }
    });
    expect(original.metadata.lockupMetadataViewModel.menuButton).toEqual(inlineSheetButton([QUEUE_ITEM]));
  });

  it("gives a lockup without a menu one holding only the item", () => {
    const { metadata, ...lockup } = desktopChannelTabLockup(1);
    const { menuButton: menuButton, ...lockupMetadataViewModel } = metadata.lockupMetadataViewModel;
    const built = addItem({
      renderer: {
        ...lockup,
        metadata: {
          lockupMetadataViewModel
        }
      }
    });
    expect(built).toMatchObject({
      metadata: {
        lockupMetadataViewModel: {
          title: {
            content: "Semi video 1"
          },
          menuButton: {
            buttonViewModel: {
              iconName: "MORE_VERT",
              onTap: inlineSheetButton([OWN_LIST_ITEM]).buttonViewModel.onTap
            }
          }
        }
      }
    });
  });

  it("keeps the look of a menu button whose sheet is not inline", () => {
    const built = addItem({
      renderer: lockupWithMenu({
        buttonViewModel: {
          iconName: "MORE_VERT",
          style: "BUTTON_VIEW_MODEL_STYLE_MONO",
          onTap: {
            innertubeCommand: {
              showSheetCommand: {
                panelLoadingStrategy: {
                  requestTemplate: {}
                }
              }
            }
          }
        }
      })
    });
    expect(built).toMatchObject({
      metadata: {
        lockupMetadataViewModel: {
          menuButton: inlineSheetButton([OWN_LIST_ITEM])
        }
      }
    });
  });

  it("appends a menu service item to a classic renderer's menu", () => {
    const ownServiceItem = {
      menuServiceItemRenderer: {
        text: {
          runs: [{ text: SEMI_UNSUBSCRIBE_LABEL }]
        },
        icon: {
          iconType: "PERSON_MINUS"
        },
        serviceEndpoint: {
          semiUnsubscribeCommand: {
            channelId: CHANNEL_ID
          }
        }
      }
    };
    const queueItem = {
      menuServiceItemRenderer: {
        text: {
          runs: [{ text: "Add to queue" }]
        }
      }
    };
    const withMenu = addItem({
      renderer: {
        videoId: videoId(1),
        menu: {
          menuRenderer: {
            items: [queueItem],
            trackingParams: "x"
          }
        }
      },
      kind: RendererKind.VIDEO_WITH_CONTEXT_RENDERER
    });
    expect(withMenu).toEqual({
      videoId: videoId(1),
      menu: {
        menuRenderer: {
          items: [queueItem, ownServiceItem],
          trackingParams: "x"
        }
      }
    });

    const withoutMenu = addItem({
      renderer: {
        videoId: videoId(1)
      },
      kind: RendererKind.VIDEO_WITH_CONTEXT_RENDERER
    });
    expect(withoutMenu).toEqual({
      videoId: videoId(1),
      menu: {
        menuRenderer: {
          items: [ownServiceItem]
        }
      }
    });
  });

  it("appends the item after YouTube's own in a Short's menu", () => {
    const original = shortsLockup({ index: 50 });
    const built = addItem({
      renderer: original,
      kind: RendererKind.SHORTS_LOCKUP_VIEW_MODEL
    });
    const hideItem =
      original.menuOnTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel.content
        .listViewModel.listItems[0];
    expect(built).toMatchObject({
      overlayMetadata: original.overlayMetadata,
      menuOnTap: {
        innertubeCommand: {
          showSheetCommand: {
            panelLoadingStrategy: {
              inlineContent: {
                sheetViewModel: {
                  content: {
                    listViewModel: {
                      listItems: [hideItem, OWN_LIST_ITEM]
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  it("gives a Short without a menu one holding only the item", () => {
    const { menuOnTap, ...withoutMenu } = shortsLockup({ index: 50 });
    const built = addItem({
      renderer: withoutMenu,
      kind: RendererKind.SHORTS_LOCKUP_VIEW_MODEL
    });
    expect(menuOnTap).toBeDefined();
    expect(built).toMatchObject({
      menuOnTap: {
        innertubeCommand: {
          showSheetCommand: {
            panelLoadingStrategy: {
              inlineContent: {
                sheetViewModel: {
                  content: {
                    listViewModel: {
                      listItems: [OWN_LIST_ITEM]
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });
});
