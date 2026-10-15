import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');
const page = (name: string) =>
  readFileSync(path.join(ROOT, `website/docs/reference/${name}.md`), 'utf8');

test('every prop, method and type in src/types.ts is documented', () => {
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
