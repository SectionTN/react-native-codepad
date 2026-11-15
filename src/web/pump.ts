import type { CoreModule } from './core/module';

// The engine's share of a task, so a key still draws soon after it.
export const PUMP_BUDGET_MS = 6;

// urgent: the view's next frame waits for the parse. pending: it has something to draw.
type View = { draw(): void; readonly urgent: boolean; pending(): boolean };
// Per key: work and its three parts, the handler, the engine share of the frame that draws it, and that draw.
type Probe = {
  work: number[];
  handler: number[];
  engine: number[];
  draw: number[];
  pumps: number[];
  // Each engine task run between frames.
  tasks: number[];
};

const views = new Set<View>();
let core: CoreModule | null = null;
let scheduled = false;

// With localStorage codepad_debug set to 1 at load, the bench reads key and frame times from globalThis.
const probe: Probe | null = debugOn()
  ? { work: [], handler: [], engine: [], draw: [], pumps: [], tasks: [] }
  : null;
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

// One shared frame: every view draws, then the engine runs in a task after the page paints, so a key's frame never
// waits for a parse. A view whose lines would lose their colors makes the frame run the engine first.
export function requestPump(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

function frame(): void {
  scheduled = false;
  const start = probe ? performance.now() : 0;
  const urgent = [...views].some((v) => v.urgent);
  const left = core && urgent ? core._cpw_pump(PUMP_BUDGET_MS) : 0;
  const pumped = probe ? performance.now() - start : 0;
  for (const view of [...views]) {
    const drawStart = probe ? performance.now() : 0;
    view.draw();
    if (probe && view === keyView) {
      const drawn = performance.now() - drawStart;
      probe.work.push(keyMs + pumped + drawn);
      probe.handler.push(keyMs);
      probe.engine.push(pumped);
      probe.draw.push(drawn);
      keyView = null;
      keyMs = 0;
    }
  }
  if (probe) probe.pumps.push(performance.now() - start);
  if (left > 0) requestPump();
  else postEngine();
}

let channel: MessageChannel | null = null;
let engineQueued = false;

function postEngine(): void {
  if (engineQueued || !core) return;
  engineQueued = true;
  if (!channel && typeof MessageChannel !== 'undefined') {
    channel = new MessageChannel();
    channel.port1.onmessage = runEngine;
  }
  if (channel) channel.port2.postMessage(0);
  else setTimeout(runEngine, 0);
}

// The engine's queued work between frames: a snapshot it publishes draws in the next frame.
function runEngine(): void {
  engineQueued = false;
  if (!core) return;
  const start = probe ? performance.now() : 0;
  const left = core._cpw_pump(PUMP_BUDGET_MS);
  if (probe) probe.tasks.push(performance.now() - start);
  if ([...views].some((v) => v.pending())) requestPump();
  if (left > 0) postEngine();
}
