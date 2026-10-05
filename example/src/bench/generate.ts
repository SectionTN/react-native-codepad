const NAMES = ['user', 'order', 'item', 'cache', 'token', 'config', 'stream', 'buffer'];

/** Deterministic JavaScript that parses and highlights like real code, about 35 characters per line. */
export function generateJavaScript(lines: number): string {
  const out: string[] = [];
  let n = 0;
  while (out.length < lines) {
    const name = NAMES[n % NAMES.length];
    out.push(
      `// block ${n}: ${name} helpers`,
      `import { load${n} } from './${name}/${n}';`,
      `export async function get${name}${n}(id, retries = ${n % 5}) {`,
      `  const key = \`${name}:\${id}\`;`,
      '  for (let attempt = 0; attempt <= retries; attempt++) {',
      '    const hit = cache.get(key);',
      '    if (hit !== undefined && hit.expires > Date.now()) return hit.value;',
      '    try {',
      `      const value = await load${n}(id, { timeout: ${100 + (n % 7) * 50} });`,
      `      cache.set(key, { value, expires: Date.now() + ${1000 * (1 + (n % 9))} });`,
      '      return value;',
      '    } catch (error) {',
      `      if (attempt === retries) throw new Error("${name} failed: " + error.message);`,
      '    }',
      '  }',
      '  return null;',
      '}',
      '',
    );
    n++;
  }
  out.length = lines;
  return out.join('\n');
}
