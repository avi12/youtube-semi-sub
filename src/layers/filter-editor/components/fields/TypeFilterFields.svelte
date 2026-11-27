<script lang="ts">
  import { type TypeFilter, VideoType } from "@/lib/filter/schema/video-filter-schema";
  import { getEditorControls } from "#filter-editor/controls";
  import { VIDEO_TYPE_LABEL } from "#filter-editor/filter-methods";

  interface Props {
    filter: TypeFilter;
  }

  let { filter = $bindable() }: Props = $props();

  const VIDEO_TYPES = Object.values(VideoType);
  const { Chip } = getEditorControls();
  const errorId = $props.id();
  const isEmpty = $derived(filter.types.length === 0);

  function setTypePicked({ type, isPicked }: {
    type: VideoType;
    isPicked: boolean;
  }) {
    filter = {
      ...filter,
      types: VIDEO_TYPES.filter(other => other === type ? isPicked : filter.types.includes(other))
    };
  }
</script>

<fieldset class="types" aria-describedby={errorId}>
  <legend class="types__legend">Upload types</legend>
  {#each VIDEO_TYPES as type (type)}
    {@const isPicked = filter.types.includes(type)}
    <Chip
      isSelected={isPicked}
      label={VIDEO_TYPE_LABEL[type]}
      onToggle={() => setTypePicked({
        type,
        isPicked: !isPicked
      })} />
  {/each}
</fieldset>
<p id={errorId} class="types__error" aria-live="polite">
  {#if isEmpty}
    Pick at least one type
  {/if}
</p>

<style>
  .types {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .types__legend {
    position: absolute;
    overflow: hidden;
    block-size: 1px;
    inline-size: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .types__error {
    margin: 0;
    color: var(--editor-error);
    font-weight: 500;
    font-size: 12px;

    &:not(:has(*)):empty {
      display: none;
    }
  }
</style>
