import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { listResourcePaths, inspectResource, ResourceReadError, MAX_RESOURCE_BYTES } from '../src/lib/server/resource-files.ts';

async function fixture(t: TestContext) {
  const parent = await fs.mkdtemp(join(tmpdir(), 'steward-resources-'));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const root = await fs.realpath(parent); const directory = join(root, 'ds-test');
  await fs.mkdir(directory);
  return { root, directory };
}

test('suggests only root regular files/directories, not links, hidden entries or template files', async (t) => {
  const { root, directory } = await fixture(t);
  for (const name of ['items.csv', 'README.md', 'datapackage.json', 'dataset.config.json', 'buckets.csv', '.env']) await fs.writeFile(join(directory, name), '');
  await fs.mkdir(join(directory, 'images.v2'));
  await fs.symlink(join(directory, 'items.csv'), join(directory, 'linked.csv'));
  assert.deepEqual(await listResourcePaths(root, 'ds-test'), [{ path: 'images.v2', kind: 'directory' }, { path: 'items.csv', kind: 'file' }]);
});

test('counts data without returning contents, handles empty files and counts nested regular files recursively', async (t) => {
  const { root, directory } = await fixture(t);
  await fs.writeFile(join(directory, 'items.csv'), 'a,b\n1,2\n3,4\n');
  await fs.writeFile(join(directory, 'empty.tsv'), 'a\tb\n');
  await fs.writeFile(join(directory, 'data.json'), '[1,2,3]');
  await fs.writeFile(join(directory, 'items.jsonl'), '{}\nnull\n');
  await fs.writeFile(join(directory, 'opaque.pdf'), Buffer.from([0xff]));
  await fs.mkdir(join(directory, 'images.v2/nested'), { recursive: true });
  await fs.writeFile(join(directory, 'images.v2/one.bin'), 'first secret');
  await fs.writeFile(join(directory, 'images.v2/nested/.hidden'), 'second secret');
  for (const [path, value, unit] of [['items.csv', 2, 'rows'], ['empty.tsv', 0, 'rows'], ['data.json', 3, 'items'], ['items.jsonl', 2, 'items'], ['images.v2/', 2, 'files']] as const) {
    const result = await inspectResource(root, 'ds-test', path);
    assert.equal(result.status, 'counted');
    if (result.status === 'counted') { assert.equal(result.value, value); assert.equal(result.unit, unit); }
    assert.doesNotMatch(JSON.stringify(result), /secret|steward-resources/);
  }
  assert.equal((await inspectResource(root, 'ds-test', 'opaque.pdf')).status, 'unsupported');
});

test('refuses traversal, URLs, hidden paths, symlinks, hardlinks and symlinked datasets', async (t) => {
  const { root, directory } = await fixture(t);
  const outside = join(root, 'outside.json'); await fs.writeFile(outside, '["private marker"]');
  await fs.writeFile(join(root, 'traversal.json'), '["unlinked outside marker"]');
  await fs.symlink(outside, join(directory, 'link.json'));
  await fs.link(outside, join(directory, 'hard.json'));
  await fs.symlink(root, join(directory, 'escape'), 'dir');
  await fs.symlink(directory, join(root, 'ds-link'), 'dir');
  for (const path of ['../traversal.json', '../outside.json', '/etc/passwd', 'https://example.com/a.json', 'C:\\secret.json', '.env', 'x/../outside.json', 'link.json', 'hard.json', 'escape/outside.json', 'a\0.csv']) {
    await assert.rejects(inspectResource(root, 'ds-test', path), (error: unknown) => error instanceof ResourceReadError && !error.message.includes(root));
  }
  await assert.rejects(inspectResource(root, 'ds-link', 'items.csv'), ResourceReadError);
  await fs.mkdir(join(directory, 'folder')); await fs.symlink(outside, join(directory, 'folder/link'));
  await assert.rejects(inspectResource(root, 'ds-test', 'folder'), /link|regular/i);
  assert.equal(await fs.readFile(outside, 'utf8'), '["private marker"]');
});

test('rejects files that change between inspection and opening', async (t) => {
  const { root, directory } = await fixture(t);
  const path = join(directory, 'items.csv'); await fs.writeFile(path, 'a\n1\n');
  const open = fs.open.bind(fs);
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (args[0] === path) await fs.writeFile(path, 'a\n1\n2\n');
    return open(...args);
  });
  await assert.rejects(inspectResource(root, 'ds-test', 'items.csv'), /changed/i);
});

test('bounds directory depth, concurrent counters and does not return partial counts', async (t) => {
  const { root, directory } = await fixture(t);
  await fs.mkdir(join(directory, ...Array(34).fill('nested')), { recursive: true });
  await assert.rejects(inspectResource(root, 'ds-test', 'nested'), /32-level limit/);
  await fs.writeFile(join(directory, 'items.csv'), 'a\n1\n');
  const results = await Promise.allSettled([1, 2, 3].map(() => inspectResource(root, 'ds-test', 'items.csv')));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof ResourceReadError && rejected.reason.status === 503);
  assert.equal((await inspectResource(root, 'ds-test', 'items.csv')).status, 'counted');
});

test('refuses oversized and invalid UTF-8/JSON files without producing a partial count', async (t) => {
  const { root, directory } = await fixture(t);
  const big = join(directory, 'large.csv'); await fs.writeFile(big, ''); await fs.truncate(big, MAX_RESOURCE_BYTES + 1);
  await fs.writeFile(join(directory, 'invalid.csv'), Buffer.from([0xff]));
  await fs.writeFile(join(directory, 'broken.json'), '{invalid');
  await assert.rejects(inspectResource(root, 'ds-test', 'large.csv'), /limit/i);
  await assert.rejects(inspectResource(root, 'ds-test', 'invalid.csv'), /UTF-8/i);
  await assert.rejects(inspectResource(root, 'ds-test', 'broken.json'), /Invalid JSON/);
});
