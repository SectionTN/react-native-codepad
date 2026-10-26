import {
  EASE_IN,
  EASE_IN_OUT,
  EASE_OUT,
  easeOutCubic,
  type Loop,
  loop,
  slot,
  steps,
} from './hooks';

const SELECT = 5600;
const UNDO = 5200;
const PAIRS = 4400;
const KEYBOARD = 5600;
const TERMINAL = 7000;
const KEY_UP: Keyframe = {
  transform: 'translateY(0)',
  boxShadow: '0 2px 0 0 rgba(127,127,127,.35)',
};
const KEY_DOWN: Keyframe = {
  transform: 'translateY(2px)',
  boxShadow: '0 0 0 0 rgba(127,127,127,.35)',
};
const opacityAt =
  (frames: [number, number][], duration: number): Loop =>
  (el) =>
    loop(el, steps(frames.map(([offset, opacity]) => [offset, { opacity }])), duration);

// The keyframes of every looping demo on the landing, from the design's FX table.
export const FX = {
  marquee: (el) =>
    loop(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], 70000),
  train: (el) =>
    loop(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], 30 * 16.7 * 40),
  float: (el, i) =>
    loop(el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }], 4800, {
      direction: 'alternate',
      easing: 'ease-in-out',
      delay: -i * 2400,
    }),
  pulse: (el) =>
    loop(
      el,
      [
        { transform: 'scale(1)', opacity: 0.55 },
        { transform: 'scale(2.6)', opacity: 0 },
      ],
      2200,
      {
        easing: 'ease-out',
      },
    ),
  selbox: (el) =>
    loop(
      el,
      steps([
        [0, { width: '0ch' }],
        [0.08, { width: '0ch' }, EASE_OUT],
        [0.13, { width: '8ch' }],
        [0.32, { width: '8ch' }, EASE_IN_OUT],
        [0.56, { width: '22ch' }],
        [0.86, { width: '22ch' }],
        [0.9, { width: '0ch' }],
        [1, { width: '0ch' }],
      ]),
      SELECT,
    ),
  selh: opacityAt(
    [
      [0, 0],
      [0.11, 0],
      [0.13, 1],
      [0.86, 1],
      [0.88, 0],
      [1, 0],
    ],
    SELECT,
  ),
  selr: (el) =>
    loop(
      el,
      steps([
        [0, { opacity: 0, left: '21ch' }],
        [0.11, { opacity: 0, left: '21ch' }],
        [0.13, { opacity: 1, left: '21ch' }],
        [0.32, { opacity: 1, left: '21ch' }, EASE_IN_OUT],
        [0.56, { opacity: 1, left: '35ch' }],
        [0.86, { opacity: 1, left: '35ch' }],
        [0.88, { opacity: 0, left: '35ch' }],
        [1, { opacity: 0, left: '35ch' }],
      ]),
      SELECT,
    ),
  selmenu: (el) => {
    const h = { opacity: 0, transform: 'translateY(6px) scale(.96)' };
    const s = { opacity: 1, transform: 'translateY(0) scale(1)' };
    return loop(
      el,
      steps([
        [0, h],
        [0.14, h],
        [0.18, s],
        [0.29, s],
        [0.31, h],
        [0.58, h],
        [0.62, s],
        [0.85, s],
        [0.87, h],
        [1, h],
      ]),
      SELECT,
    );
  },
  undorow: (el) =>
    loop(
      el,
      steps([
        [0, { gap: '8px', opacity: 1 }],
        [0.28, { gap: '8px', opacity: 1 }, EASE_IN_OUT],
        [0.42, { gap: '0px', opacity: 1 }],
        [0.68, { gap: '0px', opacity: 1 }],
        [0.74, { gap: '0px', opacity: 0.14 }],
        [0.92, { gap: '0px', opacity: 0.14 }],
        [1, { gap: '8px', opacity: 1 }],
      ]),
      UNDO,
    ),
  undochip: (el) =>
    loop(
      el,
      steps([
        [0, { width: '30px' }],
        [0.28, { width: '30px' }, EASE_IN_OUT],
        [0.42, { width: '11px' }],
        [0.92, { width: '11px' }],
        [1, { width: '30px' }],
      ]),
      UNDO,
    ),
  undoskin: opacityAt(
    [
      [0, 1],
      [0.28, 1],
      [0.4, 0],
      [0.92, 0],
      [1, 1],
    ],
    UNDO,
  ),
  undoring: opacityAt(
    [
      [0, 0],
      [0.43, 0],
      [0.48, 1],
      [0.68, 1],
      [0.74, 0.14],
      [0.88, 0],
      [1, 0],
    ],
    UNDO,
  ),
  undokey: (el) =>
    loop(
      el,
      steps([
        [0, KEY_UP],
        [0.6, KEY_UP],
        [0.62, KEY_DOWN],
        [0.7, KEY_DOWN],
        [0.72, KEY_UP],
        [1, KEY_UP],
      ]),
      UNDO,
    ),
  popen: opacityAt(
    [
      [0, 0],
      [0.14, 0],
      [0.15, 1],
      [0.92, 1],
      [0.93, 0],
      [1, 0],
    ],
    PAIRS,
  ),
  pghost: opacityAt(
    [
      [0, 0],
      [0.14, 0],
      [0.15, 1],
      [0.42, 1],
      [0.43, 0],
      [1, 0],
    ],
    PAIRS,
  ),
  pc1: opacityAt(
    [
      [0, 1],
      [0.42, 1],
      [0.43, 0],
      [0.93, 0],
      [0.94, 1],
      [1, 1],
    ],
    PAIRS,
  ),
  pline: opacityAt(
    [
      [0, 0],
      [0.42, 0],
      [0.43, 1],
      [0.92, 1],
      [0.93, 0],
      [1, 0],
    ],
    PAIRS,
  ),
  pflash: opacityAt(
    [
      [0, 0],
      [0.43, 0],
      [0.45, 1],
      [0.7, 0],
      [1, 0],
    ],
    PAIRS,
  ),
  match: (el, i) => {
    const a = i / 4;
    const b = (i + 1) / 4;
    const frames: Keyframe[] = [{ opacity: 0, offset: 0 }];
    if (a > 0) frames.push({ opacity: 0, offset: a });
    frames.push(
      { opacity: 1, offset: a + 0.01 },
      { opacity: 1, offset: b - 0.01 },
      { opacity: 0, offset: b },
    );
    if (b < 1) frames.push({ opacity: 0, offset: 1 });
    return loop(el, frames, 4800);
  },
  chord: (el, i) => slot(el, i, 3, 3600, KEY_DOWN, KEY_UP),
  toolbar: (el, i) => slot(el, i, 6, 4200, { opacity: 1 }, { opacity: 0 }),
  wrap: (el) =>
    loop(
      el,
      steps([
        [0, { width: '100%' }],
        [0.15, { width: '100%' }, EASE_IN_OUT],
        [0.42, { width: '56%' }],
        [0.65, { width: '56%' }, EASE_IN_OUT],
        [0.92, { width: '100%' }],
        [1, { width: '100%' }],
      ]),
      6400,
    ),
  keyboard: (el) =>
    loop(
      el,
      steps([
        [0, { transform: 'translateY(100%)' }],
        [0.08, { transform: 'translateY(100%)' }, EASE_OUT],
        [0.33, { transform: 'translateY(0%)' }],
        [0.7, { transform: 'translateY(0%)' }, EASE_IN],
        [0.84, { transform: 'translateY(100%)' }],
        [1, { transform: 'translateY(100%)' }],
      ]),
      KEYBOARD,
    ),
  keyboardLines: (el) =>
    loop(
      el,
      steps([
        [0, { transform: 'translateY(0px)' }],
        [0.08, { transform: 'translateY(0px)' }, EASE_OUT],
        [0.33, { transform: 'translateY(-44px)' }],
        [0.7, { transform: 'translateY(-44px)' }, EASE_IN],
        [0.84, { transform: 'translateY(0px)' }],
        [1, { transform: 'translateY(0px)' }],
      ]),
      KEYBOARD,
    ),
  dot: (el, i) => {
    const a = 0.08 + (i / 15) * 0.25;
    const h = { opacity: 0, transform: 'translate(-50%,50%) scale(.3)' };
    const s = { opacity: 1, transform: 'translate(-50%,50%) scale(1)' };
    return loop(
      el,
      steps([
        [0, h],
        [a, h],
        [a + 0.01, s],
        [0.7, s],
        [0.75, h],
        [1, h],
      ]),
      KEYBOARD,
    );
  },
  term: (el) =>
    loop(
      el,
      steps([
        [0, { clipPath: 'inset(0 100% 0 0)' }],
        [0.05, { clipPath: 'inset(0 100% 0 0)' }, 'steps(45, end)'],
        [0.42, { clipPath: 'inset(0 0% 0 0)' }],
        [1, { clipPath: 'inset(0 0% 0 0)' }],
      ]),
      TERMINAL,
    ),
  termcaret: (el) =>
    loop(
      el,
      steps([
        [0, { left: '0ch' }],
        [0.05, { left: '0ch' }, 'steps(45, end)'],
        [0.42, { left: '45ch' }],
        [1, { left: '45ch' }],
      ]),
      TERMINAL,
    ),
} satisfies Record<string, Loop>;

// The plot's dot i sits at frame i of an ease-out-cubic curve.
export const curve = (i: number) => easeOutCubic(i / 15);
