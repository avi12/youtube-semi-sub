/** Resolves with the promise's value, or null once the deadline passes (or the promise rejects) */
export function settleBefore<T>({ promise, deadline }: { promise: Promise<T>; deadline: number }) {
  return new Promise<T | null>(resolve => {
    const timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now()));
    function settle(value: T | null) {
      clearTimeout(timer);
      resolve(value);
    }

    promise.then(settle, () => settle(null));
  });
}
