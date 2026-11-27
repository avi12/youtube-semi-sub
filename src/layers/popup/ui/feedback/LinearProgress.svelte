<script lang="ts">
  interface Props {
    label: string;
    percent: number;
  }

  const { label, percent }: Props = $props();
</script>

<progress class="progress" aria-label={label} max="100" value={percent}></progress>

<style>
  .progress {
    appearance: none;
    overflow: hidden;
    block-size: 4px;
    inline-size: 100%;
    border: 0;
    border-radius: var(--m3-shape-full);
    background: var(--m3c-secondary-container);
    accent-color: var(--m3c-primary);

    &::-webkit-progress-bar {
      background: var(--m3c-secondary-container);
    }

    &::-webkit-progress-value {
      border-radius: var(--m3-shape-full);
      background: var(--m3c-primary);
    }

    &::-moz-progress-bar {
      border-radius: var(--m3-shape-full);
      background: var(--m3c-primary);
    }
  }
</style>
