const PLAYER_SELECTOR = ".html5-video-player";

// YouTube keeps the watch page's player mounted but hidden while Shorts plays in its own
export function focusPlayer() {
  for (const elPlayer of document.querySelectorAll<HTMLElement>(PLAYER_SELECTOR)) {
    if (elPlayer.checkVisibility()) {
      elPlayer.focus({ preventScroll: true });
      return;
    }
  }
}
