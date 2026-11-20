import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { MAX_DATASET_TEXT_BYTES } from '../src/lib/dataset-text-limits.ts';
import { saveMetadata } from '../src/lib/server/metadata-save.ts';

const text = JSON.stringify({ name: 'example', title: 'Example', description: 'Supplied description',
  keywords: ['task:catalogue', 'project:archive', 'stage:master'],
  resources: [{ name: 'input', title: 'Input', path: 'missing.csv', count: 42, extra: true }], unknown: { keep: true },
});

async function fixture(t: TestContext) {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'steward-readme-save-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ds-example');
  await fs.mkdir(directory);
  await fs.writeFile(join(directory, 'datapackage.json'), '{}');
  return { root, directory, path: join(directory, 'README.md') };
}

test('Save generates a README using saved counts without reading resources; identical output is not replaced', async (t) => {
  const { root, directory, path } = await fixture(t);
  await fs.writeFile(join(directory, 'buckets.csv'), 'category,count\nBooks,7\n');
  const first = await saveMetadata(root, 'ds-example', text);
  assert.deepEqual(first.issues, []);
  assert.equal(first.readme, 'updated');
  const readme = await fs.readFile(path, 'utf8');
  assert.match(readme, /42 rows/);
  assert.match(readme, /Books \| 7/);
  assert.equal(await fs.readFile(join(directory, 'datapackage.json'), 'utf8'), text);
  const before = await fs.stat(path, { bigint: true });
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'unchanged');
  const after = await fs.stat(path, { bigint: true });
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeNs, before.mtimeNs);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['README.md', 'buckets.csv', 'datapackage.json']);
});

test('Save preserves existing README permissions and human notes, including without buckets', async (t) => {
  const { root, path } = await fixture(t);
  await fs.writeFile(path, '# Handwritten\n\nKeep this.\n', { mode: 0o640 });
  const before = await fs.stat(path);
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'updated');
  const readme = await fs.readFile(path, 'utf8');
  assert.ok(readme.endsWith('# Handwritten\n\nKeep this.\n'));
  assert.match(readme, /No buckets available/);
  const after = await fs.stat(path);
  assert.equal(after.mode & 0o777, before.mode & 0o777);
  assert.equal(after.uid, before.uid);
  assert.equal(after.gid, before.gid);
});

test('malformed, oversized and unsafe bucket files leave README untouched but metadata saved', async (t) => {
  const { root, directory, path } = await fixture(t);
  const buckets = join(directory, 'buckets.csv');
  await fs.writeFile(path, '# Keep');
  for (const content of ['label,other,count\nBooks,2,7\n', 'label,count\nBooks,-1', new Uint8Array([255]), 'x'.repeat(1_000_001)]) {
    await fs.writeFile(buckets, content);
    const result = await saveMetadata(root, 'ds-example', text);
    assert.equal(result.readme, 'failed');
    assert.equal(result.message.includes(root), false);
    assert.equal(await fs.readFile(path, 'utf8'), '# Keep');
    assert.equal(await fs.readFile(join(directory, 'datapackage.json'), 'utf8'), text);
  }
  await fs.unlink(buckets);
  await fs.symlink(path, buckets);
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
});

test('README symlinks, hard links, directories and oversized files are not replaced', async (t) => {
  const { root, directory, path } = await fixture(t);
  const outside = join(root, 'outside');
  await fs.writeFile(outside, 'outside marker');
  await fs.symlink(outside, path);
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  assert.equal((await fs.lstat(path)).isSymbolicLink(), true);
  await fs.unlink(path);
  await fs.link(outside, path);
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  assert.equal((await fs.stat(path)).nlink, 2);
  await fs.unlink(path);
  await fs.mkdir(path);
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  await fs.rmdir(path);
  await fs.writeFile(path, new Uint8Array([255]));
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  assert.deepEqual(await fs.readFile(path), Buffer.from([255]));
  await fs.writeFile(path, 'x'.repeat(MAX_DATASET_TEXT_BYTES + 1));
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  assert.equal((await fs.stat(path)).size, MAX_DATASET_TEXT_BYTES + 1);
  assert.equal(await fs.readFile(outside, 'utf8'), 'outside marker');
  assert.deepEqual((await fs.readdir(directory)).sort(), ['README.md', 'datapackage.json']);
});

test('README permission and sync failures keep its bytes intact after metadata Save', async (t) => {
  const { root, directory, path } = await fixture(t);
  await fs.writeFile(path, '# Keep');
  const access = fs.access.bind(fs);
  const refused = t.mock.method(fs, 'access', async (...args: Parameters<typeof fs.access>) => {
    if (args[0] === path) throw new Error('Simulated permission failure');
    return access(...args);
  });
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  refused.mock.restore();
  const open = fs.open.bind(fs);
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const file = await open(...args);
    if (String(args[0]).includes('.README.md-') && args[1] === 'wx') {
      t.mock.method(file, 'sync', async () => { throw new Error('Simulated README sync failure'); });
    }
    return file;
  });
  assert.equal((await saveMetadata(root, 'ds-example', text)).readme, 'failed');
  assert.equal(await fs.readFile(path, 'utf8'), '# Keep');
  assert.equal(await fs.readFile(join(directory, 'datapackage.json'), 'utf8'), text);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['README.md', 'datapackage.json']);
});

test('generated output is bounded before writing', async (t) => {
  const { root, path } = await fixture(t);
  await fs.writeFile(path, '# Keep');
  const large = JSON.stringify({ ...JSON.parse(text), description: '&'.repeat(1_100_000) });
  assert.equal((await saveMetadata(root, 'ds-example', large)).readme, 'failed');
  assert.equal(await fs.readFile(path, 'utf8'), '# Keep');
});

test('a README rename failure keeps metadata saved, retains README and removes its temporary file', async (t) => {
  const { root, directory, path } = await fixture(t);
  await fs.writeFile(path, '# Keep');
  const rename = fs.rename.bind(fs);
  t.mock.method(fs, 'rename', async (from: Parameters<typeof fs.rename>[0], to: Parameters<typeof fs.rename>[1]) => {
    if (to === path) throw new Error('Simulated private-path failure');
    return rename(from, to);
  });
  const result = await saveMetadata(root, 'ds-example', text);
  assert.equal(result.readme, 'failed');
  assert.equal(await fs.readFile(join(directory, 'datapackage.json'), 'utf8'), text);
  assert.equal(await fs.readFile(path, 'utf8'), '# Keep');
  assert.deepEqual((await fs.readdir(directory)).sort(), ['README.md', 'datapackage.json']);
});
