import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datasetView, DatasetFilterError, type DatasetStatus } from '../src/lib/server/dataset-list.ts';

const rows: DatasetStatus[] = [
  { name: 'ds-a', status: 'passed', issueCount: 0, summary: [
    { label: 'Title', values: ['Supplied title <&>'] },
    { label: 'Task', values: ['classification', 'transcription'] },
    { label: 'Project', values: ['example'] },
    { label: 'Stage', values: ['curated'] },
    { label: 'Creators', values: ['Alice', 'Bob'] },
  ] },
  { name: 'ds-b', status: 'issues', issueCount: 3, summary: null },
  { name: 'ds-c', status: 'unavailable', message: 'This dataset has no datapackage.json.', summary: null },
];

test('counts all metadata statuses independently of search and status filters', () => {
  const before = JSON.stringify(rows);
  const view = datasetView(rows, '  supplied  ', 'passed');
  assert.deepEqual(view.counts, { total: 3, passed: 1, issues: 1, unavailable: 1 });
  assert.deepEqual(view.datasets, [rows[0]]);
  assert.equal(view.query, 'supplied');
  assert.equal(view.status, 'passed');
  assert.equal(JSON.stringify(rows), before);
});

test('searches folder names and every supplied summary field as literal case-insensitive text', () => {
  for (const query of ['DS-A', 'title <&>', 'classification', 'transcription', 'example', 'CURATED', 'alice', 'BOB', '']) {
    assert.ok(datasetView(rows, query, 'all').datasets.includes(rows[0]), query);
  }
  assert.deepEqual(datasetView(rows, '[.*]', 'all').datasets, []);
  assert.deepEqual(datasetView(rows, 'missing keyword', 'all').datasets, []);
  assert.deepEqual(datasetView(rows, 'ds-b', 'issues').datasets, [rows[1]]);
  assert.deepEqual(datasetView(rows, 'ds-b', 'passed').datasets, []);
  assert.deepEqual(datasetView(rows, '', 'unavailable').datasets, [rows[2]]);
});

test('does not search internal error messages or fabricate metadata for unavailable rows', () => {
  assert.deepEqual(datasetView(rows, 'datapackage.json', 'all').datasets, []);
  assert.deepEqual(datasetView(rows, 'ds-c', 'all').datasets, [rows[2]]);
  assert.deepEqual(datasetView([], '', 'all').counts, { total: 0, passed: 0, issues: 0, unavailable: 0 });
});

test('rejects unsupported status and oversized search values instead of silently ignoring them', () => {
  for (const status of ['', 'valid', 'PASSED', '../outside', '<script>']) {
    assert.throws(() => datasetView(rows, '', status), DatasetFilterError);
  }
  assert.throws(() => datasetView(rows, 'a'.repeat(201), 'all'), DatasetFilterError);
  assert.doesNotThrow(() => datasetView(rows, 'a'.repeat(200), 'all'));
});
