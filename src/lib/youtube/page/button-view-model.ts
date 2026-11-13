import { z } from "@/lib/zod";

// www.youtube.com's Polymer `<yt-button-view-model>`: its rendering is driven by the `.data` property, which only
// exists in the page realm. Values were read from YouTube's own runtime

export enum ButtonViewModelStyle {
  MONO = "BUTTON_VIEW_MODEL_STYLE_MONO"
}

export enum ButtonViewModelType {
  FILLED = "BUTTON_VIEW_MODEL_TYPE_FILLED",
  TONAL = "BUTTON_VIEW_MODEL_TYPE_TONAL",
  TEXT = "BUTTON_VIEW_MODEL_TYPE_TEXT"
}

export enum ButtonViewModelSize {
  DEFAULT = "BUTTON_VIEW_MODEL_SIZE_DEFAULT"
}

export enum ButtonViewModelState {
  ACTIVE = "BUTTON_VIEW_MODEL_STATE_ACTIVE",
  DISABLED = "BUTTON_VIEW_MODEL_STATE_DISABLED"
}

/** Icon names `yt-button-view-model` resolves; an unknown name renders no icon */
export enum ButtonViewModelIcon {
  NONE = "",
  FILTER = "FILTER",
  CLOSE = "CLOSE",
  EXPAND_MORE = "EXPAND_MORE",
  EXPAND_LESS = "EXPAND_LESS"
}

const buttonViewModelDataSchema = z.object({
  title: z.string().optional(),
  iconName: z.enum(ButtonViewModelIcon),
  accessibilityText: z.string(),
  style: z.enum(ButtonViewModelStyle),
  type: z.enum(ButtonViewModelType),
  buttonSize: z.enum(ButtonViewModelSize),
  state: z.enum(ButtonViewModelState),
  isFullWidth: z.boolean()
});
export type ButtonViewModelData = z.infer<typeof buttonViewModelDataSchema>;
