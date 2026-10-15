import { z } from "@/lib/zod";

// InnerTube text: a plain `simpleText`, or `runs` of pieces that may each carry their own link

export const textRunSchema = z.looseObject({
  text: z.string()
});

const textSchema = z.looseObject({
  simpleText: z.string().optional(),
  runs: z.array(textRunSchema).optional()
});
type InnerTubeText = z.infer<typeof textSchema>;

const accessibilitySchema = z.looseObject({
  accessibilityData: z.looseObject({ label: z.string() }).optional()
});

/** Text with the screen-reader label YouTube adds to durations, view counts and dates */
export const formattedTextSchema = textSchema.extend({
  accessibility: accessibilitySchema.optional()
});
export type FormattedText = z.infer<typeof formattedTextSchema>;

/** The text as shown, runs joined; empty when there is none */
export function readText(text: InnerTubeText | undefined) {
  return text?.simpleText ?? text?.runs?.map(run => run.text).join("") ?? "";
}
