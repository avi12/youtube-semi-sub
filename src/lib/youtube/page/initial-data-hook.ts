import { INITIAL_DATA_GLOBAL } from "@/lib/youtube/initial-data";

// MAIN world, document_start: the one accessor on `ytInitialData`, so every layer sees a hard load's data the moment
// YouTube assigns it - before the app consumes parts of it (it drops `frameworkUpdates` once stored). m.youtube.com
// assigns it twice: first the JSON string, then the parsed object

const interceptors: ((value: unknown) => unknown)[] = [];
let isInstalled = false;

function intercept(value: unknown) {
  let current = value;
  for (const interceptor of interceptors) {
    try {
      current = interceptor(current);
    } catch {
      // A failing interceptor leaves the data as the previous one handed it on
    }
  }
  return current;
}

function installAccessor() {
  let initialData: unknown;
  Object.defineProperty(globalThis, INITIAL_DATA_GLOBAL, {
    configurable: true,
    enumerable: true,
    get() {
      return initialData;
    },
    set(value: unknown) {
      initialData = intercept(value);
    }
  });
}

/** Every assignment of `ytInitialData` passes through `interceptor`, in registration order; it returns what to keep */
export function interceptInitialData(interceptor: (value: unknown) => unknown) {
  interceptors.push(interceptor);

  if (isInstalled) {
    return;
  }

  isInstalled = true;
  installAccessor();
}
