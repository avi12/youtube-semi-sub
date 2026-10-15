// www.youtube.com (Polymer) fires yt-navigate-finish; m.youtube.com fires state-navigateend
const NAVIGATION_FINISH_EVENTS = ["yt-navigate-finish", "state-navigateend"] as const;

/** Calls back after every YouTube SPA navigation, at most once per URL change */
export function onYouTubeNavigate(callback: () => void) {
  let lastHref = "";
  function handleNavigation() {
    const isSameUrl = location.href === lastHref;
    if (isSameUrl) {
      return;
    }

    lastHref = location.href;
    callback();
  }

  for (const eventName of NAVIGATION_FINISH_EVENTS) {
    document.addEventListener(eventName, handleNavigation);
    addEventListener(eventName, handleNavigation);
  }

  addEventListener("popstate", handleNavigation);
  return () => {
    for (const eventName of NAVIGATION_FINISH_EVENTS) {
      document.removeEventListener(eventName, handleNavigation);
      removeEventListener(eventName, handleNavigation);
    }

    removeEventListener("popstate", handleNavigation);
  };
}
