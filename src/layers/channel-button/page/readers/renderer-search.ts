const MAX_SEARCH_DEPTH = 40;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Searches a renderer tree for the first value stored under one of `keys` that `isMatch` accepts */
export function findValueByKey({
  root,
  keys,
  isMatch
}: {
  root: unknown;
  keys: string[];
  isMatch: (candidate: unknown) => boolean;
}) {
  const pending = [
    {
      value: root,
      depth: 0
    }
  ];
  for (let next = pending.pop(); next; next = pending.pop()) {
    const { value, depth } = next;
    const isTooDeep = depth > MAX_SEARCH_DEPTH;
    const isUnsearchable = !isRecord(value) || isTooDeep;
    if (isUnsearchable) {
      continue;
    }

    for (const key of Object.keys(value)) {
      const child = value[key];
      const isWantedMatch = keys.includes(key) && isMatch(child);
      if (isWantedMatch) {
        return child;
      }

      pending.push({
        value: child,
        depth: depth + 1
      });
    }
  }
  return undefined;
}
