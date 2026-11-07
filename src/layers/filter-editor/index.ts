/** Shared by the popup and the in-page dialog, so it stays library-free and is themed via `--filter-editor-*` */
export { default as FilterEditor } from "./FilterEditor.svelte";

/** What a host implements to build the editor from its own controls */
export type {
  EditorCheckboxProps,
  EditorChipProps,
  EditorControls,
  EditorDisclosureProps,
  EditorTextFieldProps
} from "./controls";

/** The text field the dialog or popup focuses when it opens */
export { FOCUSED_ON_OPEN_ATTRIBUTE, FOCUSED_ON_OPEN_SELECTOR } from "./controls";

/** The editor's own controls, for a host without YouTube's components */
export { DEFAULT_EDITOR_CONTROLS } from "./default-controls";
