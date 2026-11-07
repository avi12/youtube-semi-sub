<script lang="ts">
  import { polymerHostAttributes } from "@/lib/youtube/page/polymer-host";
  import type { EditorChipProps } from "#filter-editor";
  import { on } from "svelte/events";

  // www's own filter chip - the one above search results and the home feed, `yt-chip-cloud-chip-renderer`. Its label
  // goes through `.data`, its selection through the `selected` attribute Polymer reads itself

  const { label, isSelected, isDisabled = false, onToggle }: EditorChipProps = $props();

  const CHIP_TAG = "yt-chip-cloud-chip-renderer";
  const CHIP_STYLE = "STYLE_HOME_FILTER";
  const CHIP_ACTION_EVENT = "yt-action";

  /** A pressed chip announces itself to its chip cloud, which this one has none of - so YouTube never hears of it */
  function keepChipActions(elHost: Element) {
    return on(elHost, CHIP_ACTION_EVENT, e => {
      e.stopPropagation();
    });
  }
</script>

<span
  {...polymerHostAttributes({
    tag: CHIP_TAG,
    data: {
      text: {
        simpleText: label
      },
      style: {
        styleType: CHIP_STYLE
      }
    },
    attributes: {
      selected: isSelected
    }
  })}
  class="chip"
  {@attach keepChipActions}
  onclick={e => {
    // The chip's own <button> has no type, so inside the dialog's form it would submit it
    e.preventDefault();

    if (!isDisabled) {
      onToggle();
    }
  }}
  role="none"></span>

<style>
  .chip {
    display: contents;
  }
</style>
