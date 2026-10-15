// www.youtube.com's Polymer `<yt-button-view-model>`: its rendering is driven by the `.data` property, which only
// exists in the page realm. Values were read from YouTube's own runtime

export enum ButtonViewModelStyle {
  mono = "BUTTON_VIEW_MODEL_STYLE_MONO"
}

export enum ButtonViewModelType {
  tonal = "BUTTON_VIEW_MODEL_TYPE_TONAL"
}

export enum ButtonViewModelSize {
  default = "BUTTON_VIEW_MODEL_SIZE_DEFAULT"
}

export enum ButtonViewModelState {
  active = "BUTTON_VIEW_MODEL_STATE_ACTIVE"
}

/** Icon names `yt-button-view-model` resolves; an unknown name renders no icon */
export enum ButtonViewModelIcon {
  none = "",
  filter = "FILTER"
}

export interface ButtonViewModelData {
  title: string;
  iconName: ButtonViewModelIcon;
  accessibilityText: string;
  style: ButtonViewModelStyle;
  type: ButtonViewModelType;
  buttonSize: ButtonViewModelSize;
  state: ButtonViewModelState;
  isFullWidth: boolean;
}

export interface YtButtonViewModelElement extends HTMLElement {
  data: ButtonViewModelData;
}

declare global {
  interface HTMLElementTagNameMap {
    "yt-button-view-model": YtButtonViewModelElement;
  }
}
