import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cacheDir } from './manifest.ts';

export function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export const dirPattern = (p: string): string => `/${p.replace(/^\/+|\/+$/g, '')}/`;
export const filePattern = (p: string): string => `/${p.replace(/^\/+/, '')}`;

// Blobless sparse checkout: git downloads only the blobs under the patterns.
// Adding patterns to an existing checkout fetches only the new blobs.
export function ensureCheckout(repo: string, rev: string, patterns: string[]): string {
  const dir = path.join(cacheDir, 'git', `${repo.replace('/', '__')}@${rev}`);
  const stamp = path.join(dir, '.codepad-patterns');
  const wanted = [...new Set(patterns)].sort().join('\n');
  if (existsSync(stamp) && readFileSync(stamp, 'utf8') === wanted) return dir;
  if (!existsSync(path.join(dir, '.git'))) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    git(['init', '-q'], dir);
    git(['remote', 'add', 'origin', `https://github.com/${repo}.git`], dir);
    git(['sparse-checkout', 'set', '--no-cone', ...wanted.split('\n')], dir);
    git(['fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', rev], dir);
    git(['checkout', '-q', 'FETCH_HEAD'], dir);
  } else {
    git(['sparse-checkout', 'set', '--no-cone', ...wanted.split('\n')], dir);
  }
  writeFileSync(stamp, wanted);
  return dir;
}
