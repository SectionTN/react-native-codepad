// A minimal WASM module whose only content is function imports from env, for the import check tests.
export function wasmImporting(names: string[]): Uint8Array {
  const text = (s: string) => [s.length, ...Buffer.from(s, 'utf8')];
  const imports = [names.length, ...names.flatMap((n) => [...text('env'), ...text(n), 0x00, 0x00])];
  const section = (id: number, body: number[]) => [id, body.length, ...body];
  return Uint8Array.from([
    0x00,
    0x61,
    0x73,
    0x6d,
    0x01,
    0x00,
    0x00,
    0x00,
    ...section(1, [0x01, 0x60, 0x00, 0x00]),
    ...section(2, imports),
  ]);
}
