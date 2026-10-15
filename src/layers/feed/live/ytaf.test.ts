import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

type YtafModule = typeof import("#feed/live/ytaf");

const REQUEST_EVENT = "@webext-core/messaging/custom-events";
const RESPONSE_EVENT = "@webext-core/messaging/custom-events/response";

let ytaf: YtafModule;
let page: EventTarget;

function dispatch({ eventName, detail }: {
  eventName: string;
  detail: unknown;
}) {
  page.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function pushSettings(isExtensionEnabled: boolean) {
  dispatch({
    eventName: REQUEST_EVENT,
    detail: {
      namespace: "ytaf-settings",
      instanceId: "bridge",
      message: {
        id: 1,
        type: "settingsChanged",
        data: {
          isExtensionEnabled,
          isAnimationsEnabled: true,
          isVideoPageUpdatesEnabled: false
        },
        timestamp: 1
      }
    }
  });
}

beforeEach(async () => {
  page = new EventTarget();
  vi.stubGlobal("addEventListener", page.addEventListener.bind(page));
  vi.stubGlobal("__ytafFeedMessenger", {});
  vi.resetModules();
  ytaf = await import("#feed/live/ytaf");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isYouTubeAutoFeedActive", () => {
  it("counts ytaf as running only while it is installed", () => {
    expect(ytaf.isYouTubeAutoFeedActive()).toBe(true);
    vi.unstubAllGlobals();
    expect(ytaf.isYouTubeAutoFeedActive()).toBe(false);
  });

  it("follows ytaf being switched off and on, from its bridge's push and from its startup reply", () => {
    const callback = vi.fn();
    ytaf.watchYouTubeAutoFeedSwitch(callback);

    pushSettings(false);
    expect(ytaf.isYouTubeAutoFeedActive()).toBe(false);

    dispatch({
      eventName: RESPONSE_EVENT,
      detail: {
        namespace: "ytaf-settings",
        instanceId: "bridge",
        message: {
          id: 2,
          type: "getSettings",
          timestamp: 2
        },
        response: {
          res: {
            isExtensionEnabled: true,
            isAnimationsEnabled: true,
            isVideoPageUpdatesEnabled: false
          }
        }
      }
    });
    expect(ytaf.isYouTubeAutoFeedActive()).toBe(true);

    pushSettings(true);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("ignores every other messenger's traffic", () => {
    const callback = vi.fn();
    ytaf.watchYouTubeAutoFeedSwitch(callback);
    dispatch({
      eventName: REQUEST_EVENT,
      detail: {
        namespace: "youtube-semi-sub",
        message: {
          type: "settingsChanged",
          data: {
            isExtensionEnabled: false
          }
        }
      }
    });
    expect(ytaf.isYouTubeAutoFeedActive()).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });
});
