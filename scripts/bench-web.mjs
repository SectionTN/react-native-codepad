// Typing bench for the web editor in Chrome on an Android phone: yarn bench:web [lines] [port].
// First: yarn example web --port <port>, adb reverse tcp:<port> tcp:<port>, the example open in Chrome on the phone.
// The port is the example's, 8082 by default.
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const lines = Number(process.argv[2] ?? 300);
const CHARS = 60;
const GAP_MS = 150;
const TEXT = 'let total = value + 1; '.repeat(3).slice(0, CHARS);
const PORT = 9222;
const WEB_PORT = process.argv[3] ?? '8082';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const ms = (n) => `${n.toFixed(1)} ms`;

execFileSync('adb', ['forward', `tcp:${PORT}`, 'localabstract:chrome_devtools_remote']);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => new RegExp(`//(localhost|127\\.0\\.0\\.1):${WEB_PORT}/`).test(p.url()));
  if (!page) throw new Error(`open http://localhost:${WEB_PORT} in Chrome on the phone first`);
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
  await page.evaluate(() => {
    for (const list of Object.values(globalThis.__codepadProbe)) list.length = 0;
  });
  const cdp = await page.context().newCDPSession(page);
  for (const ch of TEXT) {
    await cdp.send('Input.insertText', { text: ch });
    await sleep(GAP_MS);
  }
  await sleep(500);
  const probe = await page.evaluate(() => globalThis.__codepadProbe);
  const stats = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    return `p50 ${ms(pct(sorted, 0.5))}, p95 ${ms(pct(sorted, 0.95))}, max ${ms(sorted.at(-1) ?? 0)}`;
  };
  console.log(`${lines} lines, ${probe.work.length} of ${CHARS} keys`);
  for (const part of ['work', 'handler', 'engine', 'draw']) {
    console.log(`  ${part.padEnd(8)}${stats(probe[part])}`);
  }
  console.log(`  largest frame ${ms(Math.max(0, ...probe.pumps))} of ${probe.pumps.length}`);
  console.log(`  engine tasks ${stats(probe.tasks)} of ${probe.tasks.length}`);
  await page.evaluate(() => localStorage.removeItem('codepad_debug'));
} finally {
  await browser.close();
  execFileSync('adb', ['forward', '--remove', `tcp:${PORT}`]);
}
