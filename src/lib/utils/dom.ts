export const SUBTREE_CHILD_LIST: MutationObserverInit = {
  childList: true,
  subtree: true
};

/** Coalesces any number of calls within a frame into one run on the next frame */
export function createFrameScheduler(callback: () => void) {
  let isScheduled = false;
  return function schedule() {
    if (isScheduled) {
      return;
    }

    isScheduled = true;
    requestAnimationFrame(() => {
      isScheduled = false;
      callback();
    });
  };
}

export function whenDocumentParsed() {
  const isParsing = document.readyState === "loading";
  if (!isParsing) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

/** Resolves once the tab is shown - a grid written while it is hidden never renders what it was given */
export function whenDocumentVisible() {
  const isVisible = document.visibilityState === "visible";
  if (isVisible) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    const controller = new AbortController();
    document.addEventListener(
      "visibilitychange",
      () => {
        const isShown = document.visibilityState === "visible";
        if (!isShown) {
          return;
        }

        controller.abort();
        resolve();
      },
      { signal: controller.signal }
    );
  });
}

/** Resolves once `selector` matches - watches the document only until then */
export function waitForElement(selector: string) {
  const elExisting = document.querySelector(selector);
  if (elExisting) {
    return Promise.resolve(elExisting);
  }

  return new Promise<Element>(resolve => {
    const observer = new MutationObserver(() => {
      const elFound = document.querySelector(selector);
      if (!elFound) {
        return;
      }

      observer.disconnect();
      resolve(elFound);
    });
    observer.observe(document, SUBTREE_CHILD_LIST);
  });
}

export function observeSubtree({ elements, onChange }: { elements: Iterable<Element>; onChange: () => void }) {
  const observer = new MutationObserver(onChange);
  for (const element of elements) {
    observer.observe(element, SUBTREE_CHILD_LIST);
  }
  return observer;
}
