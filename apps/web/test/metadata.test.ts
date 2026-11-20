import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateMetadata } from '@penjaga/validator';
import policy from '@penjaga/validator/policy' with { type: 'json' };
import { inspectMetadata } from '../src/lib/server/metadata.ts';

const descriptor = {
  name: 'example', title: 'Example title', description: 'Supplied description',
  keywords: ['task:classification', 'project:example', 'stage:curated'],
  resources: [{ name: 'input', title: 'Input', path: 'missing.csv' }],
};

function field(report: ReturnType<typeof inspectMetadata>, label: string): string[] {
  const entry = report.fields.find((entry) => entry.label === label);
  assert.ok(entry, `Missing summary field: ${label}`);
  return entry.values;
}

test('uses real shared metadata checks and displays supplied fields', () => {
  const supplied = { ...descriptor, version: '0.3.0', created: '2026-01-02T03:04:05Z', licenses: [{ name: 'CC0-1.0' }] };
  const report = inspectMetadata(JSON.stringify(supplied));
  assert.deepEqual(report.issues, validateMetadata(supplied, policy));
  assert.deepEqual(report.issues, []);
  for (const [label, value] of [['Name', supplied.name], ['Title', supplied.title], ['Description', supplied.description],
    ['Version', supplied.version], ['Created', supplied.created], ['Task', 'classification'], ['Project', 'example'], ['Stage', 'curated']]) {
    assert.deepEqual(field(report, label), [value]);
  }
  assert.deepEqual(field(report, 'Licences'), ['[{"name":"CC0-1.0"}]']);
});

test('loads supplied overview strings without coercion or fabricated version/date defaults', () => {
  const supplied = { name: 'package-name', title: '  Exact title  ', description: 'Line one\nLine two',
    version: '1.2.3-rc.1+build.5', created: '2026-01-02T03:04:05.123+08:00' };
  assert.deepEqual(inspectMetadata(JSON.stringify(supplied)).overview, supplied);
  assert.deepEqual(inspectMetadata('{"name":42,"title":null,"description":{"text":"not a string"}}').overview,
    { name: '', title: '', description: '', version: '', created: '' });
  assert.deepEqual(inspectMetadata('{"version":42,"created":null}').overview,
    { name: '', title: '', description: '', version: null, created: null });
  for (const text of ['{}', 'null', '[]', '{broken']) {
    assert.deepEqual(inspectMetadata(text).overview, { name: '', title: '', description: '', version: '', created: '' });
  }
});

test('prefills keyword fields from exact prefixes, preserving project spaces and supplied tag text', () => {
  const supplied = { ...descriptor, keywords: ['task:classification', 'task:classification',
    'project:  South East Asia  ', 'stage:ground-truth', 'language:Malay', 'TASK:keep as extra', 'plain tag', null] };
  const report = inspectMetadata(JSON.stringify(supplied));
  assert.deepEqual(report.keywordFields, { tasks: ['classification', 'classification'],
    projects: ['  South East Asia  '], stage: 'ground-truth',
    extraKeywords: ['language:Malay', 'TASK:keep as extra', 'plain tag'] });
  assert.deepEqual(report.issues, validateMetadata(supplied, policy));
});

test('leaves missing, malformed and ambiguous keyword fields unselected without inferring values', () => {
  const empty = { tasks: [], projects: [], stage: '', extraKeywords: [] };
  for (const text of ['{}', 'null', '[]', '{broken', '{"keywords":{}}', '{"keywords":[null,42]}']) {
    assert.deepEqual(inspectMetadata(text).keywordFields, empty);
  }
  for (const keywords of [['stage:unknown'], ['stage:master', 'stage:curated'], ['stage:curated', 'stage:curated'], ['stage: master']]) {
    assert.equal(inspectMetadata(JSON.stringify({ keywords })).keywordFields.stage, '');
  }
  assert.deepEqual(inspectMetadata('{"keywords":["task:","project: ","stage:"]}').keywordFields,
    { tasks: [''], projects: [' '], stage: '', extraKeywords: [] });
});

test('shows only explicitly declared creators, without promoting other contributors', () => {
  const report = inspectMetadata(JSON.stringify({ ...descriptor, contributors: [
    { title: 'Alice', roles: ['creator', 'curator'] },
    { title: 'Bob', roles: ['reviewer'] },
    { title: 'Carol' },
    { title: 'Legacy name', role: 'creator' },
  ] }));
  assert.deepEqual(field(report, 'Creators'), ['Alice']);
  assert.equal(field(report, 'Contributors').length, 4);
  assert.match(field(report, 'Contributors').join('; '), /Bob.*reviewer/);
});

test('missing metadata stays missing instead of using legacy fields or folder-like names', () => {
  const supplied = { name: 'ds-task-project-master', creator: 'Legacy person', task: 'Legacy task', stage: 'master' };
  const report = inspectMetadata(JSON.stringify(supplied));
  for (const label of ['Creators', 'Task', 'Project', 'Stage', 'Created']) {
    assert.deepEqual(field(report, label), []);
  }
  assert.deepEqual(report.issues, validateMetadata(supplied, policy));
  assert.ok(report.issues.length > 0);
});

test('preserves duplicate, blank and unknown keyword values for display, leaving validity to shared checks', () => {
  const supplied = { ...descriptor, keywords: ['task:one', 'task:two', 'project:', 'stage:unknown', 'stage:master', 'TASK:ignored'] };
  const report = inspectMetadata(JSON.stringify(supplied));
  assert.deepEqual(field(report, 'Task'), ['one', 'two']);
  assert.deepEqual(field(report, 'Project'), ['""']);
  assert.deepEqual(field(report, 'Stage'), ['unknown', 'master']);
  assert.deepEqual(report.issues, validateMetadata(supplied, policy));
});

test('does not coerce malformed supplied values or confuse them with missing values', () => {
  const supplied = { ...descriptor, title: { toString: null }, contributors: [null, 42, { roles: ['creator'], organization: 'Supplied group' }], created: null };
  const report = inspectMetadata(JSON.stringify(supplied));
  assert.deepEqual(field(report, 'Title'), ['{"toString":null}']);
  assert.deepEqual(field(report, 'Created'), ['null']);
  assert.deepEqual(field(report, 'Creators'), ['{"roles":["creator"],"organization":"Supplied group"}']);
  assert.doesNotMatch(JSON.stringify(report), /\[object Object\]/);
  assert.deepEqual(report.issues, validateMetadata(supplied, policy));
});

test('passes duplicate issues through and tolerates malformed keyword/role shapes for display', () => {
  const supplied = { ...descriptor, keywords: [null, { stage: 'master' }],
    contributors: [{ title: 'No declared role', roles: { creator: true } }],
    resources: [{ name: 'one', path: 'one.csv' }, { name: 'two', path: 'two.csv' }],
  };
  const expected = validateMetadata(supplied, policy);
  const report = inspectMetadata(JSON.stringify(supplied));
  assert.ok(new Set(expected).size < expected.length);
  assert.deepEqual(report.issues, expected);
  assert.deepEqual(field(report, 'Creators'), []);
  assert.deepEqual(field(report, 'Stage'), []);
});

test('malformed JSON reports a generic parse issue without echoing parser details', () => {
  const report = inspectMetadata('{"private fragment":');
  assert.deepEqual(report.fields, []);
  assert.deepEqual(report.issues, ['datapackage.json is not valid JSON.']);
});

test('non-object JSON receives the real shared issue without fabricating a summary', () => {
  for (const value of [null, [], 42, 'text', false]) {
    const report = inspectMetadata(JSON.stringify(value));
    assert.deepEqual(report.fields, []);
    assert.deepEqual(report.issues, validateMetadata(value, policy));
  }
});

test('surfaces summary serialization limits without hiding the descriptor or changing shared issues', (t) => {
  const text = JSON.stringify(descriptor);
  t.mock.method(JSON, 'stringify', () => { throw new RangeError('Maximum call stack size exceeded'); });
  const report = inspectMetadata(text);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(field(report, 'Keywords'), ['Could not summarize this value; see raw descriptor.']);
});

test('does not mistake unexpected failures for malformed JSON', (t) => {
  const failure = new RangeError('unexpected parser failure');
  t.mock.method(JSON, 'parse', () => { throw failure; });
  assert.throws(() => inspectMetadata('{}'), (error: unknown) => error === failure);
});
