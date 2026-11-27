import FilterCheckbox from "#filter-editor/components/controls/FilterCheckbox.svelte";
import FilterChip from "#filter-editor/components/controls/FilterChip.svelte";
import FilterDisclosure from "#filter-editor/components/controls/FilterDisclosure.svelte";
import FilterTextField from "#filter-editor/components/controls/FilterTextField.svelte";
import type { EditorControls } from "#filter-editor/controls";

/** The editor's own controls, for a host without YouTube's components: the popup, and m.youtube.com */
export const DEFAULT_EDITOR_CONTROLS: EditorControls = {
  Chip: FilterChip,
  Checkbox: FilterCheckbox,
  TextField: FilterTextField,
  Disclosure: FilterDisclosure
};
