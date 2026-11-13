import { z } from "@/lib/zod";

const DIGITS_PATTERN = /^\d+$/;

// Lenient on purpose: a small model may quote numbers or booleans, or drop the wrapping object. Each verdict is
// checked on its own, so one malformed entry costs only its own video
const modelVerdictSchema = z.object({
  id: z.union([z.int(), z.string().regex(DIGITS_PATTERN).transform(Number)]),
  match: z.union([z.boolean(), z.stringbool()])
});

const modelReplySchema = z.union([
  z.object({
    verdicts: z.array(z.unknown())
  }),
  z.array(z.unknown()).transform(verdicts => ({ verdicts }))
]);

/**
 * The model's verdicts by video id (1..count). Ids outside the batch are ignored, the first verdict for an id wins,
 * and an id the model skipped stays out of the map - that video stays pending rather than guessed
 */
export function parseVerdictReply({ reply, count }: { reply: unknown; count: number }) {
  const verdictsById = new Map<number, boolean>();
  const parsed = modelReplySchema.safeParse(reply);
  if (!parsed.success) {
    return verdictsById;
  }

  for (const entry of parsed.data.verdicts) {
    const verdict = modelVerdictSchema.safeParse(entry);
    if (!verdict.success) {
      continue;
    }

    const { id, match } = verdict.data;
    const isNewIdInBatch = id >= 1 && id <= count && !verdictsById.has(id);
    if (isNewIdInBatch) {
      verdictsById.set(id, match);
    }
  }
  return verdictsById;
}
