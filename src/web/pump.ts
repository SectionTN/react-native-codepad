import { DEFAULT_BUDGET_MICROS } from './core/EditorCore';
import type { CoreModule } from './core/module';

// The engine's share of a task, so a key still draws soon after it.
export const PUMP_BUDGET_MS = 6;
// An engine step can run one parse slice, so the pump starts one only while a slice still fits.
const PARSE_SLICE_MS = DEFAULT_BUDGET_MICROS / 1000;

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

// One shared frame: every view draws, then the engine runs after the paint unless a view is urgent.
export function requestPump(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

function frame(): void {
  scheduled = false;
  lastFrame = performance.now();
  const start = probe ? performance.now() : 0;
  const urgent = [...views].some((v) => v.urgent);
  const left = core && urgent ? core._cpw_pump(PUMP_BUDGET_MS, PARSE_SLICE_MS) : 0;
  const pumped = probe ? performance.now() - start : 0;
  // A view that throws, such as a listener of its own, leaves the others drawn and the engine posted.
  const failures: unknown[] = [];
  for (const view of [...views]) {
    try {
      if (probe && view === keyView) drawKeyed(probe, view, pumped);
      else view.draw();
    } catch (e) {
      failures.push(e);
    }
  }
  if (probe) probe.pumps.push(performance.now() - start);
  if (left > 0) requestPump();
  else postEngine();
  if (failures.length)
    queueMicrotask(() => {
      throw failures[0];
    });
}

// The draw the bench counts as a key's work, a named call so a profile can tell it from other frames.
function drawKeyed(p: Probe, view: View, pumped: number): void {
  const drawStart = performance.now();
  view.draw();
  const drawn = performance.now() - drawStart;
  p.work.push(keyMs + pumped + drawn);
  p.handler.push(keyMs);
  p.engine.push(pumped);
  p.draw.push(drawn);
  keyView = null;
  keyMs = 0;
}

type Task = { step(budgetMs: number): boolean };
const tasks = new Set<Task>();

// Adds work the engine task slices after the engine's own, until the returned removal.
export function registerTask(task: Task): () => void {
  tasks.add(task);
  if (core) postEngine();
  return () => {
    tasks.delete(task);
  };
}

let channel: MessageChannel | null = null;
// Engine time with no frame between, after which the engine waits for a frame: Safari paints only between task chains.
const ENGINE_BEFORE_FRAME_MS = 2 * PUMP_BUDGET_MS;
let lastFrame = 0;
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
  const start = performance.now();
  let left = core._cpw_pump(PUMP_BUDGET_MS, PARSE_SLICE_MS);
  // Work outside the engine, like a search scan, takes what the frame has left, at least 1 ms each.
  for (const task of [...tasks]) {
    if (task.step(Math.max(1, PUMP_BUDGET_MS - (performance.now() - start)))) left++;
  }
  if (probe) probe.tasks.push(performance.now() - start);
  if ([...views].some((v) => v.pending())) requestPump();
  if (left === 0) return;
  if (performance.now() - lastFrame < ENGINE_BEFORE_FRAME_MS) postEngine();
  else requestPump();
}
