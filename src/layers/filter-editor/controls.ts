import { functionSchema } from "@/lib/schemas/function";
import { z } from "@/lib/zod";
import type { Component } from "svelte";
import { createContext } from "svelte";

// The toggles the editor is built from, handed in by its host: the in-page dialog passes YouTube's own Polymer
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

const editorControlsSchema = z.object({
  Chip: z.custom<Component<EditorChipProps>>(value => functionSchema.safeParse(value).success),
  Checkbox: z.custom<Component<EditorCheckboxProps>>(value => functionSchema.safeParse(value).success)
});
export type EditorControls = z.infer<typeof editorControlsSchema>;

export const [getEditorControls, setEditorControls] = createContext<EditorControls>();
