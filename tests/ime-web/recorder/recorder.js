// Records what a browser keyboard sends to a textarea that holds a window of a document, as WebInputSession will.
const WINDOW_CAP = 8192;
const SAMPLE = Array.from({ length: 30 }, (_, i) =>
  i % 5 === 0 ? `def step_${i}(value):` : `    total = value + ${i}`,
).join('\n');
const INITIAL_CARET = SAMPLE.indexOf('\n', SAMPLE.indexOf('step_10'));

const ta = document.getElementById('ta');
const statusLine = document.getElementById('status');
const shown = document.getElementById('doc');
const params = new URLSearchParams(location.search);
const suggest = params.has('suggest');
// The form fields can come from the URL, for keyboards that cannot type them in Latin letters.
for (const field of ['name', 'browser', 'keyboard']) {
  if (params.has(field)) document.getElementById(field).value = params.get(field);
}
for (const [name, on, off] of [
  ['autocomplete', 'on', 'off'],
  ['autocorrect', 'on', 'off'],
  ['autocapitalize', 'sentences', 'off'],
  ['spellcheck', 'true', 'false'],
]) {
  ta.setAttribute(name, suggest ? on : off);
}

let doc = SAMPLE;
let anchor = INITIAL_CARET;
let head = INITIAL_CARET;
let win = { start: 0, value: '', line: 0 };
let composing = false;
let events = [];
const started = performance.now();

const lineAt = (offset) => doc.slice(0, offset).split('\n').length - 1;
const lineStart = (line) => {
  let at = 0;
  for (let i = 0; i < line; i++) at = doc.indexOf('\n', at) + 1;
  return at;
};
const lineEnd = (line) => {
  const next = doc.indexOf('\n', lineStart(line));
  return next < 0 ? doc.length : next;
};
const lastLine = () => lineAt(doc.length);

// The caret's line and its two neighbors, widened to a selection, at most WINDOW_CAP units around the head.
function windowAround() {
  const first = Math.max(0, lineAt(Math.min(anchor, head)) - 1);
  const last = Math.min(lastLine(), lineAt(Math.max(anchor, head)) + 1);
  let start = lineStart(first);
  let end = lineEnd(last);
  if (end - start > WINDOW_CAP) {
    start = Math.min(Math.max(start, head - WINDOW_CAP / 2), end - WINDOW_CAP);
    end = start + WINDOW_CAP;
  }
  return { start, end };
}

const state = () => ({ value: ta.value, start: ta.selectionStart, end: ta.selectionEnd });

function record(type, extra = {}) {
  events.push({
    t: Math.round(performance.now() - started),
    type,
    ...extra,
    isComposing: composing,
    windowStart: win.start,
    ta: state(),
  });
  render();
}

function sync() {
  const { start, end } = windowAround();
  win = { start, value: doc.slice(start, end), line: lineAt(head) };
  if (ta.value !== win.value) ta.value = win.value;
  const a = anchor - start;
  const h = head - start;
  ta.setSelectionRange(Math.min(a, h), Math.max(a, h), h < a ? 'backward' : 'forward');
  record('sync');
}

// Takes the model selection from the textarea and moves the window when the head left its middle line.
function follow() {
  const backward = ta.selectionDirection === 'backward';
  anchor = win.start + (backward ? ta.selectionEnd : ta.selectionStart);
  head = win.start + (backward ? ta.selectionStart : ta.selectionEnd);
  if (!composing && lineAt(head) !== win.line) sync();
}

function render() {
  statusLine.textContent = `head ${head}, line ${lineAt(head)}${composing ? ', composing' : ''}, ${events.length} events`;
  shown.textContent = doc;
}

ta.addEventListener('keydown', (e) =>
  record('keydown', { key: e.key, isComposing: e.isComposing }),
);
ta.addEventListener('beforeinput', (e) =>
  record('beforeinput', { inputType: e.inputType, data: e.data }),
);
ta.addEventListener('input', (e) => {
  doc = doc.slice(0, win.start) + ta.value + doc.slice(win.start + win.value.length);
  win.value = ta.value;
  record('input', { inputType: e.inputType, data: e.data });
  follow();
});
ta.addEventListener('compositionstart', (e) => {
  composing = true;
  record('compositionstart', { data: e.data });
});
ta.addEventListener('compositionupdate', (e) => record('compositionupdate', { data: e.data }));
ta.addEventListener('compositionend', (e) => {
  composing = false;
  record('compositionend', { data: e.data });
  setTimeout(() => {
    if (!composing) follow();
  }, 0);
});
document.addEventListener('selectionchange', () => {
  if (document.activeElement !== ta) return;
  record('selectionchange');
  if (!composing) follow();
});
ta.addEventListener('focus', () => record('focus'));
ta.addEventListener('blur', () => record('blur'));

function reset() {
  doc = SAMPLE;
  anchor = INITIAL_CARET;
  head = INITIAL_CARET;
  composing = false;
  events = [];
  sync();
}

document.getElementById('reset').addEventListener('click', reset);
document.getElementById('save').addEventListener('click', async () => {
  const recording = {
    name: document.getElementById('name').value.trim(),
    browser: document.getElementById('browser').value.trim(),
    keyboard: document.getElementById('keyboard').value.trim(),
    ua: navigator.userAgent,
    recordedAt: new Date().toISOString(),
    settings: { autoCloseBrackets: false, autoIndent: false },
    initial: { text: SAMPLE, selection: [INITIAL_CARET, INITIAL_CARET] },
    events,
    expected: { text: doc },
  };
  const res = await fetch('save', { method: 'POST', body: JSON.stringify(recording) });
  statusLine.textContent = `${res.status} ${await res.text()}`;
});

reset();
