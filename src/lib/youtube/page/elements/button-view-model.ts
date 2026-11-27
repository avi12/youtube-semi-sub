import { z } from "@/lib/zod";

// www.youtube.com's Polymer `<yt-button-view-model>`: its rendering is driven by the `.data` property, which only
// exists in the page realm. The style, type, size and state lists are every value YouTube's app bundle names

export enum ButtonViewModelStyle {
  MONO = "BUTTON_VIEW_MODEL_STYLE_MONO",
  BRAND = "BUTTON_VIEW_MODEL_STYLE_BRAND",
  BRAND_AI = "BUTTON_VIEW_MODEL_STYLE_BRAND_AI",
  BRAND_GRADIENT = "BUTTON_VIEW_MODEL_STYLE_BRAND_GRADIENT",
  CTA = "BUTTON_VIEW_MODEL_STYLE_CTA",
  CUSTOM = "BUTTON_VIEW_MODEL_STYLE_CUSTOM",
  CUSTOM_OVERLAY = "BUTTON_VIEW_MODEL_STYLE_CUSTOM_OVERLAY",
  OVERLAY = "BUTTON_VIEW_MODEL_STYLE_OVERLAY",
  OVERLAY_DARK = "BUTTON_VIEW_MODEL_STYLE_OVERLAY_DARK",
  RAISED = "BUTTON_VIEW_MODEL_STYLE_RAISED",
  UNKNOWN = "BUTTON_VIEW_MODEL_STYLE_UNKNOWN"
}

export enum ButtonViewModelType {
  FILLED = "BUTTON_VIEW_MODEL_TYPE_FILLED",
  TONAL = "BUTTON_VIEW_MODEL_TYPE_TONAL",
  TEXT = "BUTTON_VIEW_MODEL_TYPE_TEXT",
  OUTLINE = "BUTTON_VIEW_MODEL_TYPE_OUTLINE"
}

export enum ButtonViewModelSize {
  DEFAULT = "BUTTON_VIEW_MODEL_SIZE_DEFAULT",
  XSMALL = "BUTTON_VIEW_MODEL_SIZE_XSMALL",
  COMPACT = "BUTTON_VIEW_MODEL_SIZE_COMPACT",
  MEDIUM = "BUTTON_VIEW_MODEL_SIZE_MEDIUM",
  LARGE = "BUTTON_VIEW_MODEL_SIZE_LARGE",
  XLARGE = "BUTTON_VIEW_MODEL_SIZE_XLARGE"
}

export enum ButtonViewModelState {
  ACTIVE = "BUTTON_VIEW_MODEL_STATE_ACTIVE",
  INACTIVE = "BUTTON_VIEW_MODEL_STATE_INACTIVE",
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
