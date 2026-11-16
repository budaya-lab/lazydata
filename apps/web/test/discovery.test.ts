import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverDatasets, DiscoveryError } from '../src/lib/server/discovery.ts';

test('lists only sorted immediate real ds-* directories without reading descriptors', async (t) => {
  const fixture = await fs.mkdtemp(join(tmpdir(), 'steward-discovery-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const root = join(fixture, 'datasets');
  const outside = join(fixture, 'outside');
  for (const path of ['ds-zeta/nested/ds-hidden', 'ds-alpha', 'other/ds-hidden', '.ds-hidden']) {
    await fs.mkdir(join(root, path), { recursive: true });
  }
  await fs.mkdir(outside);
  await fs.writeFile(join(root, 'ds-file'), 'not a directory');
  await fs.writeFile(join(root, 'ds-zeta/datapackage.json'), '{invalid JSON');
  await fs.writeFile(join(outside, 'marker'), 'outside fixture');
  await fs.symlink(outside, join(root, 'ds-outside'), 'dir');
  await fs.symlink(join(root, 'ds-alpha'), join(root, 'ds-inside'), 'dir');
  await fs.symlink(join(fixture, 'missing'), join(root, 'ds-broken'), 'dir');

  assert.deepEqual(await discoverDatasets(root), ['ds-alpha', 'ds-zeta']);
  assert.deepEqual(await discoverDatasets(root), ['ds-alpha', 'ds-zeta']);
  assert.equal(await fs.readFile(join(root, 'ds-zeta/datapackage.json'), 'utf8'), '{invalid JSON');
  assert.equal(await fs.readFile(join(outside, 'marker'), 'utf8'), 'outside fixture');
  assert.equal(await fs.readlink(join(root, 'ds-outside')), outside);
  assert.deepEqual(await fs.readdir(join(root, 'ds-alpha')), []);
});

test('returns an empty list for an empty configured parent', async (t) => {
  const root = await fs.mkdtemp(join(tmpdir(), 'steward-empty-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  assert.deepEqual(await discoverDatasets(root), []);
});

test('requires explicit nonblank configuration instead of falling back to cwd', async () => {
  for (const root of [undefined, '', '  ']) {
    await assert.rejects(discoverDatasets(root), { message: 'Set DATASET_ROOT to a parent directory.' });
  }
});

test('rejects nonexistent roots and files instead of reporting an empty list', async (t) => {
  const fixture = await fs.mkdtemp(join(tmpdir(), 'steward-invalid-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const file = join(fixture, 'file');
  await fs.writeFile(file, 'not a directory');
  for (const root of [join(fixture, 'missing'), file]) {
    await assert.rejects(discoverDatasets(root), (error: unknown) => {
      assert.ok(error instanceof DiscoveryError);
      assert.match(error.message, /Could not read DATASET_ROOT/);
      assert.equal(error.message.includes(fixture), false);
      assert.ok(error.cause instanceof Error);
      return true;
    });
  }
});

test('propagates directory read failures with a cause, even under elevated permissions', async (t) => {
  const denied = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
  t.mock.method(fs, 'readdir', async () => { throw denied; });
  await assert.rejects(discoverDatasets('/synthetic-parent'), (error: unknown) => {
    assert.ok(error instanceof DiscoveryError);
    assert.equal(error.cause, denied);
    return true;
  });
});
