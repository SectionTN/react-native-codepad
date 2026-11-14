import type { CoreModule } from './core/module';

// The engine's share of a frame, so a key still draws inside it.
export const PUMP_BUDGET_MS = 6;

type View = { draw(): void };

const views = new Set<View>();
let core: CoreModule | null = null;
let scheduled = false;

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
  const left = core ? core._cpw_pump(PUMP_BUDGET_MS) : 0;
  for (const view of [...views]) view.draw();
  if (left > 0) requestPump();
}
