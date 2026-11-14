import type { CoreModule } from './core/module';

// The engine's share of a frame, so a key still draws inside it.
export const PUMP_BUDGET_MS = 6;

type View = { draw(): void };
type Probe = { work: number[]; pumps: number[] };

const views = new Set<View>();
let core: CoreModule | null = null;
let scheduled = false;

// With localStorage codepad_debug set to 1 at load, the bench reads key and frame times from globalThis.
const probe: Probe | null = debugOn() ? { work: [], pumps: [] } : null;
if (probe) (globalThis as { __codepadProbe?: Probe }).__codepadProbe = probe;
let keyView: View | null = null;
let keyMs = 0;

function debugOn(): boolean {
  try {
    return globalThis.localStorage?.getItem('codepad_debug') === '1';
  } catch {
    return false;
  }
}

export const probing = probe !== null;

// A key's handler time, counted into the work of the next frame that draws its view.
export function probeKey(view: View, ms: number): void {
  keyView = view;
  keyMs += ms;
}

export function setPumpCore(m: CoreModule): void {
  core = m;
}

// Adds a view to the page's frame loop and returns its removal.
export function registerView(view: View): () => void {
  views.add(view);
  requestPump();
  return () => {
    views.delete(view);
  };
}

// One shared frame: the engine runs its queued work, then every view draws. A view asks for the next frame here.
export function requestPump(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

function frame(): void {
  scheduled = false;
  const start = probe ? performance.now() : 0;
  const left = core ? core._cpw_pump(PUMP_BUDGET_MS) : 0;
  const pumped = probe ? performance.now() - start : 0;
  for (const view of [...views]) {
    const drawStart = probe ? performance.now() : 0;
    view.draw();
    if (probe && view === keyView) {
      probe.work.push(keyMs + pumped + performance.now() - drawStart);
      keyView = null;
      keyMs = 0;
    }
  }
  if (probe) probe.pumps.push(performance.now() - start);
  if (left > 0) requestPump();
}
