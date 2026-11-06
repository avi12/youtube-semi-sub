<script lang="ts">
  import { isLengthFilterSet, isLengthRangeValid, type LengthFilter } from "@/lib/filter/title-filter";
  import { SECONDS_PER_MINUTE } from "@/lib/youtube/video-duration";

  interface Props {
    filter: LengthFilter;
    /** The first input's id, so the card's heading can point at it */
    inputId: string;
  }

  let { filter = $bindable(), inputId }: Props = $props();

  const maxInputId = $derived(`${inputId}-max`);
  const hintId = $derived(`${inputId}-hint`);
  const errorId = $derived(`${inputId}-error`);
  const error = $derived.by(() => {
    if (!isLengthFilterSet(filter)) {
      return "Set at least one limit";
    }

    if (!isLengthRangeValid(filter)) {
      return "The shortest can't be longer than the longest";
    }

    return null;
  });

  function toMinutes(seconds: number | undefined) {
    return seconds === undefined ? null : seconds / SECONDS_PER_MINUTE;
  }

  /** An emptied field leaves that side open */
  function withBound({ bound, minutes }: {
    bound: "minSeconds" | "maxSeconds";
    minutes: number | null | undefined;
  }) {
    const isSet = typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0;
    const updated: LengthFilter = {
      ...filter,
      [bound]: isSet ? Math.round(minutes * SECONDS_PER_MINUTE) : undefined
    };
    return updated;
  }
</script>

<div class="length">
  <div class="length__range">
    <label class="length__bound">
      <span class="length__label">At least</span>
      <span class="filter-editor-field">
        <input
          id={inputId}
          class="length__input"
          aria-describedby="{hintId} {errorId}"
          aria-invalid={error !== null}
          inputmode="decimal"
          min="0"
          placeholder="0"
          step="any"
          type="number"
          bind:value={() => toMinutes(filter.minSeconds), minutes => {
            filter = withBound({
              bound: "minSeconds",
              minutes
            });
          }} />
        <span class="length__unit">min</span>
      </span>
    </label>
    <label class="length__bound">
      <span class="length__label">Up to</span>
      <span class="filter-editor-field">
        <input
          id={maxInputId}
          class="length__input"
          aria-describedby="{hintId} {errorId}"
          aria-invalid={error !== null}
          inputmode="decimal"
          min="0"
          placeholder="No limit"
          step="any"
          type="number"
          bind:value={() => toMinutes(filter.maxSeconds), minutes => {
            filter = withBound({
              bound: "maxSeconds",
              minutes
            });
          }} />
        <span class="length__unit">min</span>
      </span>
    </label>
  </div>
  <p id={hintId} class="length__hint">Leave a side empty for no limit - Shorts run up to 3 min</p>
  <p id={errorId} class="length__error" aria-live="polite">{error ?? ""}</p>
</div>

<style>
  .length {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .length__range {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px 12px;
  }

  .length__bound {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .length__label {
    color: var(--editor-muted);
    font-size: 12px;
  }

  .length__input {
    flex: 1;
    min-inline-size: 0;
    padding-block: 10px;
    border: 0;
    background: transparent;
    color: var(--editor-fg);
    font: inherit;
    font-size: 15px;
    font-variant-numeric: tabular-nums;

    &::placeholder {
      color: var(--editor-muted);
      opacity: 60%;
    }

    &:focus-visible {
      outline: none;
    }
  }

  .length__unit {
    flex: none;
    color: var(--editor-muted);
    user-select: none;
  }

  .length__hint,
  .length__error {
    margin: 0;
    font-size: 12px;
  }

  .length__hint {
    color: var(--editor-muted);
  }

  .length__error {
    color: var(--editor-error);
    font-weight: 500;

    &:empty {
      display: none;
    }
  }
</style>
