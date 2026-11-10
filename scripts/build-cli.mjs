// Compiles the language command to lib/cli as ES modules; Node will not strip types under node_modules.
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Runs tsc through this node, so prepare works under npm, pnpm and yarn alike.
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
rmSync(`${root}lib/cli`, { recursive: true, force: true });
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.cli.json'], { cwd: root, stdio: 'inherit' });
writeFileSync(`${root}lib/cli/package.json`, '{"type":"module"}\n');
