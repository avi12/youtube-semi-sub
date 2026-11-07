/** Shared by the popup and the in-page dialog, so it stays library-free and is themed via `--filter-editor-*` */
export { default as FilterEditor } from "./FilterEditor.svelte";

/** What a host implements to build the editor from its own toggles */
export type { EditorCheckboxProps, EditorChipProps, EditorControls } from "./controls";

/** The editor's own toggles, for a host without YouTube's components */
export { DEFAULT_EDITOR_CONTROLS } from "./default-controls";
