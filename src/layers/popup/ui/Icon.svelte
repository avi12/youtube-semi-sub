<script lang="ts">
  interface Props {
    path: string;
  }

  const { path }: Props = $props();
</script>

<svg aria-hidden="true" viewBox="0 0 24 24"><path d={path} fill="currentColor" /></svg>

<style>
  svg {
    flex: none;
    block-size: var(--icon-size, 24px);
    inline-size: var(--icon-size, 24px);
  }
</style>
