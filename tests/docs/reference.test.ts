import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');
const page = (name: string) =>
  readFileSync(path.join(ROOT, `website/docs/reference/${name}.md`), 'utf8');

function api() {
  const source = ts.createSourceFile(
    'types.ts',
    readFileSync(path.join(ROOT, 'src/types.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const props: string[] = [];
  const methods: string[] = [];
  const types: string[] = [];
  source.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node)) {
      types.push(node.name.text);
      for (const m of node.members) {
        if (node.name.text === 'CodeEditorProps' && ts.isPropertySignature(m)) {
          props.push((m.name as ts.Identifier).text);
        }
        if (node.name.text === 'CodeEditorRef' && ts.isMethodSignature(m)) {
          methods.push((m.name as ts.Identifier).text);
        }
      }
    } else if (ts.isTypeAliasDeclaration(node)) {
      types.push(node.name.text);
    }
  });
  assert.ok(props.length > 20 && methods.length > 30 && types.length > 10);
  return { props, methods, types };
}

test('every prop, method and type in src/types.ts is documented', () => {
  const { props, methods, types } = api();
  const propsAndEvents = page('props') + page('events');
  const all = propsAndEvents + page('methods') + page('types') + page('theme-tokens');
  assert.deepEqual(
    props.filter((p) => !propsAndEvents.includes(`\`${p}\``)),
    [],
    'props missing from props.md or events.md',
  );
  assert.deepEqual(
    methods.filter((m) => !page('methods').includes(`\`${m}(`)),
    [],
    'methods missing from methods.md',
  );
  assert.deepEqual(
    types.filter((t) => !all.includes(`\`${t}\``)),
    [],
    'types missing from the reference',
  );
});

test('the agent skill names only props, methods and languages that exist', () => {
  const { props, methods } = api();
  const dir = path.join(ROOT, 'skills/react-native-codepad');
  const skill = readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const text = skill + readFileSync(path.join(dir, 'references/recipes.md'), 'utf8');
  const called = [...text.matchAll(/(?:`|\.current\?\.)([a-z]\w*)\(/g)].flatMap((m) => m[1] ?? []);
  assert.deepEqual(
    called.filter((c) => !methods.includes(c) && !/^use[A-Z]/.test(c)),
    [],
    'calls that are not CodeEditorRef methods',
  );
  const attributes = [...text.matchAll(/<CodeEditor\b([\s\S]*?)\/>/g)].flatMap((m) =>
    (m[1] ?? '').split('\n').flatMap((line) => line.trim().match(/^(\w+)(?:=|$)/)?.[1] ?? []),
  );
  assert.deepEqual(
    attributes.filter((a) => !props.includes(a) && a !== 'ref' && a !== 'style'),
    [],
    'CodeEditor attributes that are not props',
  );
  const idLine = skill.match(/^- One `react-native-codepad-lang-<id>`.*$/m)?.[0] ?? '';
  const ids = [...idLine.matchAll(/`([a-z]+)`/g)].flatMap((m) => m[1] ?? []);
  const packages = readdirSync(path.join(ROOT, 'languages')).filter((d) =>
    existsSync(path.join(ROOT, 'languages', d, 'package.json')),
  );
  assert.deepEqual(ids.sort(), packages.sort(), 'language ids in SKILL.md');
});
