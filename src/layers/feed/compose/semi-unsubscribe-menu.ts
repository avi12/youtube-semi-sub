import { type Lockup, lockupSchema, RendererKind } from "@/lib/youtube/schemas/renderers";
import { z } from "@/lib/zod";
import type { VideoRenderer } from "#feed/items/feed-schemas";

// Adds a "Semi-unsubscribe" item to a built tile's own three-dot menu, in the shape its renderer uses: a lockup's or a
// Short's sheet list (`listItemViewModel`) or a classic renderer's `menuRenderer`. YouTube's own items stay as they are

export const SEMI_UNSUBSCRIBE_LABEL = "Semi-unsubscribe";
const SEMI_UNSUBSCRIBE_ICON = "PERSON_MINUS";
const MORE_ICON = "MORE_VERT";
const MORE_ACCESSIBILITY_TEXT = "More actions";

/** Not a command YouTube knows: the click is taken before YouTube resolves it (see `semi-unsubscribe-click`) */
function semiUnsubscribeCommand(channelId: string) {
  return {
    semiUnsubscribeCommand: {
      channelId
    }
  };
}

function semiUnsubscribeListItem(channelId: string) {
  return {
    listItemViewModel: {
      title: {
        content: SEMI_UNSUBSCRIBE_LABEL
      },
      leadingImage: {
        sources: [{
          clientResource: {
            imageName: SEMI_UNSUBSCRIBE_ICON
          }
        }]
      },
      rendererContext: {
        commandContext: {
          onTap: {
            innertubeCommand: semiUnsubscribeCommand(channelId)
          }
        }
      }
    }
  };
}

function semiUnsubscribeMenuServiceItem(channelId: string) {
  return {
    menuServiceItemRenderer: {
      text: {
        runs: [{ text: SEMI_UNSUBSCRIBE_LABEL }]
      },
      icon: {
        iconType: SEMI_UNSUBSCRIBE_ICON
      },
      serviceEndpoint: semiUnsubscribeCommand(channelId)
    }
  };
}

const listViewModelSchema = z.looseObject({ listItems: z.array(z.unknown()).optional() });

const showSheetCommandSchema = z.looseObject({
  panelLoadingStrategy: z.looseObject({
    inlineContent: z.looseObject({
      sheetViewModel: z.looseObject({
        content: z.looseObject({ listViewModel: listViewModelSchema })
      })
    })
  })
});

const inlineSheetCommandSchema = z.looseObject({ showSheetCommand: showSheetCommandSchema });

const lockupMenuButtonSchema = z.looseObject({
  buttonViewModel: z.looseObject({
    onTap: z.looseObject({ innertubeCommand: inlineSheetCommandSchema })
  })
});

/** A Short's menu is the same inline sheet, opened by the lockup itself */
const shortsMenuSchema = z.looseObject({
  menuOnTap: z.looseObject({ innertubeCommand: inlineSheetCommandSchema })
});

/** A menu button whose sheet loads from the server: its look is kept, its sheet is replaced by an inline one */
const existingButtonSchema = z.looseObject({ buttonViewModel: z.looseObject({}) });

const classicMenuSchema = z.looseObject({
  menuRenderer: z.looseObject({ items: z.array(z.unknown()).optional() })
});

const classicWithMenuSchema = z.looseObject({ menu: classicMenuSchema });

function sheetCommand(listItems: unknown[]) {
  return {
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
  };
}

/** The inline sheet command with the item appended after YouTube's own */
function withSheetItem({ command, ownItem }: {
  command: z.infer<typeof inlineSheetCommandSchema>;
  ownItem: unknown;
}) {
  const { showSheetCommand } = command;
  const { sheetViewModel } = showSheetCommand.panelLoadingStrategy.inlineContent;
  const { listViewModel } = sheetViewModel.content;
  return {
    ...command,
    showSheetCommand: {
      ...showSheetCommand,
      panelLoadingStrategy: {
        ...showSheetCommand.panelLoadingStrategy,
        inlineContent: {
          ...showSheetCommand.panelLoadingStrategy.inlineContent,
          sheetViewModel: {
            ...sheetViewModel,
            content: {
              ...sheetViewModel.content,
              listViewModel: {
                ...listViewModel,
                listItems: [...listViewModel.listItems ?? [], ownItem]
              }
            }
          }
        }
      }
    }
  };
}

function lockupMenuButton({ menuButton, channelId }: {
  menuButton: unknown;
  channelId: string;
}) {
  const parsed = lockupMenuButtonSchema.safeParse(menuButton);
  const ownItem = semiUnsubscribeListItem(channelId);
  if (!parsed.success) {
    const existing = existingButtonSchema.safeParse(menuButton);
    return {
      buttonViewModel: {
        ...existing.success && existing.data.buttonViewModel,
        iconName: MORE_ICON,
        accessibilityText: MORE_ACCESSIBILITY_TEXT,
        onTap: {
          innertubeCommand: sheetCommand([ownItem])
        }
      }
    };
  }

  const { buttonViewModel } = parsed.data;
  return {
    ...parsed.data,
    buttonViewModel: {
      ...buttonViewModel,
      onTap: {
        ...buttonViewModel.onTap,
        innertubeCommand: withSheetItem({
          command: buttonViewModel.onTap.innertubeCommand,
          ownItem
        })
      }
    }
  };
}

/** A Short's menu with the item added - a menu of that item alone when the Short opens none inline */
function withShortsItem({ renderer, channelId }: {
  renderer: object;
  channelId: string;
}) {
  const parsed = shortsMenuSchema.safeParse(renderer);
  const ownItem = semiUnsubscribeListItem(channelId);
  return {
    ...renderer,
    menuOnTap: {
      ...parsed.success && parsed.data.menuOnTap,
      innertubeCommand: parsed.success
        ? withSheetItem({
          command: parsed.data.menuOnTap.innertubeCommand,
          ownItem
        })
        : sheetCommand([ownItem])
    }
  };
}

function withLockupItem({ lockup, channelId }: {
  lockup: Lockup;
  channelId: string;
}) {
  const lockupMetadata = lockup.metadata?.lockupMetadataViewModel;
  return {
    ...lockup,
    metadata: {
      ...lockup.metadata,
      lockupMetadataViewModel: {
        ...lockupMetadata,
        menuButton: lockupMenuButton({
          menuButton: lockupMetadata?.menuButton,
          channelId
        })
      }
    }
  };
}

function withClassicItem({ renderer, channelId }: {
  renderer: object;
  channelId: string;
}) {
  const parsed = classicWithMenuSchema.safeParse(renderer);
  const ownItem = semiUnsubscribeMenuServiceItem(channelId);
  const menuRenderer = parsed.success ? parsed.data.menu.menuRenderer : {};
  return {
    ...renderer,
    menu: {
      ...parsed.success && parsed.data.menu,
      menuRenderer: {
        ...menuRenderer,
        items: [...menuRenderer.items ?? [], ownItem]
      }
    }
  };
}

/** The built renderer with a "Semi-unsubscribe" item appended to its menu (a menu is created when it has none) */
export function withSemiUnsubscribeItem({ kind, renderer, channelId }: {
  kind: VideoRenderer["kind"] | RendererKind.shortsLockupViewModel;
  renderer: object;
  channelId: string;
}) {
  if (kind === RendererKind.shortsLockupViewModel) {
    return withShortsItem({
      renderer,
      channelId
    });
  }

  const parsed = lockupSchema.safeParse(renderer);
  const isLockup = kind === RendererKind.lockupViewModel && parsed.success;
  if (isLockup) {
    return withLockupItem({
      lockup: parsed.data,
      channelId
    });
  }

  return withClassicItem({
    renderer,
    channelId
  });
}
