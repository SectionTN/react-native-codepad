#!/usr/bin/env node
// Prints the CHANGELOG.md section of one version, the body of its GitHub release.
import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: release-notes.mjs <version>');
  process.exit(1);
}

const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
// conventional-changelog writes "# [0.2.0](compare url) (date)" for minors and "## [0.1.1]..." for patches.
const heading = /^#{1,2} \[?(\d+\.\d+\.\d+[^\] )]*)/;
const start = lines.findIndex((line) => heading.exec(line)?.[1] === version);
if (start < 0) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const next = lines.findIndex((line, i) => i > start && heading.test(line));
const body = lines
  .slice(start + 1, next < 0 ? lines.length : next)
  .join('\n')
  .trim();
process.stdout.write(`${body}\n`);
