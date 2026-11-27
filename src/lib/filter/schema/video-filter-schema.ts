import { z } from "@/lib/zod";

export enum FilterKind {
  REGEX = "regex",
  /** A plain-language description a model judges per video */
  AI_MATCH = "ai",
  /** How long a video runs */
  LENGTH = "length",
  /** Whether a video is a regular one, a Short or a live stream */
  TYPE = "type",
  /** Several conditions, all or any of which a video has to meet */
  GROUP = "group"
}

/** What a condition judges a video by - a filter holds at most one condition per method */
export enum FilterMethod {
  TITLE = "title",
  LENGTH = "length",
  TYPE = "type"
}

/** What kind of upload a video is - a premiere counts as a regular video, as YouTube lists it on the Videos tab */
export enum VideoType {
  VIDEO = "video",
  SHORT = "short",
  LIVE_STREAM = "live-stream"
}

/** The ways a title condition can be written */
export const TITLE_FILTER_KINDS = [FilterKind.REGEX, FilterKind.AI_MATCH] as const;

/** How a group's conditions combine */
export enum FilterMatch {
  ALL = "all",
  ANY = "any"
}

/** Tri-state so a filter that judges videos asynchronously can show a video before its verdict arrives */
export enum MatchState {
  MATCHES = "matches",
  DOES_NOT_MATCH = "does-not-match",
  PENDING = "pending"
}

// `g` and `y` make RegExp.test stateful, `d` only adds indices - none of them mean anything for a title filter
export const ALLOWED_FILTER_FLAGS = ["i", "m", "s", "u", "v"] as const;
const FILTER_FLAGS_PATTERN = new RegExp(`^[${ALLOWED_FILTER_FLAGS.join("")}]*$`);
export const AI_DESCRIPTION_MAX_LENGTH = 300;

export const regexFilterSchema = z.object({
  kind: z.literal(FilterKind.REGEX),
  pattern: z.string(),
  flags: z.string().regex(FILTER_FLAGS_PATTERN)
});
export type RegexFilter = z.infer<typeof regexFilterSchema>;

export const aiFilterSchema = z.object({
  kind: z.literal(FilterKind.AI_MATCH),
  description: z.string().trim().min(1).max(AI_DESCRIPTION_MAX_LENGTH)
});
export type AiFilter = z.infer<typeof aiFilterSchema>;

export const titleFilterSchema = z.discriminatedUnion("kind", [regexFilterSchema, aiFilterSchema]);
export type TitleFilter = z.infer<typeof titleFilterSchema>;

const durationBoundSchema = z.number().int().nonnegative();

/** A length range: either bound may be left open */
export const lengthFilterSchema = z.object({
  kind: z.literal(FilterKind.LENGTH),
  minSeconds: durationBoundSchema.optional(),
  maxSeconds: durationBoundSchema.optional()
});
export type LengthFilter = z.infer<typeof lengthFilterSchema>;

/** The upload types a video has to be one of */
export const typeFilterSchema = z.object({
  kind: z.literal(FilterKind.TYPE),
  types: z.array(z.enum(VideoType))
});
export type TypeFilter = z.infer<typeof typeFilterSchema>;

const filterConditionSchema = z.discriminatedUnion("kind", [
  regexFilterSchema,
  aiFilterSchema,
  lengthFilterSchema,
  typeFilterSchema
]);
export type FilterCondition = z.infer<typeof filterConditionSchema>;

const filterGroupSchema = z.object({
  kind: z.literal(FilterKind.GROUP),
  match: z.enum(FilterMatch),
  conditions: z.array(filterConditionSchema)
});

/**
 * What a mode's filter is: one condition, or a group of them. A single condition is stored bare (`buildVideoFilter`),
 * so a filter of one condition reads the same as before filters could be combined
 */
export const videoFilterSchema = z.discriminatedUnion("kind", [
  regexFilterSchema,
  aiFilterSchema,
  lengthFilterSchema,
  typeFilterSchema,
  filterGroupSchema
]);
export type VideoFilter = z.infer<typeof videoFilterSchema>;

export const FILTER_METHOD_BY_KIND = {
  [FilterKind.REGEX]: FilterMethod.TITLE,
  [FilterKind.AI_MATCH]: FilterMethod.TITLE,
  [FilterKind.LENGTH]: FilterMethod.LENGTH,
  [FilterKind.TYPE]: FilterMethod.TYPE
} as const satisfies Record<FilterCondition["kind"], FilterMethod>;

/** A filter saved before filters had a `kind`, when every filter was a RegExp, read as today's RegExp filter */
export const legacyRegexFilterSchema = regexFilterSchema.omit({ kind: true }).transform(filter => {
  const upgraded: RegexFilter = {
    kind: FilterKind.REGEX,
    ...filter
  };
  return upgraded;
});

export const DEFAULT_TITLE_FILTER: RegexFilter = {
  kind: FilterKind.REGEX,
  pattern: "",
  flags: "i"
};

/** Where the editor starts when switching a filter to AI match */
export const EMPTY_AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: ""
};

const DEFAULT_MAX_LENGTH_SECONDS = 20 * 60;

/** Where the editor starts when a length condition is added */
export const DEFAULT_LENGTH_FILTER: LengthFilter = {
  kind: FilterKind.LENGTH,
  maxSeconds: DEFAULT_MAX_LENGTH_SECONDS
};

export function listFilterConditions(filter: VideoFilter) {
  const conditions: FilterCondition[] = filter.kind === FilterKind.GROUP ? filter.conditions : [filter];
  return conditions;
}

export function getFilterMatch(filter: VideoFilter) {
  return filter.kind === FilterKind.GROUP ? filter.match : FilterMatch.ALL;
}

/** The one way a filter is put together: a single condition stands alone, more are grouped */
export function buildVideoFilter({ conditions, match }: { conditions: FilterCondition[]; match: FilterMatch }) {
  const [onlyCondition] = conditions;
  if (onlyCondition && conditions.length === 1) {
    const filter: VideoFilter = onlyCondition;
    return filter;
  }

  const filter: VideoFilter = {
    kind: FilterKind.GROUP,
    match,
    conditions
  };
  return filter;
}

/** A filter's AI conditions - what the model judges for it */
export function listAiFilters(filter: VideoFilter | null) {
  const conditions = filter ? listFilterConditions(filter) : [];
  return conditions.filter(condition => condition.kind === FilterKind.AI_MATCH);
}
