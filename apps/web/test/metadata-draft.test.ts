import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MetadataDraft, MetadataDraftError } from '../src/lib/metadata-draft.ts';

const read = (draft: MetadataDraft) => JSON.parse(draft.text());

test('a working object normalizes JSON while preserving unexposed properties', () => {
  const draft = new MetadataDraft('{ "title":"Ol\\u0064", "extra":{"n":1.2300e-9}, "unknown":[false,null] }');
  assert.equal(draft.dirty, false);
  draft.update({ overview: { title: 'New' } });
  assert.deepEqual(read(draft), { title: 'New', extra: { n: 1.23e-9 }, unknown: [false, null] });
  assert.equal(draft.text(), JSON.stringify(read(draft), null, 2) + '\n');
  assert.equal(draft.dirty, true);
  draft.update({ overview: { title: 'Old' } });
  assert.equal(draft.dirty, false);
});

test('acknowledging a save advances only the saved baseline, not newer edits or row identities', () => {
  const draft = new MetadataDraft('{"title":"Original","sources":[{"title":"A","extra":true}]}');
  draft.update({ overview: { title: 'Saved' }, sources: [{ id: 0, fields: { title: 'B', path: '' } }] });
  const submitted = draft.text();
  draft.update({ overview: { title: 'Newer' } });
  draft.markSaved(submitted);
  assert.equal(read(draft).title, 'Newer');
  assert.equal(draft.dirty, true);
  draft.update({ overview: { title: 'Saved' }, sources: [{ id: 0, fields: { title: 'B', path: '' } }] });
  assert.equal(draft.dirty, false);
  assert.equal(read(draft).sources[0].extra, true);
  draft.update({ overview: { title: 'Again' } });
  draft.markSaved(draft.text());
  assert.equal(draft.dirty, false);
});

test('successive edits update the same draft, not a replay of old form changes', () => {
  const draft = new MetadataDraft('{"resources":[{"path":"old.csv","count":12,"extra":true}],"sources":[{"title":"Old","extra":true}],"contributors":[{"title":"Old","extra":true}],"keywords":["task:old","stage:raw",123]}');
  draft.update({ overview: { name: 'example', title: 'Dataset' } });
  draft.update({ keywords: { tasks: ['new'] } });
  draft.update({ keywords: { projects: ['a project'] } });
  draft.update({ resources: [{ id: 0, fields: { name: null, title: 'File', path: 'new.csv', format: null } }] });
  draft.update({ sources: [{ id: 0, fields: { title: 'Source', path: 'https://example.invalid' } }] });
  draft.update({ contributors: [{ id: 0, fields: { title: 'Person', roles: ['creator'] } }] });
  const data = read(draft);
  assert.equal(data.title, 'Dataset');
  assert.deepEqual(data.keywords, ['task:new', 'stage:raw', 123, 'project:a project']);
  assert.deepEqual(data.resources, [{ path: 'new.csv', count: 12, extra: true, title: 'File' }]);
  assert.deepEqual(data.sources, [{ title: 'Source', extra: true, path: 'https://example.invalid' }]);
  assert.deepEqual(data.contributors, [{ title: 'Person', extra: true, roles: ['creator'] }]);
});

test('row identities retain surviving metadata across repeated removals and additions', () => {
  const draft = new MetadataDraft('{"sources":[{"title":"A","extra":"a"},{"title":"B","extra":"b"}]}');
  draft.update({ sources: [{ id: 1, fields: { title: 'Changed', path: '' } }] });
  draft.update({ sources: [{ id: 1, fields: { title: 'Again', path: '' } }, { id: 200, fields: { title: 'New', path: '' } }] });
  assert.deepEqual(read(draft).sources, [{ title: 'Again', extra: 'b' }, { title: 'New' }]);
  draft.update({ sources: [{ id: 200, fields: { title: 'Final', path: 'local.csv' } }] });
  assert.deepEqual(read(draft).sources, [{ title: 'Final', path: 'local.csv' }]);
});

test('duplicate license names keep the correct surviving entry and path-only neighbors', () => {
  const draft = new MetadataDraft('{"licenses":[{"name":"MIT","owner":"A"},{"path":"LICENSE"},{"name":"MIT","owner":"B"}]}');
  draft.update({ licenses: ['MIT'], licenseIds: [1] });
  assert.deepEqual(read(draft).licenses, [{ path: 'LICENSE' }, { name: 'MIT', owner: 'B' }]);
  draft.update({ licenses: ['MIT', 'Custom'], licenseIds: [1, 200] });
  draft.update({ licenses: ['Custom'], licenseIds: [200] });
  assert.deepEqual(read(draft).licenses, [{ path: 'LICENSE' }, { name: 'Custom' }]);
});

test('partial dates do not replace the stored timestamp; blanks and arrays remain explicit edits', () => {
  const draft = new MetadataDraft('{"created":"2026-01-02T03:04:05.123+08:00","version":"1.0.0","contributors":[{"title":"A","roles":["author"]}]}');
  draft.update({ overview: { created: '', createdError: 'Partial date', title: 'New' } });
  assert.equal(read(draft).created, '2026-01-02T03:04:05.123+08:00');
  draft.update({ overview: { created: '', version: '' }, contributors: [{ id: 0, fields: { title: 'A', roles: [] } }] });
  assert.equal(read(draft).created, '');
  assert.equal(read(draft).version, '');
  assert.deepEqual(read(draft).contributors[0].roles, []);
});

test('unsupported metadata stays untouched; failed edits cannot partly mutate the draft', () => {
  const draft = new MetadataDraft('{"resources":null,"licenses":{},"keywords":false,"contributors":[false]}');
  draft.update({ overview: { title: 'New' } });
  draft.update({ resources: [], licenses: [], licenseIds: [] });
  const before = draft.text();
  assert.throws(() => draft.update({ overview: { title: 'Lost' }, keywords: { tasks: ['x'] } }), MetadataDraftError);
  assert.equal(draft.text(), before);
  assert.throws(() => draft.update({ contributors: [{ id: 0, fields: { title: 'Name', roles: [] } }] }), MetadataDraftError);
  assert.equal(draft.text(), before);
});

test('edits exceeding the serialized byte limit are refused without changing the working object', () => {
  const draft = new MetadataDraft('{}');
  assert.throws(() => draft.update({ overview: { description: '字'.repeat(2 * 1024 * 1024) } }), MetadataDraftError);
  assert.deepEqual(read(draft), {});
  assert.equal(draft.dirty, false);
});

test('refuses malformed, ambiguous or over-limit documents before editing', () => {
  for (const text of ['{bad', '[]', 'null', '\uFEFF{}', '{/*comment*/}', '{"x":1,}', '{"a":1,"\\u0061":2}', '{"nested":{"a":1,"a":2}}', '{"x":' + '['.repeat(130) + '0' + ']'.repeat(130) + '}', '{"x":[' + Array(100000).fill('0').join(',') + ']}']) {
    assert.throws(() => new MetadataDraft(text), MetadataDraftError);
  }
});

test('refuses numeric conversions that would silently round, overflow or underflow', () => {
  for (const number of ['9007199254740993', '900719925474099312345', '0.100000000000000001', '1e999', '1e-999', '-0']) {
    assert.throws(() => new MetadataDraft(`{"unknown":${number}}`), MetadataDraftError, number);
  }
  for (const number of ['0', '0.1', '1.2300e-9', '9007199254740991', '1e30', '1.0', '5e-324']) {
    const draft = new MetadataDraft(`{"unknown":${number}}`);
    assert.equal(read(draft).unknown, Number(number));
  }
});

test('JSON keys are data, including __proto__ and constructor', () => {
  const draft = new MetadataDraft('{"__proto__":{"polluted":true},"constructor":{"x":1},"sources":[{"title":"A","__proto__":{"hidden":true}}]}');
  draft.update({ overview: { title: 'Dataset' }, sources: [{ id: 0, fields: { title: 'B', path: '' } }] });
  assert.equal(read(draft).__proto__.polluted, true);
  assert.equal(read(draft).sources[0].__proto__.hidden, true);
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
});
