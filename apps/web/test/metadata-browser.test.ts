import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'vite';

test('metadata edits bundle for browsers and run without Node globals or filesystem modules', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'steward-metadata-browser-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    plugins: [{
      name: 'reject-node-builtins',
      enforce: 'pre',
      resolveId(source) {
        if (isBuiltin(source)) throw new Error(`Node built-in is not browser-safe: ${source}`);
      },
    }],
    build: {
      lib: {
        entry: fileURLToPath(new URL('./fixtures/metadata-browser-probe.ts', import.meta.url)),
        name: 'MetadataDraftProbe',
        formats: ['iife'],
        fileName: () => 'draft.js',
      },
      outDir: directory,
      emptyOutDir: false,
      minify: false,
      target: 'es2022',
    },
  });
  const sandbox = vm.createContext({ TextEncoder, TextDecoder });
  assert.equal(vm.runInContext('[typeof Buffer, typeof process, typeof require].join(",")', sandbox),
    'undefined,undefined,undefined');
  vm.runInContext(await fs.readFile(path.join(directory, 'draft.js'), 'utf8'), sandbox, { timeout: 10000 });
  const result: unknown = vm.runInContext('MetadataDraftProbe.runMetadataBrowserProbe()', sandbox, { timeout: 10000 });
  assert.equal(result, 'object editing and UTF-8 limits passed');
});
