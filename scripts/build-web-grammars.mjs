// Builds every grammar as a WASM side module into its package's web folder: yarn build:web-grammars [id...]
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const build = join(root, 'cpp/web/build.sh');
const PARALLEL = 4;

const jobs = [];
const { languages } = JSON.parse(readFileSync(join(root, 'languages/grammars.json'), 'utf8'));
for (const entry of languages) {
  for (const g of entry.grammars) {
    jobs.push({
      id: entry.id,
      grammar: g.name,
      src: join(root, 'languages', entry.id, 'grammar', g.src),
      out: join(root, 'languages', entry.id, 'web', `${g.name}.wasm`),
    });
  }
}
// The example's custom languages, one grammar each, named by their queries folder.
const modules = join(root, 'example/modules');
for (const pkg of existsSync(modules) ? readdirSync(modules) : []) {
  const dir = join(modules, pkg);
  if (!existsSync(join(dir, 'grammar/src/parser.c'))) continue;
  for (const grammar of readdirSync(join(dir, 'queries'))) {
    jobs.push({
      id: grammar,
      grammar,
      src: join(dir, 'grammar/src'),
      out: join(dir, 'web', `${grammar}.wasm`),
    });
  }
}

const wanted = process.argv.slice(2);
const queue = wanted.length ? jobs.filter((j) => wanted.includes(j.id)) : jobs;
if (wanted.length && queue.length === 0) {
  console.error(`no grammar for ${wanted.join(', ')}`);
  process.exit(1);
}

let failed = 0;
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const code = await new Promise((resolve) => {
      const child = spawn(build, ['--grammar', job.src, job.out], { stdio: 'inherit' });
      child.on('close', resolve);
    });
    if (code === 0) console.log(`${job.grammar}: ${job.out.slice(root.length + 1)}`);
    else failed++;
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
if (failed) {
  console.error(`${failed} grammar builds failed`);
  process.exit(1);
}
