import assert from 'node:assert/strict';
import { test } from 'node:test';
import policy from '@lazydata/validator/policy' with { type: 'json' };
import { resourceDefaults, changeResourcePath, resourceFieldEdits, resourceFormModel, resourceDraftIssues } from '../src/lib/resource-fields.ts';
import { MetadataDraft } from '../src/lib/metadata-draft.ts';
import { draftIssues } from '../src/lib/draft-checks.ts';
import { createResourceCounter } from '../src/lib/resource-counter.ts';

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

test('prefills supplied strings without hiding missing metadata behind display-only defaults', () => {
  const model = resourceFormModel(JSON.stringify({ resources: [
    { path: 'items.csv', title: ' Items ' },
    { name: 'custom', path: 'images.v2', title: 'Images', format: 'invalid-for-directory', count: 999 },
    { name: '', path: ['one.csv', 'two.csv'], title: 4, format: {} },
    null,
  ] }), options);
  assert.deepEqual(model.required, policy.resource.requiredFields);
  assert.deepEqual(model.rows[0], { name: '', path: 'items.csv', title: ' Items ', format: '' });
  assert.deepEqual(model.rows[1], { name: 'custom', path: 'images.v2', title: 'Images', format: '' });
  assert.deepEqual(model.rows[2], { name: '', path: null, title: null, format: null });
  assert.deepEqual(model.rows[3], { name: null, path: null, title: null, format: null });
  assert.equal(JSON.stringify(model).includes('999'), false);
  assert.ok(model.message.includes('unsupported'));
  assert.deepEqual(resourceFormModel('{}', options).rows, []);
  assert.deepEqual(resourceFormModel('{broken', options).rows, []);
  assert.ok(resourceFormModel('{"resources":{}}', options).message);
});

test('selecting an uncountable JSON path synchronizes its generated name and format before counting', async () => {
  const draft = new MetadataDraft(JSON.stringify({ name: 'example', title: 'Example', description: 'Description',
    keywords: ['task:example', 'project:example', 'stage:master'], resources: [] }));
  const blank = { name: '', title: '', path: '', format: '' };
  const fields = changeResourcePath(blank, 'settings.json', []);
  let edits = resourceFieldEdits({ name: null, title: null, path: null, format: null }, fields, 'path');
  edits = resourceFieldEdits(edits, { ...fields, title: 'Settings' }, 'title');
  draft.update({ resources: [{ id: 200, fields: edits }] });
  const beforeCount = draft.text();
  assert.deepEqual(JSON.parse(beforeCount).resources, [{ name: 'settings', path: 'settings.json', format: 'json', title: 'Settings' }]);
  assert.deepEqual(draftIssues(beforeCount), []);
  const counter = createResourceCounter('/count', async () => new Response(JSON.stringify({ status: 'unsupported', message: 'JSON is not an array.' })));
  assert.equal((await counter('settings.json'))?.status, 'unsupported');
  assert.equal(draft.text(), beforeCount);
  assert.equal(Object.hasOwn(JSON.parse(draft.text()).resources[0], 'count'), false);
});

test('path edits retain manual name/format overrides; unrelated edits do not accept defaults', () => {
  const untouched = { name: null, title: null, path: null, format: null };
  const current = { name: 'custom', title: 'Title', path: 'old.csv', format: 'custom' };
  const changed = changeResourcePath(current, 'settings.json', []);
  assert.deepEqual(resourceFieldEdits(untouched, changed, 'path'),
    { name: 'custom', title: null, path: 'settings.json', format: 'custom' });
  assert.deepEqual(resourceFieldEdits(untouched, changed, 'title'), { ...untouched, title: 'Title' });
  const folder = changeResourcePath(current, 'images.v2/', options);
  assert.deepEqual(resourceFieldEdits(untouched, folder, 'path'),
    { name: 'custom', title: null, path: 'images.v2/', format: '' });
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
