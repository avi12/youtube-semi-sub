import { functionSchema } from "@/lib/schemas/function";
import { z } from "@/lib/zod";
import type { Component, Snippet } from "svelte";
import { createContext } from "svelte";

// The controls the editor is built from, handed in by its host: the in-page dialog passes YouTube's own Polymer
// components, the popup (and m.youtube.com, which has no Polymer) the editor's plain ones. Only the look differs

export interface EditorChipProps {
  label: string;
  isSelected: boolean;
  /** Shown but not pressable, like the last filter method left */
  isDisabled?: boolean;
  onToggle(): void;
}

export interface EditorCheckboxProps {
  label: string;
  hint: string;
  isChecked: boolean;
  onCheckedChange(isChecked: boolean): void;
}

export interface EditorTextFieldProps {
  id: string;
  /** The field's name - YouTube's field floats it above the text, the plain one leaves it to the card's heading */
  label: string;
  value: string;
  placeholder: string;
  /** The editor's own text about the field, by id */
  describedBy: string;
  /** Why the value can't be used, shown under the field */
  error?: string | null;
  /** Counts the characters toward this cap */
  maxLength?: number;
  /** A pattern or an expression: monospace, left to right, never corrected */
  isCode?: boolean;
  /** Room for a few lines where the host has it */
  isMultiline?: boolean;
  /** The field the dialog focuses when it opens */
  isFocusedOnOpen?: boolean;
  prefix?: Snippet;
  suffix?: Snippet;
  onValueChange(value: string): void;
}

/** Marks the text field a host focuses when it opens, on the input or on the element that renders it */
export const FOCUSED_ON_OPEN_ATTRIBUTE = "data-filter-input";
/** The text field marked `isFocusedOnOpen`, whether a host renders the input itself or inside its own element */
export const FOCUSED_ON_OPEN_SELECTOR = `:is(input, textarea):is([${FOCUSED_ON_OPEN_ATTRIBUTE}], [${FOCUSED_ON_OPEN_ATTRIBUTE}] *)`;

const editorControlsSchema = z.object({
  Chip: z.custom<Component<EditorChipProps>>(value => functionSchema.safeParse(value).success),
  Checkbox: z.custom<Component<EditorCheckboxProps>>(value => functionSchema.safeParse(value).success),
  TextField: z.custom<Component<EditorTextFieldProps>>(value => functionSchema.safeParse(value).success)
});
export type EditorControls = z.infer<typeof editorControlsSchema>;

export const [getEditorControls, setEditorControls] = createContext<EditorControls>();
