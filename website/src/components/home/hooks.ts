import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

export const PMS = ['bun', 'pnpm', 'yarn', 'npm'] as const;
export type Pm = (typeof PMS)[number];
export const PM_ADD: Record<Pm, string> = {
  bun: 'bun add',
  pnpm: 'pnpm add',
  yarn: 'yarn add',
  npm: 'npm install',
};
export const PM_HEAD: Record<Pm, string> = {
  bun: 'bun install',
  pnpm: 'pnpm add',
  yarn: 'yarn add',
  npm: 'npm install',
};

const PM_KEY = 'codepad-pm';
const listeners = new Set<() => void>();
let current: Pm | null = null;

function readPm(): Pm {
  if (current) return current;
  try {
    const saved = localStorage.getItem(PM_KEY);
    current = PMS.includes(saved as Pm) ? (saved as Pm) : 'bun';
  } catch {
    current = 'bun';
  }
  return current;
}

// One package manager for every install line on the page, remembered across visits.
export function usePackageManager(): [Pm, (pm: Pm) => void] {
  const pm = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readPm,
    () => 'bun' as Pm,
  );
  const setPm = useCallback((next: Pm) => {
    current = next;
    try {
      localStorage.setItem(PM_KEY, next);
    } catch {}
    for (const listener of listeners) listener();
  }, []);
  return [pm, setPm];
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Writes to the clipboard and reports "Copied" for 1.6 s.
export function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1600);
  }, []);
  return [copied, copy];
}

export const EASE_OUT = 'cubic-bezier(0.33,1,0.68,1)';
export const EASE_IN = 'cubic-bezier(0.32,0,0.67,0)';
export const EASE_IN_OUT = 'cubic-bezier(.45,0,.25,1)';
export const EASE_UI = 'cubic-bezier(.2,.7,.2,1)';
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

type Frame = Keyframe & { offset: number; easing?: string };
export type Loop = (el: HTMLElement, i: number) => Animation;

export const loop = (
  el: HTMLElement,
  keyframes: Keyframe[],
  duration: number,
  options: KeyframeAnimationOptions = {},
) => el.animate(keyframes, { duration, iterations: Number.POSITIVE_INFINITY, ...options });

// [offset, values, easing to the next frame]
export const steps = (frames: [number, Keyframe, string?][]): Frame[] =>
  frames.map(([offset, values, easing]) => ({ ...values, offset, ...(easing ? { easing } : {}) }));

// Lights one of n items for its share of the loop.
export function slot(
  el: HTMLElement,
  i: number,
  n: number,
  duration: number,
  on: Keyframe,
  off: Keyframe,
) {
  const a = i / n;
  const b = a + Math.min(0.12, (1 / n) * 0.6);
  return loop(
    el,
    [
      { ...off, offset: 0 },
      { ...off, offset: a },
      { ...on, offset: Math.min(a + 0.02, 1) },
      { ...on, offset: b },
      { ...off, offset: Math.min(b + 0.03, 1) },
      { ...off, offset: 1 },
    ],
    duration,
  );
}

// Runs a looping animation on the element while it is mounted, unless motion is reduced.
export function useLoop<T extends HTMLElement>(fx: Loop, i = 0) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const animation = fx(el, i);
    return () => animation.cancel();
  }, [fx, i]);
  return ref;
}

const REVEAL_FROM: Keyframe = { opacity: 0, transform: 'translateY(28px)', filter: 'blur(6px)' };
const REVEAL_TO: Keyframe = { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' };

function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  const start = performance.now() + 250;
  const tick = () => {
    const p = Math.min(1, Math.max(0, (performance.now() - start) / 1200));
    el.textContent = String(Math.round(to * easeOutCubic(p)));
    if (p < 1) setTimeout(tick, 16);
  };
  tick();
}

// [data-reveal] blocks below the fold rise in once their top passes 88% of the viewport.
// data-reveal="80" staggers; [data-onreveal="budget"] and [data-count] run with the reveal.
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const pending = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
      (node) => node.getBoundingClientRect().top > window.innerHeight * 0.9,
    );
    for (const node of pending) node.style.opacity = '0';
    const reveal = (node: HTMLElement) => {
      node.style.opacity = '';
      node.animate([REVEAL_FROM, REVEAL_TO], {
        duration: 900,
        delay: Number(node.dataset.reveal) || 0,
        easing: EASE_UI,
        fill: 'backwards',
      });
      for (const bar of node.querySelectorAll<HTMLElement>('[data-onreveal="budget"]')) {
        bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
          duration: 1100,
          delay: 250,
          easing: 'cubic-bezier(.2,.8,.2,1)',
          fill: 'backwards',
        });
      }
      for (const counter of node.querySelectorAll<HTMLElement>('[data-count]')) countUp(counter);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          reveal(entry.target as HTMLElement);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const node of pending) observer.observe(node);
    return () => {
      observer.disconnect();
      for (const node of pending) node.style.opacity = '';
    };
  }, [root]);
}
