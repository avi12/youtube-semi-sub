import { PageMessage, pageMessenger, type PageState, pageStateSchema } from "@/lib/messaging/page-messaging";

// MAIN world: the read-only mirror of the extension state the ISOLATED bridge owns

const listeners = new Set<(state: PageState) => void>();
let currentState: PageState | null = null;

function applyIncomingState(incoming: unknown) {
  const parsed = pageStateSchema.safeParse(incoming);
  if (!parsed.success) {
    return;
  }

  currentState = parsed.data;
  for (const listener of listeners) {
    listener(parsed.data);
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

export function initPageState() {
  pageMessenger.onMessage(PageMessage.pageStateChanged, ({ data }) => applyIncomingState(data));
  // The bridge may not be listening yet; it also pushes pageStateChanged once ready, so a lost request is harmless
  pageMessenger.sendMessage(PageMessage.getPageState).then(applyIncomingState).catch(() => {});
}
