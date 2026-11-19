import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftIssues, type DraftChanges } from '../src/lib/draft-checks.ts';
import { createDraftChecker, type CheckState } from '../src/lib/draft-checker.ts';
import { resourceFormModel } from '../src/lib/resource-fields.ts';

const descriptor = {
  name: 'example', title: 'Example', description: 'Description',
  keywords: ['task:classification', 'project:example', 'stage:curated'],
  resources: [{ name: 'input', title: 'Input', path: 'input.csv' }],
};
const text = JSON.stringify(descriptor);

test('draft checks update overview and keywords without changing the saved text', () => {
  assert.deepEqual(draftIssues(text, {}), []);
  assert.ok(draftIssues(text, { overview: { title: ' ' } }).some((issue) => issue.includes('title')));
  assert.ok(draftIssues(text, { overview: { name: 'Invalid Name' } }).some((issue) => issue.includes('identifier')));
  assert.ok(draftIssues(text, { overview: { version: '01.2.3' } }).some((issue) => issue.includes('SemVer')));
  assert.ok(draftIssues(text, { overview: { createdError: 'Invalid selected midnight.' } }).includes('Invalid selected midnight.'));
  assert.ok(draftIssues(text, { keywords: { tasks: ['one', 'two'] } }).some((issue) => issue.includes('exactly one')));
  assert.ok(draftIssues(text, { keywords: { stage: '' } }).some((issue) => issue.includes('stage:')));
  assert.deepEqual(draftIssues(text, { keywords: { projects: ['Project with spaces'] } }), []);
  assert.equal(text, JSON.stringify(descriptor));
});

test('draft checks cover all row sections and optional clearing', () => {
  const edits: DraftChanges = {
    resources: [{ id: 0, fields: { name: 'input', title: 'Changed', path: 'missing.csv', format: '' } }],
    sources: [{ id: 200, fields: { title: 'Source', path: 'https://example.org' } }],
    contributors: [{ id: 200, fields: { title: 'Alice', roles: ['Data curator'] } }],
    licenses: ['MIT', 'Custom-License'],
  };
  assert.deepEqual(draftIssues(text, edits), []);
  assert.ok(draftIssues(text, { resources: [] }).some((issue) => issue.includes('resources')));
  assert.ok(draftIssues(text, { sources: [{ id: 200, fields: { title: '', path: '../bad' } }] }).some((issue) => issue.includes('source')));
  assert.ok(draftIssues(text, { contributors: [{ id: 200, fields: { title: '', roles: [] } }] }).some((issue) => issue.includes('Name is required')));
  assert.ok(draftIssues(text, { licenses: ['not an identifier'] }).some((issue) => issue.includes('licenses')));
  assert.deepEqual(draftIssues(JSON.stringify({ ...descriptor, contributors: [{ title: 'Alice' }], licenses: [{ name: 'MIT' }] }),
    { contributors: [], licenses: [], overview: { version: '', created: '' } }), []);
});

test('draft checks preserve unexposed properties, unsupported values and original row identities', () => {
  const original = JSON.stringify({ ...descriptor,
    keywords: [...descriptor.keywords, 42],
    resources: [
      { name: 'a', title: 'A', path: 'a.csv' },
      { name: 'b', title: 'B', path: 'b.csv', count: -1 },
    ],
    contributors: [{ title: 'Alice', email: 42, roles: ['creator'] }],
    licenses: [{ path: 'LICENSE', title: 42 }, { name: 'MIT', title: 42 }],
  });
  const issues = draftIssues(original, {
    keywords: { tasks: ['new-task'] },
    resources: [{ id: 1, fields: { name: 'b', title: 'Changed', path: 'b.csv', format: '' } }],
    contributors: [{ id: 0, fields: { title: 'Renamed', roles: ['creator'] } }],
    licenses: ['MIT', 'Apache-2.0'],
  });
  assert.ok(issues.some((issue) => issue.includes('keywords')));
  assert.ok(issues.some((issue) => issue.includes('count')));
  assert.ok(issues.some((issue) => issue.includes('contributors')));
  assert.ok(issues.some((issue) => issue.includes('licenses')));
  assert.ok(draftIssues('{broken', { overview: { title: 'New' } }).includes('datapackage.json is not valid JSON.'));
  assert.ok(draftIssues('[]', { overview: { title: 'New' } }).some((issue) => issue.includes('JSON object')));
  for (const field of ['resources', 'contributors', 'licenses', 'sources'] as const) {
    const malformed = JSON.stringify({ ...descriptor, [field]: 42 });
    assert.ok(draftIssues(malformed, { [field]: [] }).some((issue) => issue.includes(field)));
  }
});

test('checks include visible resource defaults and unsupported resource fields', () => {
  const supplied = JSON.stringify({ ...descriptor, version: '', resources: [{ title: 'Input', path: 'input.csv' }] });
  const resources = resourceFormModel(supplied, []).rows.map((fields, id) => ({ id, fields }));
  assert.deepEqual(draftIssues(supplied, { resources, overview: { title: 'Changed' } }), []);
  const arrayPath = JSON.stringify({ ...descriptor, resources: [{ name: 'input', title: 'Input', path: ['input.csv'] }] });
  const unsupported = resourceFormModel(arrayPath, []).rows.map((fields, id) => ({ id, fields }));
  assert.ok(draftIssues(arrayPath, { resources: unsupported }).some((issue) => issue.includes('unsupported supplied value')));
});

test('over-limit saved arrays remain visible as check limitations instead of false success', () => {
  for (const field of ['resources', 'contributors', 'licenses', 'sources'] as const) {
    const entries = Array.from({ length: 201 }, (_, index) => field === 'resources'
      ? { name: `input-${index}`, title: 'Input', path: 'input.csv' }
      : field === 'contributors' ? { title: 'Alice' }
      : field === 'licenses' ? { name: 'MIT' }
      : { title: 'Source', path: 'https://example.org' });
    const issues = draftIssues(JSON.stringify({ ...descriptor, [field]: entries }), { [field]: [] });
    assert.ok(issues.some((issue) => issue.includes('cannot fully check edits')), field);
  }
});

test('debounces for 500 ms, rejects obsolete timers, flushes immediately and disposes safely', () => {
  const timers: { callback: () => void; cancelled: boolean }[] = [];
  const states: CheckState[] = [];
  const checked: string[] = [];
  const checker = createDraftChecker((value: string) => { checked.push(value); return [value]; },
    (state) => states.push(state), (callback, delay) => {
      assert.equal(delay, 500);
      const timer = { callback, cancelled: false }; timers.push(timer);
      return () => { timer.cancelled = true; };
    });
  checker.schedule('old'); checker.schedule('new');
  assert.equal(states.at(-1)?.pending, true);
  assert.deepEqual(checked, []);
  assert.equal(timers[0].cancelled, true);
  timers[0].callback(); assert.deepEqual(checked, []);
  timers[1].callback(); assert.deepEqual(checked, ['new']);
  assert.deepEqual(states.at(-1), { pending: false, issues: ['new'] });
  checker.schedule('queued');
  assert.deepEqual(checker.flush('now'), ['now']);
  timers[2].callback(); assert.deepEqual(checked, ['new', 'now']);
  checker.schedule('unmounted'); checker.dispose(); timers[3].callback();
  assert.deepEqual(checked, ['new', 'now']);
});
