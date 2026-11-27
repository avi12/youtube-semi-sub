<script lang="ts">
  interface Props {
    label: string;
    size: number;
  }

  const { label, size }: Props = $props();
</script>

<output style:--size="{size}px" class="loading" aria-label={label}></output>

<style>
  .loading {
    display: inline-block;
    flex: none;
    block-size: var(--size);
    inline-size: var(--size);
    border-radius: 30%;
    background: var(--m3c-primary);

    @media (prefers-reduced-motion: no-preference) {
      animation: loading-morph 1400ms linear infinite;
    }
  }

  @keyframes loading-morph {
    0% {
      border-radius: 50%;
      rotate: 0deg;
    }

    25% {
      border-radius: 20%;
      rotate: 90deg;
    }

    50% {
      border-radius: 50%;
      rotate: 180deg;
    }

    75% {
      border-radius: 20%;
      rotate: 270deg;
    }

    100% {
      border-radius: 50%;
      rotate: 360deg;
    }
  }
</style>
