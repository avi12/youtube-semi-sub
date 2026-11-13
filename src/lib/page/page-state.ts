import { PageMessage, pageMessenger, type PageState } from "@/lib/messaging/page-messaging";

// MAIN world: the read-only mirror of the extension state the ISOLATED bridge owns

const listeners = new Set<(state: PageState) => void>();
let currentState: PageState | null = null;

function applyIncomingState(incoming: PageState | null) {
  if (!incoming) {
    return;
  }

  currentState = incoming;
  for (const listener of listeners) {
    listener(incoming);
  }
}

export function getPageState() {
  return currentState;
}

/** Calls back with every new state, and immediately with the current one when it is already known */
export function onPageState(listener: (state: PageState) => void) {
  listeners.add(listener);

  if (currentState) {
    listener(currentState);
  }

  return () => {
    listeners.delete(listener);
  };
}

/** Calls back once: with the current state when it is known already, else with the first one to arrive */
export function whenPageStateKnown(listener: (state: PageState) => void) {
  if (currentState) {
    listener(currentState);
    return;
  }

  const stopListening = onPageState(state => {
    stopListening();
    listener(state);
  });
}

export function initPageState() {
  pageMessenger.onMessage(PageMessage.PAGE_STATE_CHANGED, state => applyIncomingState(state));
  // The bridge may not be listening yet; it also pushes pageStateChanged once ready, so a lost request is harmless
  pageMessenger
    .sendMessage(PageMessage.GET_PAGE_STATE)
    .then(applyIncomingState)
    .catch(() => {});
}
