import assert from 'node:assert/strict';
import { test } from 'node:test';
import policy from '@lazydata/validator/policy' with { type: 'json' };
import { resourceDefaults, changeResourcePath, resourceFormModel, resourceDraftIssues } from '../src/lib/resource-fields.ts';

const options = [{ path: 'items.csv', kind: 'file' as const }, { path: 'images.v2', kind: 'directory' as const }];

test('derives basename and final extension, leaving directory format empty', () => {
  assert.deepEqual(resourceDefaults('folder/observations.CSV'), { name: 'observations', format: 'csv' });
  assert.deepEqual(resourceDefaults('archive.tar.gz'), { name: 'archive.tar', format: 'gz' });
  assert.deepEqual(resourceDefaults('images.v2/', 'directory'), { name: 'images.v2', format: '' });
  assert.deepEqual(resourceDefaults('README'), { name: 'README', format: '' });
  assert.deepEqual(resourceDefaults(''), { name: '', format: '' });
});

test('path changes update defaults but preserve manual name/title/format edits', () => {
  const fields = { name: 'items', path: 'items.csv', title: 'Supplied title', format: 'csv' };
  assert.deepEqual(changeResourcePath(fields, 'new.json', options), { ...fields, name: 'new', path: 'new.json', format: 'json' });
  assert.deepEqual(changeResourcePath({ ...fields, name: 'custom', format: 'custom' }, 'new.json', options),
    { ...fields, name: 'custom', path: 'new.json', format: 'custom' });
  assert.deepEqual(changeResourcePath(fields, 'images.v2/', options), { ...fields, name: 'images.v2', path: 'images.v2/', format: '' });
});

test('prefills supplied resource strings, derives absent defaults and does not invent titles or counts', () => {
  const model = resourceFormModel(JSON.stringify({ resources: [
    { path: 'items.csv', title: ' Items ' },
    { name: 'custom', path: 'images.v2', title: 'Images', format: 'invalid-for-directory', count: 999 },
    { name: '', path: ['one.csv', 'two.csv'], title: 4, format: {} },
    null,
  ] }), options);
  assert.deepEqual(model.required, policy.resource.requiredFields);
  assert.deepEqual(model.rows[0], { name: 'items', path: 'items.csv', title: ' Items ', format: 'csv' });
  assert.deepEqual(model.rows[1], { name: 'custom', path: 'images.v2', title: 'Images', format: '' });
  assert.deepEqual(model.rows[2], { name: '', path: null, title: null, format: null });
  assert.deepEqual(model.rows[3], { name: null, path: null, title: null, format: null });
  assert.equal(JSON.stringify(model).includes('999'), false);
  assert.ok(model.message.includes('unsupported'));
  assert.deepEqual(resourceFormModel('{}', options).rows, []);
  assert.deepEqual(resourceFormModel('{broken', options).rows, []);
  assert.ok(resourceFormModel('{"resources":{}}', options).message);
});

test('draft resource checks reuse shared policy, including required titles and duplicate names', () => {
  const valid = { name: 'items', path: 'items.csv', title: 'Items', format: 'csv' };
  assert.deepEqual(resourceDraftIssues([valid]), []);
  assert.ok(resourceDraftIssues([{ ...valid, title: '' }]).includes('resource title is required'));
  assert.ok(resourceDraftIssues([{ ...valid, name: 'Upper Case' }]).includes('each resource needs a valid lowercase name'));
  assert.ok(resourceDraftIssues([valid, valid]).includes('resource names must be unique: items'));
  assert.ok(resourceDraftIssues([{ ...valid, path: '../outside.csv' }]).some((issue) => issue.includes('safe')));
  assert.ok(resourceDraftIssues([]).includes('resources must contain at least one resource'));
});
