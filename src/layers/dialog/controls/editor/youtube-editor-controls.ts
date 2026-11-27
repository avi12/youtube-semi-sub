import type { EditorControls } from "#filter-editor";

import YtCheckbox from "./YtCheckbox.svelte";
import YtChip from "./YtChip.svelte";
import YtDisclosure from "./YtDisclosure.svelte";
import YtTextField from "./YtTextField.svelte";

/** The filter editor built from www's own Polymer components */
export const YOUTUBE_EDITOR_CONTROLS: EditorControls = {
  Chip: YtChip,
  Checkbox: YtCheckbox,
  TextField: YtTextField,
  Disclosure: YtDisclosure
};
