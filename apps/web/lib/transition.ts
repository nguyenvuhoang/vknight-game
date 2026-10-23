"use client";
// Scene transitions between the game's screens (home ⇄ chapter map ⇄ stage).
// "forward" = going deeper into the world (camera pushes in), "back" = out.
// The leaving screen animates out, then we navigate; the arriving screen reads
// the direction from sessionStorage and animates in before its first paint.
import { useLayoutEffect, type RefObject } from "react";

export type SceneDir = "forward" | "back";

const KEY = "vk:scene-dir";
export const SCENE_MS = 450;

type Router = { push: (href: string) => void; prefetch: (href: string) => void };

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function goToScene(router: Router, href: string, dir: SceneDir) {
  router.prefetch(href);
  try {
    sessionStorage.setItem(KEY, dir);
  } catch {}
  if (reducedMotion()) {
    router.push(href);
    return;
  }
  document.documentElement.dataset.sceneLeave = dir;
  window.setTimeout(() => router.push(href), SCENE_MS);
}

/** Attach to a screen's root: plays the matching enter animation on mount. */
export function useSceneEnter(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    delete document.documentElement.dataset.sceneLeave;
    let dir: string | null = null;
    try {
      dir = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {}
    const el = ref.current;
    if (!el || (dir !== "forward" && dir !== "back") || reducedMotion()) return;
    const cls = `scene-enter-${dir}`;
    el.classList.add(cls);
    const done = () => el.classList.remove(cls);
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
  }, [ref]);
}
