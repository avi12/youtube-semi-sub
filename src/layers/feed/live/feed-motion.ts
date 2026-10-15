// The feed's motion, shared by the animated grid write (feed-flip.ts) and the open tile menu that rides along with it
// (open-menu.ts). Only tiles in or near the viewport move; the keyframes and the glide transition live in feed.css

const REFLOW_MARGIN_BELOW_PX = 1200;
const MIN_GLIDE_PX = 1;
const MOTION_NAME_PREFIX = "yss-feed-";
const GLIDE_PROPERTY = "translate";

export enum FeedMotionClass {
  pending = "yss-feed-pending",
  entering = "yss-feed-entering",
  leaving = "yss-feed-leaving",
  gliding = "yss-feed-gliding"
}

export function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

export function isInViewport(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < innerHeight;
}

export function isInReflowZone(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  return bottom > 0 && top < innerHeight + REFLOW_MARGIN_BELOW_PX;
}

function targetOf(animation: Animation) {
  const { effect } = animation;
  return effect && "target" in effect ? effect.target : null;
}

/** Told apart by shape: YouTube's Web Animations polyfill replaces the `Animation` globals */
function isFeedMotion(animation: Animation) {
  if ("animationName" in animation && typeof animation.animationName === "string") {
    return animation.animationName.startsWith(MOTION_NAME_PREFIX);
  }

  return "transitionProperty" in animation && animation.transitionProperty === GLIDE_PROPERTY;
}

/**
 * Only this feature's own motion - an unrelated infinite animation on a tile would never finish. Read through the
 * document: YouTube's Web Animations polyfill replaces `Element.getAnimations`, which then never reports CSS motion
 */
export async function whenMotionFinishes(element: Element) {
  const motions = document.getAnimations()
    .filter(animation => targetOf(animation) === element && isFeedMotion(animation));
  await Promise.allSettled(motions.map(animation => animation.finished));
}

/** Stands an element a write just moved back where it stood before, so it can glide to its new place */
export function pinAtOffset({ element, deltaX, deltaY }: {
  element: HTMLElement;
  deltaX: number;
  deltaY: number;
}) {
  const isMoved = Math.abs(deltaX) >= MIN_GLIDE_PX || Math.abs(deltaY) >= MIN_GLIDE_PX;
  if (isMoved) {
    element.style.translate = `${deltaX}px ${deltaY}px`;
  }

  return isMoved;
}

export function isInGlide(element: HTMLElement) {
  return element.style.translate !== "" || element.classList.contains(FeedMotionClass.gliding);
}

export async function glide(element: HTMLElement) {
  element.classList.add(FeedMotionClass.gliding);
  element.style.translate = "";
  await whenMotionFinishes(element);
  element.classList.remove(FeedMotionClass.gliding);
}
