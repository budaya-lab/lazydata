import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTRIBUTOR_ROLE_PRESETS,
  MAX_CONTRIBUTOR_ROWS,
  contributorFieldIssues,
  contributorFormModel,
} from '../src/lib/contributor-fields.ts';
import { addTags } from '../src/lib/tags.ts';

test('contributor names map from title and roles retain supplied text without inference', () => {
  const model = contributorFormModel(JSON.stringify({ contributors: [
    { title: ' Alice Smith ', roles: ['creator', 'Data curator', 'creator'], email: 'not-shown@example.org' },
    { title: 'Research group' },
    { name: 'Not the Data Package title' },
  ] }));
  assert.deepEqual(model.rows, [
    { title: ' Alice Smith ', roles: ['creator', 'Data curator', 'creator'] },
    { title: 'Research group', roles: [] },
    { title: '', roles: [] },
  ]);
  assert.equal(model.message, '');
  assert.deepEqual(contributorFormModel('{}').rows, []);
  assert.deepEqual(contributorFormModel('{"contributors":[]}').rows, []);
});

test('contributors warn for malformed and over-limit data without coercing values', () => {
  for (const text of ['{broken', '{"contributors":{}}']) {
    const model = contributorFormModel(text);
    assert.ok(model.message);
    assert.deepEqual(model.rows, []);
  }
  const model = contributorFormModel(JSON.stringify({ contributors: [
    false, { title: 42, roles: 'creator' }, { title: 'Alice', roles: ['creator', 3] },
  ] }));
  assert.ok(model.message);
  assert.deepEqual(model.rows, [
    { title: null, roles: null }, { title: null, roles: null }, { title: 'Alice', roles: null },
  ]);
  const oversized = contributorFormModel(JSON.stringify({ contributors: Array.from(
    { length: MAX_CONTRIBUTOR_ROWS + 1 }, () => ({ title: 'Alice' }),
  ) }));
  assert.deepEqual(oversized.rows, []);
  assert.match(oversized.message, /limit/);
});

test('contributor rows require a local name and accept optional or custom roles', () => {
  assert.deepEqual(contributorFieldIssues({ title: 'Alice', roles: [] }), {});
  for (const role of [...CONTRIBUTOR_ROLE_PRESETS, 'Data curator']) {
    assert.deepEqual(contributorFieldIssues({ title: 'Alice', roles: [role] }), {});
  }
  assert.ok(contributorFieldIssues({ title: '  ', roles: [] }).title);
  assert.ok(contributorFieldIssues({ title: null, roles: null }).roles);
  assert.ok(contributorFieldIssues({ title: 'Alice', roles: [' '] }).roles);
  assert.deepEqual(addTags(['creator'], 'creator, Data curator'), ['creator', 'Data curator']);
});
