/** Like `Promise.all(items.map(task))`, but with at most `limit` tasks in flight; results keep the input order */
export async function mapWithConcurrency<Item, Result>({
  items,
  limit,
  task
}: {
  items: Item[];
  limit: number;
  task: (item: Item) => Promise<Result>;
}) {
  const results: Result[] = [];
  // The workers share one iterator, so every item is taken exactly once
  const entries = items.entries();

  async function runWorker() {
    for (const [i, item] of entries) {
      results[i] = await task(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}
