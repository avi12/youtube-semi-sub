import YtCheckbox from "./YtCheckbox.svelte";
import YtChip from "./YtChip.svelte";
import YtTextField from "./YtTextField.svelte";
import type { EditorControls } from "#filter-editor";

/** The filter editor built from www's own Polymer components */
export const YOUTUBE_EDITOR_CONTROLS: EditorControls = {
  Chip: YtChip,
  Checkbox: YtCheckbox,
  TextField: YtTextField
};
