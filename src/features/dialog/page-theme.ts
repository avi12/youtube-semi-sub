// www.youtube.com marks its dark theme with html[dark]; m.youtube.com may only follow the OS without marking it. The
// page's own text color tells both apart

const DARK_THEME_ATTRIBUTE = "dark";
const COLOR_CHANNEL_PATTERN = /\d+(?:\.\d+)?/g;
const RGB_CHANNEL_COUNT = 3;
const LIGHT_CHANNEL_AVERAGE = 128;

/** "rgb(241, 241, 241)" -> true: light text sits on a dark page */
export function isLightTextColor(color: string) {
  const channels = (color.match(COLOR_CHANNEL_PATTERN) ?? []).slice(0, RGB_CHANNEL_COUNT).map(Number);
  if (channels.length < RGB_CHANNEL_COUNT) {
    return false;
  }

  let channelSum = 0;
  for (const channel of channels) {
    channelSum += channel;
  }
  return channelSum / RGB_CHANNEL_COUNT > LIGHT_CHANNEL_AVERAGE;
}

export function isPageDarkTheme() {
  const elRoot = document.documentElement;
  return elRoot.hasAttribute(DARK_THEME_ATTRIBUTE) || isLightTextColor(getComputedStyle(elRoot).color);
}
