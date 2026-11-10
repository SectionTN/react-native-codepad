// Sets one version on the core and the generated language packages, then refreshes the lockfile.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: node scripts/set-version.mjs <version>');
  process.exit(1);
}

const root = fileURLToPath(new URL('..', import.meta.url));

function patchJson(file, patch) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  patch(pkg);
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

patchJson(join(root, 'package.json'), (pkg) => {
  pkg.version = version;
});

const languages = join(root, 'languages');
for (const id of readdirSync(languages)) {
  const file = join(languages, id, 'package.json');
  if (!existsSync(file)) continue;
  if (!JSON.parse(readFileSync(file, 'utf8')).codepad?.generated) continue;
  patchJson(file, (pkg) => {
    pkg.version = version;
    pkg.peerDependencies['react-native-codepad'] = version;
  });
  // The generator writes the same version file next to each grammar's assets.
  const assets = join(languages, id, 'android/src/main/assets/codepad-languages');
  for (const grammar of readdirSync(assets)) writeFileSync(join(assets, grammar), `${version}\n`);
}

// The example's custom packages, written by the language command, pin the core with a caret range.
const modules = join(root, 'example/modules');
for (const dir of existsSync(modules) ? readdirSync(modules) : []) {
  const file = join(modules, dir, 'package.json');
  if (!existsSync(file)) continue;
  if (!JSON.parse(readFileSync(file, 'utf8')).codepad?.generated) continue;
  patchJson(file, (pkg) => {
    pkg.peerDependencies['react-native-codepad'] = `^${version}`;
    pkg.codepad.core = version;
  });
  const assets = join(modules, dir, 'android/src/main/assets/codepad-languages');
  for (const grammar of readdirSync(assets)) writeFileSync(join(assets, grammar), `${version}\n`);
}

// The lockfile records each package's peer pin on the core.
execFileSync('yarn', ['install'], { cwd: root, stdio: 'inherit' });
