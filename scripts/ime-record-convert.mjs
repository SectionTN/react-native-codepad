// Turns the codepad-ime log lines on stdin into one replay fixture: logcat or log stream, any prefix before the
// JSON. Writes to stdout, or into <outDir>/<name>.json when a directory is given.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const name = process.argv[2] ?? 'recording';
const device = process.argv[3] || 'the phone';
const outDir = process.argv[4];
const lines = readFileSync(0, 'utf8')
  .split('\n')
  .map((line) => {
    const start = line.indexOf('{');
    return start < 0 ? '' : line.slice(start);
  })
  .filter((line) => line.startsWith('{'));
const sessions = [];
let current = null;
for (const line of lines) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }
  if (entry.call === 'paint' || entry.call === 'frame' || entry.call === 'parse') continue;
  if (entry.call === 'open') {
    current = {
      ime: entry.ime,
      ...(entry.inputType === undefined ? {} : { inputType: entry.inputType }),
      initial: { text: entry.after?.text ?? '', selection: entry.after?.sel ?? [0, 0] },
      steps: [],
    };
    sessions.push(current);
    continue;
  }
  if (!current) continue;
  const step = { t: entry.t, call: entry.call, args: entry.args ?? [] };
  if ('ret' in entry) step.ret = entry.ret;
  if (entry.after) step.after = entry.after;
  current.steps.push(step);
}
if (sessions.length === 0) {
  console.error('no codepad-ime lines found; was codepad_debug set before the editor got focus?');
  process.exit(1);
}
const out = {
  name,
  source: `recorded on ${device}`,
  ime: sessions[0].ime,
  recordedAt: new Date().toISOString().slice(0, 10),
  sessions: sessions.map(({ ime: _ime, ...session }) => session),
};
const json = `${JSON.stringify(out, null, 2)}\n`;
if (outDir) {
  const file = join(outDir, `${name}.json`);
  writeFileSync(file, json);
  const steps = out.sessions.reduce((n, session) => n + session.steps.length, 0);
  console.log(`wrote ${file} (${steps} steps)`);
} else {
  process.stdout.write(json);
}
