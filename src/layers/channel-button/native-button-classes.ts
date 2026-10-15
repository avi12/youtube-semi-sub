// m.youtube.com has no Polymer `yt-button-view-model`, so the button reuses the classes of YouTube's own Subscribe
// button, switched from filled to tonal. YouTube ships both camelCase class names and the older BEM ones

const CAMEL_CASE_CLASS_NAMES = {
  host: "ytSpecButtonViewModelHost",
  filled: "ytSpecButtonShapeNextFilled",
  tonal: "ytSpecButtonShapeNextTonal",
  iconLeading: "ytSpecButtonShapeNextIconLeading",
  icon: "ytSpecButtonShapeNextIcon",
  text: "ytSpecButtonShapeNextButtonTextContent"
};

const BEM_CLASS_NAMES: typeof CAMEL_CASE_CLASS_NAMES = {
  host: "yt-spec-button-view-model",
  filled: "yt-spec-button-shape-next--filled",
  tonal: "yt-spec-button-shape-next--tonal",
  iconLeading: "yt-spec-button-shape-next--icon-leading",
  icon: "yt-spec-button-shape-next__icon",
  text: "yt-spec-button-shape-next__button-text-content"
};

const BEM_PREFIX = "yt-spec-button-shape-next";
const ICON_LAYOUT_CLASS_PATTERN = /IconLeading|IconTrailing|IconButton|--icon-/;

export function buildNativeButtonClasses(subscribeButtonClass: string) {
  const tokens = subscribeButtonClass.split(/\s+/).filter(Boolean);
  const isBemNaming = tokens.some(token => token.startsWith(BEM_PREFIX));
  const classNames = isBemNaming ? BEM_CLASS_NAMES : CAMEL_CASE_CLASS_NAMES;
  const buttonTokens = new Set(tokens
    .filter(token => !ICON_LAYOUT_CLASS_PATTERN.test(token))
    .map(token => token === classNames.filled ? classNames.tonal : token));
  buttonTokens.add(classNames.tonal);

  const button = [...buttonTokens].join(" ");
  return {
    host: classNames.host,
    button,
    buttonWithIcon: `${button} ${classNames.iconLeading}`,
    icon: classNames.icon,
    text: classNames.text
  };
}

export type NativeButtonClasses = ReturnType<typeof buildNativeButtonClasses>;
