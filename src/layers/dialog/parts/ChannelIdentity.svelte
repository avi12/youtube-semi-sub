<script lang="ts">
  import { type ChannelInfo, getChannelInitial } from "@/lib/schemas/channel";

  interface Props {
    channel: ChannelInfo;
  }

  const { channel }: Props = $props();

  const channelInitial = $derived(getChannelInitial(channel.title));
</script>

<section class="channel" aria-label="Channel">
  {#if channel.avatarUrl}
    <img class="channel__avatar" alt="" src={channel.avatarUrl} />
  {:else}
    <span class="channel__avatar channel__avatar--initial" aria-hidden="true">{channelInitial}</span>
  {/if}
  <span class="channel__text">
    <span class="channel__title" dir="auto">{channel.title}</span>
    {#if channel.handle}
      <span class="channel__handle" dir="auto">{channel.handle}</span>
    {/if}
  </span>
</section>

<style>
  .channel {
    display: flex;
    gap: 12px;
    align-items: center;
    min-inline-size: 0;
  }

  .channel__avatar {
    flex: none;
    object-fit: cover;
    block-size: 48px;
    inline-size: 48px;
    border-radius: 50%;
    background: var(--additive);
  }

  .channel__avatar--initial {
    display: grid;
    place-items: center;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 20px;
  }

  .channel__text {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .channel__title,
  .channel__handle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .channel__title {
    font-weight: 500;
    font-size: 16px;
  }

  .channel__handle {
    color: var(--text-secondary);
    font-size: 12px;
  }
</style>
