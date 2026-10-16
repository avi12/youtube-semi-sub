<script lang="ts">
  import { Card } from "m3-svelte";
</script>

<Card variant="filled">
  <section class="empty" aria-labelledby="empty-heading">
    <div class="mock" aria-hidden="true">
      <span class="mock__avatar"></span>
      <span class="mock__lines">
        <span class="mock__line"></span>
        <span class="mock__line mock__line--short"></span>
      </span>
      <span class="mock__buttons">
        <span class="mock__button">Subscribe</span>
        <span class="mock__button mock__button--semi">Semi-subscribe</span>
      </span>
    </div>
    <h2 id="empty-heading" class="empty__heading">No semi-subscriptions yet</h2>
    <p class="empty__text">
      Open a channel or video and press the button next to Subscribe - <strong>Semi-subscribe</strong> on a channel
      you're not subscribed to, <strong>Filter</strong> on one you are
    </p>
    <p class="empty__text">
      Then write a filter - a RegExp, or a plain description an AI judges. Not subscribed, only the videos it lets
      through are added to your subscriptions feed; subscribed, the ones it matches are hidden from it
    </p>
  </section>
</Card>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mock {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 12px 10px;
    align-items: center;
    margin-block-end: 8px;
    padding: 14px;
    border-radius: var(--m3-shape-large);
    background: var(--m3c-surface-container-lowest);
  }

  .mock__avatar {
    block-size: 36px;
    inline-size: 36px;
    border-radius: 50%;
    background: var(--m3c-surface-container-highest);
  }

  .mock__lines {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .mock__line {
    block-size: 8px;
    inline-size: 70%;
    border-radius: 4px;
    background: var(--m3c-surface-container-highest);
  }

  .mock__line--short {
    inline-size: 40%;
    background: var(--m3c-surface-container-high);
  }

  .mock__buttons {
    display: flex;
    grid-column: 1 / -1;
    gap: 8px;
  }

  .mock__button {
    padding-block: 8px;
    padding-inline: 14px;
    border-radius: var(--m3-shape-full);
    background: var(--m3c-inverse-surface);
    color: var(--m3c-inverse-on-surface);
    font-weight: 500;
    font-size: 12px;
    line-height: 1;
  }

  .mock__button--semi {
    display: flex;
    gap: 6px;
    align-items: center;
    background: var(--m3c-primary-container);
    color: var(--m3c-on-primary-container);

    @media (prefers-reduced-motion: no-preference) {
      animation: semi-pulse calc(var(--motion-scale, 1) * 2400ms) var(--m3-timing-function-emphasized-decel) infinite;
    }

    &::before {
      content: "";
      block-size: 10px;
      inline-size: 10px;
      border-radius: 50%;
      background: linear-gradient(to right, currentColor 50%, transparent 50%);
      box-shadow: inset 0 0 0 1.5px currentColor;
    }
  }

  @keyframes semi-pulse {
    0%,
    40% {
      outline: 0 solid color-mix(in sRGB, var(--m3c-primary) 45%, transparent);
    }

    100% {
      outline: 10px solid transparent;
    }
  }

  .empty__heading {
    margin: 0;
    color: var(--m3c-on-surface);
    font-weight: 500;
    font-size: 18px;
  }

  .empty__text {
    margin: 0;
    color: var(--m3c-on-surface-variant);
    text-wrap: pretty;

    & strong {
      color: var(--m3c-on-surface);
      font-weight: 600;
    }
  }
</style>
