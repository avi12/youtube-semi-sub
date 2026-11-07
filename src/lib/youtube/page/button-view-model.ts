import { z } from "@/lib/zod";

// www.youtube.com's Polymer `<yt-button-view-model>`: its rendering is driven by the `.data` property, which only
// exists in the page realm. Values were read from YouTube's own runtime

export enum ButtonViewModelStyle {
  mono = "BUTTON_VIEW_MODEL_STYLE_MONO"
}

export enum ButtonViewModelType {
  filled = "BUTTON_VIEW_MODEL_TYPE_FILLED",
  tonal = "BUTTON_VIEW_MODEL_TYPE_TONAL",
  text = "BUTTON_VIEW_MODEL_TYPE_TEXT"
}

export enum ButtonViewModelSize {
  default = "BUTTON_VIEW_MODEL_SIZE_DEFAULT"
}

export enum ButtonViewModelState {
  active = "BUTTON_VIEW_MODEL_STATE_ACTIVE",
  disabled = "BUTTON_VIEW_MODEL_STATE_DISABLED"
}

/** Icon names `yt-button-view-model` resolves; an unknown name renders no icon */
export enum ButtonViewModelIcon {
  none = "",
  filter = "FILTER",
  close = "CLOSE"
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
