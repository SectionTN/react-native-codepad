import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { captureNames } from './captures.ts';
import { splitPatterns } from './scm.ts';

type GrammarInfo = { name: string; injects: string[]; captures: string[] };
type PackageInfo = {
  id: string;
  name: string;
  grammar: string;
  grammars: GrammarInfo[];
};

const PAGE = 'website/docs/reference/languages.md';

/** Languages named by #set! in the injection query, plus "from the source" when a capture supplies the name. */
export function injectionTargets(injections: string): string[] {
  const targets = new Set<string>();
  let fromSource = false;
  for (const pattern of splitPatterns(injections)) {
    if (pattern.captures.includes('injection.language')) fromSource = true;
    for (const p of pattern.predicates) {
      const [key, value] = p.args;
      if (p.name === 'set!' && key?.value === 'injection.language' && value)
        targets.add(value.value);
    }
  }
  const out = [...targets].sort();
  if (fromSource) out.push('from the source');
  return out;
}

function readPackages(languagesDir: string): PackageInfo[] {
  const out: PackageInfo[] = [];
  for (const id of readdirSync(languagesDir).sort()) {
    const root = path.join(languagesDir, id);
    const manifest = path.join(root, 'package.json');
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
      name: string;
      codepad?: { generated?: boolean; grammar?: string };
    };
    if (!pkg.codepad?.generated) continue;
    const queries = path.join(root, 'queries');
    const grammars: GrammarInfo[] = [];
    for (const name of (existsSync(queries) ? readdirSync(queries) : []).sort()) {
      const highlights = path.join(queries, name, 'highlights.scm');
      if (!existsSync(highlights)) continue;
      const injections = path.join(queries, name, 'injections.scm');
      grammars.push({
        name,
        injects: existsSync(injections) ? injectionTargets(readFileSync(injections, 'utf8')) : [],
        captures: captureNames(readFileSync(highlights, 'utf8')),
      });
    }
    out.push({
      id,
      name: pkg.name,
      grammar: pkg.codepad.grammar ?? '',
      grammars,
    });
  }
  return out;
}

function grammarLink(spec: string): string {
  const at = spec.lastIndexOf('@');
  if (at < 0) return spec;
  const repo = spec.slice(0, at);
  const rev = spec.slice(at + 1);
  return `[\`${repo}\`](https://github.com/${repo}/tree/${rev})`;
}

/** The reference page for every generated package under languagesDir, as Docusaurus markdown. */
export function languagesPage(languagesDir: string): string {
  const packages = readPackages(languagesDir);
  // Package names, grammar ids and capture names are identifiers: code font keeps the prose linter off them.
  const code = (s: string) => `\`${s}\``;
  const rows = packages.map((p) => {
    const ids = p.grammars.map((g) => code(g.name)).join(', ');
    const injects = [...new Set(p.grammars.flatMap((g) => g.injects))];
    const named = injects
      .filter((i) => i !== 'from the source')
      .sort()
      .map(code);
    if (injects.includes('from the source')) named.push('from the source');
    return `| ${code(p.name)} | ${ids} | ${grammarLink(p.grammar)} | ${named.length ? named.join(', ') : 'none'} |`;
  });
  const sections = packages.flatMap((p) =>
    p.grammars.map((g) => `### ${code(g.name)}\n\n${g.captures.map(code).join(', ')}`),
  );
  return `---
title: Language packages
description: Every language package CodePad ships, with its language ids, its grammar, the languages it embeds and its token names.
sidebar_position: 6
---

Install a package next to the core and pass one of its ids as \`language\`. A package can hold more than one grammar: \`markdown_inline\` is used only inside Markdown, \`php_only\` reads PHP without the \`<?php\` tag, and \`dtd\` reads a standalone DTD file.

The Embedded languages column lists the language names a package marks inside its own code, such as \`css\` inside HTML. That code highlights when a package or a [custom language](/guides/custom-languages/) with the same id is installed. "From the source" means the document names the language, as the word after a Markdown fence does.

| Package | \`language\` | Grammar | Embedded languages |
| --- | --- | --- | --- |
${rows.join('\n')}

## Token names

Each grammar gives a name to every piece of code it highlights. These names are the keys of a theme's \`tokens\`. When a theme has no entry for a name, it uses the entry for the shorter name, so \`keyword.return\` falls back to \`keyword\`.

${sections.join('\n\n')}
`;
}

export function writeLanguagesPage(languagesDir: string, repoRoot: string): void {
  const file = path.join(repoRoot, PAGE);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, languagesPage(languagesDir));
}
