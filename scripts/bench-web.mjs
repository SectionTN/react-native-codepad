// Typing bench in Chrome: yarn bench:web [lines] [port] [--desktop [rate]] [--profile] [--keys n]
// Without --desktop it drives Chrome on an Android device through adb, the example served on that port with adb reverse.
// --desktop opens the example in a local Chromium at phone size with the CPU slowed by rate. --profile adds a CPU profile.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { summarize } from './profile-summary.mjs';

// Key work matches the Redmi at 8x and engine tasks at 3x (calibrated on 73219f3): gate engine tasks with --desktop 3.
const DEFAULT_RATE = 8;

const args = process.argv.slice(2);
const positional = [];
let desktop = null;
let profile = false;
let keys = 60;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--profile') profile = true;
  else if (args[i] === '--keys') keys = Number(args[++i]);
  else if (args[i] === '--desktop') {
    desktop = /^\d+(\.\d+)?$/.test(args[i + 1] ?? '') ? Number(args[++i]) : DEFAULT_RATE;
  } else positional.push(args[i]);
}
const lines = Number(positional[0] ?? 300);
const WEB_PORT = positional[1] ?? '8082';
const CHARS = keys;
const GAP_MS = 150;
const TEXT = 'let total = value + 1; '.repeat(Math.ceil(CHARS / 23)).slice(0, CHARS);
const PORT = 9222;
const ROOTS = { drawKeyed: 'key draw', runEngine: 'engine', applyInput: 'handler' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const ms = (n) => `${n.toFixed(1)} ms`;

async function openPage() {
  if (desktop !== null) {
    const browser = await chromium.launch();
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    await page.goto(`http://localhost:${WEB_PORT}/`);
    return { browser, page, close: () => browser.close() };
  }
  execFileSync('adb', ['forward', `tcp:${PORT}`, 'localabstract:chrome_devtools_remote']);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => new RegExp(`//(localhost|127\\.0\\.0\\.1):${WEB_PORT}/`).test(p.url()));
  const close = async () => {
    await browser.close();
    execFileSync('adb', ['forward', '--remove', `tcp:${PORT}`]);
  };
  if (!page) {
    await close();
    throw new Error(`open http://localhost:${WEB_PORT} in Chrome on the device first`);
  }
  return { browser, page, close };
}

const { page, close } = await openPage();
try {
  await page.evaluate(() => localStorage.setItem('codepad_debug', '1'));
  await page.reload();
  await page.waitForFunction(() => globalThis.__codepadBench && globalThis.__codepadProbe);
  const opened = page.waitForEvent('console', {
    predicate: (m) => m.text().includes(`bench ${lines} first paint`),
    timeout: 60000,
  });
  await page.evaluate((n) => globalThis.__codepadBench.open(n), lines);
  console.log((await opened).text());
  const box = await page.locator('[data-line="2"]').first().boundingBox();
  if (!box) throw new Error('the editor drew no line 2');
  await page.mouse.click(box.x + 4, box.y + box.height / 2);
  await sleep(1000);
  const cdp = await page.context().newCDPSession(page);
  if (desktop !== null) await cdp.send('Emulation.setCPUThrottlingRate', { rate: desktop });
  await page.evaluate(() => {
    for (const list of Object.values(globalThis.__codepadProbe)) list.length = 0;
  });
  if (profile) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
    await cdp.send('Profiler.start');
  }
  for (const ch of TEXT) {
    await cdp.send('Input.insertText', { text: ch });
    await sleep(GAP_MS);
  }
  await sleep(500);
  const taken = profile ? (await cdp.send('Profiler.stop')).profile : null;
  if (desktop !== null) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const probe = await page.evaluate(() => globalThis.__codepadProbe);
  const stats = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    const mean = list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
    return `mean ${ms(mean)}, p50 ${ms(pct(sorted, 0.5))}, p95 ${ms(pct(sorted, 0.95))}, max ${ms(sorted.at(-1) ?? 0)}`;
  };
  const where = desktop !== null ? `desktop at ${desktop}x` : 'device';
  console.log(`${lines} lines, ${where}, ${probe.work.length} of ${CHARS} keys`);
  for (const part of ['work', 'handler', 'engine', 'draw']) {
    console.log(`  ${part.padEnd(8)}${stats(probe[part])}`);
  }
  console.log(`  largest frame ${ms(Math.max(0, ...probe.pumps))} of ${probe.pumps.length}`);
  console.log(`  engine tasks ${stats(probe.tasks)} of ${probe.tasks.length}`);
  if (taken) {
    const dir = path.join(import.meta.dirname, '..', 'build', 'bench');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `typing-${lines}-${Date.now()}.cpuprofile`);
    writeFileSync(file, JSON.stringify(taken));
    const all = summarize(taken, ROOTS, Number.POSITIVE_INFINITY);
    const top = summarize(taken, ROOTS, 12);
    for (const group of ['key draw', 'handler', 'engine', 'other']) {
      const total = (all[group] ?? []).reduce((sum, f) => sum + f.selfMs, 0);
      console.log(`  profile ${group}: ${ms(total)} over the ${CHARS} keys`);
      for (const f of top[group] ?? []) console.log(`    ${ms(f.selfMs).padStart(9)}  ${f.fn}`);
    }
    console.log(`  profile saved to ${file}`);
  }
  await page.evaluate(() => localStorage.removeItem('codepad_debug'));
} finally {
  await close();
}
