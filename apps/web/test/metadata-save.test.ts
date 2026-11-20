import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { readSaveText, saveMetadata } from '../src/lib/server/metadata-save.ts';
import { MAX_DATASET_TEXT_BYTES } from '../src/lib/dataset-text-limits.ts';

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(join(tmpdir(), 'steward-save-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ds-example');
  await fs.mkdir(directory);
  const path = join(directory, 'datapackage.json');
  await fs.writeFile(path, '{"title":"Original"}\n', { mode: 0o640 });
  return { root, directory, path };
}

test('saves the exact admitted draft and reports metadata issues without reading resources', async (t) => {
  const { root, directory, path } = await fixture(t);
  await fs.writeFile(join(directory, 'README.md'), '# Untouched');
  await fs.writeFile(join(directory, 'input.csv'), 'private resource');
  await fs.writeFile(join(directory, 'dataset.config.json'), '{invalid local policy');
  const before = await fs.stat(path);
  const text = '{\n "title":"中文 😀", "unknown":{"keep":true}, "resources":[{"path":"missing.csv","extra":42}]\n}\n';
  const result = await saveMetadata(root, 'ds-example', text);
  assert.ok(result.issues.length, 'incomplete metadata is saveable with reported issues');
  assert.equal(result.readme, 'skipped');
  assert.equal(await fs.readFile(path, 'utf8'), text);
  const after = await fs.stat(path);
  assert.equal(after.mode & 0o777, before.mode & 0o777);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
  assert.equal(await fs.readFile(join(directory, 'README.md'), 'utf8'), '# Untouched');
  assert.equal(await fs.readFile(join(directory, 'input.csv'), 'utf8'), 'private resource');
  assert.deepEqual((await fs.readdir(directory)).sort(), ['README.md', 'datapackage.json', 'dataset.config.json', 'input.csv']);
});

test('refuses malformed, duplicate-key, unsafe-number and over-limit candidates without writing', async (t) => {
  const { root, directory, path } = await fixture(t);
  const original = await fs.readFile(path, 'utf8');
  for (const text of ['{bad', '[]', '{"x":1,"x":2}', '{"x":9007199254740993}', '{"x":-0}',
    '{"x":' + '['.repeat(130) + '0' + ']'.repeat(130) + '}', ' '.repeat(MAX_DATASET_TEXT_BYTES + 1)]) {
    await assert.rejects(saveMetadata(root, 'ds-example', text));
    assert.equal(await fs.readFile(path, 'utf8'), original);
    assert.deepEqual(await fs.readdir(directory), ['datapackage.json']);
  }
});

test('only replaces an existing regular descriptor in a discovered dataset', async (t) => {
  const { root, directory, path } = await fixture(t);
  const outside = join(root, 'outside.json');
  await fs.writeFile(outside, 'outside marker');
  for (const name of ['../', 'ds-example/..', 'ds-missing']) {
    await assert.rejects(saveMetadata(root, name, '{}'));
  }
  await fs.unlink(path);
  await assert.rejects(saveMetadata(root, 'ds-example', '{}'));
  await fs.symlink(outside, path);
  await assert.rejects(saveMetadata(root, 'ds-example', '{}'));
  await fs.unlink(path);
  await fs.link(outside, path);
  await assert.rejects(saveMetadata(root, 'ds-example', '{}'));
  await fs.unlink(path);
  await fs.mkdir(path);
  await assert.rejects(saveMetadata(root, 'ds-example', '{}'));
  assert.equal(await fs.readFile(outside, 'utf8'), 'outside marker');
  assert.deepEqual(await fs.readdir(directory), ['datapackage.json']);
});

test('a failed rename leaves the original intact and removes the owned temporary file', async (t) => {
  const { root, directory, path } = await fixture(t);
  const original = await fs.readFile(path, 'utf8');
  t.mock.method(fs, 'rename', async () => { throw new Error('Simulated rename failure'); });
  await assert.rejects(saveMetadata(root, 'ds-example', '{"title":"Changed"}'), /Simulated rename failure/);
  assert.equal(await fs.readFile(path, 'utf8'), original);
  assert.deepEqual(await fs.readdir(directory), ['datapackage.json']);
});

test('a failed temporary-file sync does not replace or truncate the descriptor', async (t) => {
  const { root, directory, path } = await fixture(t);
  const original = await fs.readFile(path, 'utf8');
  const open = fs.open.bind(fs);
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const file = await open(...args);
    if (args[1] === 'wx') t.mock.method(file, 'sync', async () => { throw new Error('Simulated sync failure'); });
    return file;
  });
  await assert.rejects(saveMetadata(root, 'ds-example', '{}'), /Simulated sync failure/);
  assert.equal(await fs.readFile(path, 'utf8'), original);
  assert.deepEqual(await fs.readdir(directory), ['datapackage.json']);
});

test('bounds streamed request bytes without trusting Content-Length and refuses invalid UTF-8', async () => {
  const request = (bytes: Uint8Array<ArrayBuffer>) => new Request('http://localhost/save', {
    method: 'POST', body: bytes, headers: { 'content-type': 'application/json', 'content-length': '2' },
  });
  assert.equal(await readSaveText(request(new TextEncoder().encode('{"title":"中文"}'))), '{"title":"中文"}');
  await assert.rejects(readSaveText(request(new Uint8Array([0xff]))));
  await assert.rejects(readSaveText(request(new Uint8Array(MAX_DATASET_TEXT_BYTES + 1))));
});
