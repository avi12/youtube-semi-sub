import { z } from "@/lib/zod";

const RELEASE_TAG_PATTERN = /^v(\d+(?:\.\d+)*)$/;

const latestReleaseSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean()
});

export function isNewerVersion({ candidate, current }: { candidate: string; current: string }) {
  return candidate.localeCompare(current, undefined, { numeric: true }) > 0;
}

/** The version of a stable `v<semver>` release, or null for anything else (a draft, a prerelease, another tag, a malformed reply) */
export function parseLatestReleaseVersion(payload: unknown) {
  const parsed = latestReleaseSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  const { tag_name: tagName, draft, prerelease } = parsed.data;
  const isStable = !draft && !prerelease;
  if (!isStable) {
    return null;
  }

  return RELEASE_TAG_PATTERN.exec(tagName)?.[1] ?? null;
}
