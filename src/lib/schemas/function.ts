import { z } from "@/lib/zod";

/** Any callable: page objects are only checked for the methods they need, their types come from an interface */
export const functionSchema = z.custom<(...args: never[]) => unknown>(value => typeof value === "function");
