// Turns the codepad-ime logcat lines on stdin into one replay fixture on stdout.
import { readFileSync } from 'node:fs';

const name = process.argv[2] ?? 'recording';
const device = process.argv[3] || 'the phone';
const lines = readFileSync(0, 'utf8')
  .split('\n')
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
  if (entry.call === 'paint') continue;
  if (entry.call === 'open') {
    current = {
      ime: entry.ime,
      inputType: entry.inputType,
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
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
