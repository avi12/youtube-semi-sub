import { z } from "@/lib/zod";

/**
 * A type guard from a schema. Page objects (components, controllers, elements) are validated in place and used as they
 * are, since a parsed copy would lose their identity and their methods' `this`
 */
export function createGuard<Schema extends z.ZodType>(schema: Schema) {
  return (value: unknown): value is z.infer<Schema> => schema.safeParse(value).success;
}

/** A page method called for its effect, with no arguments; zod checks only that it is a function */
export const VOID_METHOD_SCHEMA = z.function({
  input: [],
  output: z.void()
});

/**
 * A guard whose schema is built on first use. For classes that exist only in a browser (`Element`, `Node`): a schema
 * built at import time would throw when WXT imports the entrypoints in Node to read their options
 */
export function createLazyGuard<Schema extends z.ZodType>(getSchema: () => Schema) {
  return (value: unknown): value is z.infer<Schema> => getSchema().safeParse(value).success;
}
