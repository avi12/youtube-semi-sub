import { prefersReducedMotion } from "@/lib/motion";
import type { AnimationConfig } from "svelte/animate";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

const TILE_POP_DURATION_MS = 220;
const TILE_SLIDE_DURATION_MS = 280;
const TILE_POP_START_SCALE = 0.85;

function getMotionDuration(duration: number) {
  const isMotionReduced = prefersReducedMotion();
  return isMotionReduced ? 0 : duration;
}

/** Svelte transition: a tile popping into (or out of) the preview feed */
export function popTile(_node: Element) {
  const config: TransitionConfig = {
    duration: getMotionDuration(TILE_POP_DURATION_MS),
    easing: cubicOut,
    css: progress => `opacity: ${progress}; scale: ${TILE_POP_START_SCALE + (1 - TILE_POP_START_SCALE) * progress}`
  };
  return config;
}

/** Svelte animate: FLIP through the `translate` property, so the remaining tiles glide to their new grid cells */
export function slideTile(_node: Element, { from, to }: {
  from: DOMRect;
  to: DOMRect;
}) {
  const deltaX = from.left - to.left;
  const deltaY = from.top - to.top;
  const config: AnimationConfig = {
    duration: getMotionDuration(TILE_SLIDE_DURATION_MS),
    easing: cubicOut,
    css: (_progress, remaining) => `translate: ${deltaX * remaining}px ${deltaY * remaining}px`
  };
  return config;
}
