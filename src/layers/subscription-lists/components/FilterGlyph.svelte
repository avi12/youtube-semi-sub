<script lang="ts">
  import { attachIcon, FILTER_ICON_PATH, YtIconName } from "@/lib/youtube/page/elements/yt-icon";
  import { getYouTubeSite, YouTubeSite } from "@/lib/youtube/site";

  // The semi-subscription mark across every in-page list, in YouTube's own filter icon: www's Polymer `yt-icon`,
  // and on m.youtube.com, which has no Polymer, the same glyph as inline markup

  const IS_DESKTOP = getYouTubeSite() === YouTubeSite.DESKTOP;
</script>

{#if IS_DESKTOP}
  <yt-icon class="yss-glyph" {@attach attachIcon(YtIconName.FILTER_LIST)}></yt-icon>
{:else}
  <svg class="yss-glyph" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d={FILTER_ICON_PATH} />
  </svg>
{/if}
