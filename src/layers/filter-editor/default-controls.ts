import FilterCheckbox from "#filter-editor/components/FilterCheckbox.svelte";
import FilterChip from "#filter-editor/components/FilterChip.svelte";
import type { EditorControls } from "#filter-editor/controls";

/** The editor's own toggles, for a host without YouTube's components: the popup, and m.youtube.com */
export const DEFAULT_EDITOR_CONTROLS: EditorControls = {
  Chip: FilterChip,
  Checkbox: FilterCheckbox
};
