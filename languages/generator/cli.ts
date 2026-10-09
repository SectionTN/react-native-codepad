import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { writeLanguagesPage } from './docs.ts';
import { emitPackage, type GrammarQueries } from './emit.ts';
import { dirPattern, ensureCheckout } from './git.ts';
import { fetchGrammar, readAbiRange } from './grammar.ts';
import { languagesDir, loadManifest, repoRoot } from './manifest.ts';
import { checkoutReader, collectQueryLangs, QUERY_KINDS, resolveQuery } from './queries.ts';
import { runReport } from './report.ts';
import { rewriteQuery } from './rewrite.ts';

function gen(ids: string[]): void {
  const manifest = loadManifest();
  const version = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    .version as string;
  const abi = readAbiRange(path.join(repoRoot, 'cpp/tree-sitter/lib/include/tree_sitter/api.h'));
  const entries = ids.length
    ? manifest.languages.filter((l) => ids.includes(l.id))
    : manifest.languages;
  const missing = ids.filter((id) => !manifest.languages.some((l) => l.id === id));
  if (missing.length) throw new Error(`unknown language ids: ${missing.join(', ')}`);
  const roots = entries.flatMap((l) => l.grammars.map((g) => g.name));
  let qdir = ensureCheckout(
    manifest.queries.repo,
    manifest.queries.rev,
    roots.map((l) => dirPattern(`runtime/queries/${l}`)),
  );
  for (let pass = 0; pass < 5; pass++) {
    const all = collectQueryLangs(qdir, roots);
    const next = ensureCheckout(
      manifest.queries.repo,
      manifest.queries.rev,
      all.map((l) => dirPattern(`runtime/queries/${l}`)),
    );
    if (collectQueryLangs(next, roots).length === all.length) break;
    qdir = next;
  }
  const read = checkoutReader(qdir);
  for (const entry of entries) {
    const outDir = path.join(languagesDir, entry.id);
    for (const keep of ['android', 'ios', 'queries', 'src', 'grammar']) {
      rmSync(path.join(outDir, keep), { recursive: true, force: true });
    }
    const { grammarDir, license } = fetchGrammar(entry, abi, outDir);
    const queries: Record<string, GrammarQueries> = {};
    let droppedTotal = 0;
    for (const g of entry.grammars) {
      const q = {
        highlights: null,
        injections: null,
        locals: null,
        indents: null,
      } as GrammarQueries;
      for (const kind of QUERY_KINDS) {
        const resolved = resolveQuery(g.name, kind, read);
        if (resolved == null) continue;
        if (kind === 'highlights' || kind === 'injections') {
          const { text, dropped } = rewriteQuery(resolved);
          droppedTotal += dropped.length;
          for (const d of dropped) {
            process.stderr.write(`warning: ${entry.id}/${g.name} ${kind}: ${d.reason}\n`);
          }
          q[kind] = text;
        } else {
          q[kind] = resolved;
        }
      }
      queries[g.name] = q;
    }
    emitPackage({
      entry,
      version,
      outDir,
      grammarDir,
      queries,
      grammarLicense: license,
      nvimRev: manifest.queries.rev,
    });
    process.stdout.write(`generated ${entry.id} (${droppedTotal} patterns dropped)\n`);
  }
  writeLanguagesPage(languagesDir, repoRoot);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'report':
    process.stdout.write(`${runReport()}\n`);
    break;
  case 'gen':
    gen(args);
    break;
  default:
    process.stderr.write('usage: node languages/generator/cli.ts <report|gen [ids...]>\n');
    process.exit(2);
}
