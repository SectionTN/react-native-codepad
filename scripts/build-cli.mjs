// Compiles the language command to lib/cli as ES modules; Node will not strip types under node_modules.
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
rmSync(`${root}lib/cli`, { recursive: true, force: true });
execFileSync('yarn', ['tsc', '-p', 'tsconfig.cli.json'], { cwd: root, stdio: 'inherit' });
writeFileSync(`${root}lib/cli/package.json`, '{"type":"module"}\n');
