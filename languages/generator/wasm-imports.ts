type WasmModule = object;
type Descriptor = { module: string; name: string; kind: string };

// The CLI compiles without the DOM lib, which is where TypeScript declares WebAssembly.
declare const WebAssembly: {
  Module: {
    new (bytes: Uint8Array): WasmModule;
    imports(module: WasmModule): Descriptor[];
    exports(module: WasmModule): Omit<Descriptor, 'module'>[];
  };
};

// What a grammar side module needs from the core that the core does not export.
export function grammarImportsOutside(wasm: Uint8Array, allowed: readonly string[]): string[] {
  const module = new WebAssembly.Module(wasm);
  const own = new Set(WebAssembly.Module.exports(module).map((e) => e.name));
  const ok = new Set(allowed);
  const missing = new Set<string>();
  for (const i of WebAssembly.Module.imports(module)) {
    // GOT entries name the module's own symbols or the core's, functions and data alike.
    const got = i.module === 'GOT.func' || i.module === 'GOT.mem';
    if (!got && i.kind !== 'function') continue;
    if (got && own.has(i.name)) continue;
    if (!ok.has(i.name)) missing.add(i.name);
  }
  return [...missing].sort();
}
