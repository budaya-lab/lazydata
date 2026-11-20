import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { readDescriptor, DescriptorError, MAX_DESCRIPTOR_BYTES } from '../src/lib/server/descriptor.ts';
import { MAX_DATASET_TEXT_BYTES } from '../src/lib/server/dataset-text.ts';
import { MAX_DATASET_TEXT_BYTES as SHARED_TEXT_LIMIT } from '../src/lib/dataset-text-limits.ts';

test('descriptor and README readers retain the shared draft text limit', () => {
  assert.equal(MAX_DESCRIPTOR_BYTES, SHARED_TEXT_LIMIT);
  assert.equal(MAX_DATASET_TEXT_BYTES, SHARED_TEXT_LIMIT);
});

async function fixture(t: TestContext) {
  const base = await fs.mkdtemp(join(tmpdir(), 'steward-descriptor-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const root = join(base, 'datasets');
  const dataset = join(root, 'ds-example');
  await fs.mkdir(dataset, { recursive: true });
  return { base, root, dataset, descriptor: join(dataset, 'datapackage.json') };
}

test('reads the original descriptor text without parsing or normalization', async (t) => {
  const { root, descriptor } = await fixture(t);
  for (const text of ['{\r\n  "title": "<script>not HTML</script>"\r\n}\r\n', '{invalid JSON', '']) {
    await fs.writeFile(descriptor, text);
    assert.equal(await readDescriptor(root, 'ds-example'), text);
    assert.equal(await fs.readFile(descriptor, 'utf8'), text);
  }
});

test('admits only current discovered folders, not traversal or arbitrary paths', async (t) => {
  const { base, root } = await fixture(t);
  const outside = join(base, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(join(outside, 'datapackage.json'), 'outside marker');
  await fs.symlink(outside, join(root, 'ds-link'), 'dir');
  for (const name of ['../outside', 'ds-example/../../outside', outside, 'outside', 'ds-missing', 'ds-link', 'ds-example\\..\\outside']) {
    await assert.rejects(readDescriptor(root, name), (error: unknown) => {
      assert.ok(error instanceof DescriptorError);
      assert.equal(error.status, 404);
      assert.equal(error.message.includes(base), false);
      return true;
    });
  }
});

test('rejects a dataset replaced by a symlink after discovery', async (t) => {
  const { base, root, dataset } = await fixture(t);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const outside = join(base, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(join(outside, 'datapackage.json'), 'outside marker');
  await fs.rmdir(dataset);
  await fs.symlink(outside, dataset, 'dir');
  t.mock.method(fs, 'readdir', async () => entries);
  await assert.rejects(readDescriptor(root, 'ds-example'), DescriptorError);
});

test('reports missing descriptors without creating a file', async (t) => {
  const { root, dataset } = await fixture(t);
  await assert.rejects(readDescriptor(root, 'ds-example'), (error: unknown) => {
    assert.ok(error instanceof DescriptorError);
    assert.equal(error.status, 404);
    assert.match(error.message, /no datapackage.json/);
    return true;
  });
  assert.deepEqual(await fs.readdir(dataset), []);
});

test('rejects descriptor symlinks, hard links and directories', async (t) => {
  const { base, root, descriptor } = await fixture(t);
  const target = join(base, 'marker');
  await fs.writeFile(target, 'outside marker');
  await fs.symlink(target, descriptor);
  await assert.rejects(readDescriptor(root, 'ds-example'), DescriptorError);
  await fs.unlink(descriptor);
  await fs.link(target, descriptor);
  await assert.rejects(readDescriptor(root, 'ds-example'), DescriptorError);
  await fs.unlink(descriptor);
  await fs.mkdir(descriptor);
  await assert.rejects(readDescriptor(root, 'ds-example'), DescriptorError);
  assert.equal(await fs.readFile(target, 'utf8'), 'outside marker');
});

test('rejects a different file swapped in between inspection and opening', async (t) => {
  const { root, descriptor } = await fixture(t);
  const previous = `${descriptor}.previous`;
  await fs.writeFile(descriptor, 'original');
  const open = fs.open.bind(fs);
  t.mock.method(fs, 'open', async (path: Parameters<typeof fs.open>[0], flags: Parameters<typeof fs.open>[1]) => {
    await fs.rename(descriptor, previous);
    await fs.writeFile(descriptor, 'replacement');
    return open(path, flags);
  });
  await assert.rejects(readDescriptor(root, 'ds-example'), (error: unknown) => {
    assert.ok(error instanceof DescriptorError);
    assert.match(error.message, /changed while opening/);
    return true;
  });
  assert.equal(await fs.readFile(previous, 'utf8'), 'original');
  assert.equal(await fs.readFile(descriptor, 'utf8'), 'replacement');
});

test('rejects invalid UTF-8 rather than replacing bytes', async (t) => {
  const { root, descriptor } = await fixture(t);
  const bytes = Buffer.from([0xff]);
  await fs.writeFile(descriptor, bytes);
  await assert.rejects(readDescriptor(root, 'ds-example'), DescriptorError);
  assert.deepEqual(await fs.readFile(descriptor), bytes);
});

test('accepts the size boundary and rejects oversized files without truncation', async (t) => {
  const { root, descriptor } = await fixture(t);
  await fs.writeFile(descriptor, Buffer.alloc(MAX_DESCRIPTOR_BYTES, 32));
  assert.equal((await readDescriptor(root, 'ds-example')).length, MAX_DESCRIPTOR_BYTES);
  await fs.appendFile(descriptor, 'x');
  await assert.rejects(readDescriptor(root, 'ds-example'), (error: unknown) => {
    assert.ok(error instanceof DescriptorError);
    assert.equal(error.status, 413);
    return true;
  });
  assert.equal((await fs.stat(descriptor)).size, MAX_DESCRIPTOR_BYTES + 1);
});

test('bounds the actual read when a file grows after its size was checked', async (t) => {
  const { root, descriptor } = await fixture(t);
  await fs.writeFile(descriptor, '');
  const file = await fs.open(descriptor, 'r');
  t.after(() => file.close());
  const before = await file.stat({ bigint: true });
  t.mock.method(fs, 'open', async () => file);
  t.mock.method(file, 'stat', async () => {
    await fs.appendFile(descriptor, Buffer.alloc(MAX_DESCRIPTOR_BYTES + 1, 32));
    return before;
  });
  await assert.rejects(readDescriptor(root, 'ds-example'), (error: unknown) => {
    assert.ok(error instanceof DescriptorError);
    assert.equal(error.status, 413);
    return true;
  });
});

test('preserves read failures as causes without exposing paths or file contents', async (t) => {
  const { root, descriptor } = await fixture(t);
  await fs.writeFile(descriptor, 'private fixture');
  const denied = Object.assign(new Error(`Cannot open ${descriptor}`), { code: 'EACCES' });
  t.mock.method(fs, 'open', async () => { throw denied; });
  await assert.rejects(readDescriptor(root, 'ds-example'), (error: unknown) => {
    assert.ok(error instanceof DescriptorError);
    assert.equal(error.cause, denied);
    assert.equal(error.message.includes(descriptor), false);
    assert.doesNotMatch(error.message, /private fixture/);
    return true;
  });
});
