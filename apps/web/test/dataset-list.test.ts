import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { listDatasets } from '../src/lib/server/dataset-list.ts';
import { DiscoveryError } from '../src/lib/server/discovery.ts';

const valid = JSON.stringify({
  name: 'example', title: 'Example', description: 'Supplied description',
  keywords: ['task:example', 'project:example', 'stage:master'],
  resources: [{ name: 'input', title: 'Input', path: 'missing.csv' }],
});

async function fixture(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(join(tmpdir(), 'steward-list-status-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return fs.realpath(root);
}

async function dataset(root: string, name: string, text?: string): Promise<string> {
  const directory = join(root, name);
  await fs.mkdir(directory);
  const path = join(directory, 'datapackage.json');
  if (text !== undefined) await fs.writeFile(path, text);
  return path;
}

test('lists sorted passed, issue and unavailable statuses without hiding incomplete datasets', async (t) => {
  const root = await fixture(t);
  await dataset(root, 'ds-valid', valid);
  await dataset(root, 'ds-invalid', '{invalid JSON');
  await dataset(root, 'ds-missing');
  const unsafe = await dataset(root, 'ds-unsafe');
  const marker = join(root, 'outside-marker');
  await fs.writeFile(marker, 'outside marker');
  await fs.symlink(marker, unsafe);
  const rows = await listDatasets(root);
  assert.deepEqual(rows.map(({ name, status }) => [name, status]), [
    ['ds-invalid', 'issues'], ['ds-missing', 'unavailable'],
    ['ds-unsafe', 'unavailable'], ['ds-valid', 'passed'],
  ]);
  assert.deepEqual(rows[0], { name: 'ds-invalid', status: 'issues', issueCount: 1, summary: null });
  assert.deepEqual(rows[3], { name: 'ds-valid', status: 'passed', issueCount: 0, summary: [
    { label: 'Title', values: ['Example'] }, { label: 'Creators', values: [] },
    { label: 'Task', values: ['example'] }, { label: 'Project', values: ['example'] },
    { label: 'Stage', values: ['master'] },
  ] });
  assert.equal(JSON.stringify(rows).includes(root), false);
  assert.equal(JSON.stringify(rows).includes('outside marker'), false);
  assert.equal(await fs.readFile(marker, 'utf8'), 'outside marker');
});

test('returns only supplied table metadata, preserving conflicts and excluding raw/unneeded fields', async (t) => {
  const root = await fixture(t);
  await dataset(root, 'ds-modern', JSON.stringify({ ...JSON.parse(valid),
    title: '<script>literal title</script>', description: 'unneeded description marker',
    contributors: [{ title: 'Alice', roles: ['creator'] }, { title: 'Reviewer', roles: ['reviewer'] }],
    keywords: ['task:one', 'task:two', 'project:', 'stage:unknown'],
    resources: [{ name: 'input', path: 'private-resource-marker.csv' }],
  }));
  const [row] = await listDatasets(root);
  assert.deepEqual(row.summary, [
    { label: 'Title', values: ['<script>literal title</script>'] },
    { label: 'Creators', values: ['Alice'] },
    { label: 'Task', values: ['one', 'two'] },
    { label: 'Project', values: ['""'] },
    { label: 'Stage', values: ['unknown'] },
  ]);
  assert.doesNotMatch(JSON.stringify(row), /Reviewer|unneeded description marker|private-resource-marker/);
  await dataset(root, 'ds-legacy', JSON.stringify({ creator: 'Legacy name', task: 'Legacy task' }));
  const legacy = (await listDatasets(root)).find(({ name }) => name === 'ds-legacy');
  assert.ok(legacy?.summary);
  assert.ok(legacy.summary.every(({ values }) => values.length === 0));
});

test('reports permission failures per row while checking the other datasets', async (t) => {
  const root = await fixture(t);
  const denied = await dataset(root, 'ds-denied', valid);
  await dataset(root, 'ds-valid', valid);
  const open = fs.open.bind(fs);
  t.mock.method(fs, 'open', async (path: Parameters<typeof fs.open>[0], flags: Parameters<typeof fs.open>[1]) => {
    if (path === denied) throw Object.assign(new Error(`Cannot open ${denied}`), { code: 'EACCES' });
    return open(path, flags);
  });
  const rows = await listDatasets(root);
  assert.equal(rows[0].status, 'unavailable');
  assert.equal(rows[1].status, 'passed');
  assert.equal(JSON.stringify(rows).includes(root), false);
});

test('refreshes statuses after a descriptor is fixed', async (t) => {
  const root = await fixture(t);
  const path = await dataset(root, 'ds-example', '{invalid JSON');
  assert.equal((await listDatasets(root))[0].status, 'issues');
  await fs.writeFile(path, valid);
  assert.equal((await listDatasets(root))[0].status, 'passed');
  assert.equal(await fs.readFile(path, 'utf8'), valid);
});

test('preserves root failures and unexpected inspection errors instead of inventing statuses', async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await listDatasets(root), []);
  await assert.rejects(listDatasets(undefined), DiscoveryError);
  await dataset(root, 'ds-example', valid);
  const failure = new RangeError('Unexpected inspection failure');
  t.mock.method(JSON, 'parse', () => { throw failure; });
  await assert.rejects(listDatasets(root), (error: unknown) => error === failure);
});
