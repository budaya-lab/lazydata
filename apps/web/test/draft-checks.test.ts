import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftIssues, type DraftChanges } from '../src/lib/draft-checks.ts';
import { MetadataDraft } from '../src/lib/metadata-draft.ts';
import { createDraftChecker, type CheckState } from '../src/lib/draft-checker.ts';

const descriptor = {
  name: 'example', title: 'Example', description: 'Description',
  keywords: ['task:classification', 'project:example', 'stage:curated'],
  resources: [{ name: 'input', title: 'Input', path: 'input.csv' }],
};
const text = JSON.stringify(descriptor);
function edited(changes: DraftChanges, original = text): string[] {
  const draft = new MetadataDraft(original);
  draft.update(changes);
  return draftIssues(draft.text(), changes.overview?.createdError);
}

test('checks inspect the serialized working object and additional form rules', () => {
  assert.deepEqual(draftIssues(text), []);
  assert.ok(edited({ overview: { title: ' ' } }).some((issue) => issue.includes('title')));
  assert.ok(edited({ overview: { name: 'Invalid Name' } }).some((issue) => issue.includes('identifier')));
  assert.ok(edited({ overview: { version: '01.2.3' } }).some((issue) => issue.includes('SemVer')));
  assert.ok(draftIssues(text, 'Invalid selected midnight.').includes('Invalid selected midnight.'));
  assert.ok(edited({ keywords: { tasks: ['one', 'two'] } }).some((issue) => issue.includes('exactly one')));
  assert.ok(edited({ keywords: { stage: '' } }).some((issue) => issue.includes('stage:')));
  assert.deepEqual(edited({ keywords: { projects: ['Project with spaces'] } }), []);
  assert.equal(text, JSON.stringify(descriptor));
});

test('checks cover every edited section without a separate validation overlay', () => {
  assert.deepEqual(edited({
    resources: [{ id: 0, fields: { name: 'input', title: 'Changed', path: 'missing.csv', format: '' } }],
    sources: [{ id: 200, fields: { title: 'Source', path: 'https://example.org' } }],
    contributors: [{ id: 200, fields: { title: 'Alice', roles: ['Data curator'] } }],
    licenses: ['MIT', 'Custom-License'], licenseIds: [200, 201],
  }), []);
  assert.ok(edited({ resources: [] }).some((issue) => issue.includes('resources')));
  assert.ok(edited({ sources: [{ id: 200, fields: { title: '', path: '../bad' } }] }).some((issue) => issue.includes('source')));
  assert.ok(edited({ contributors: [{ id: 200, fields: { title: '', roles: [] } }] }).some((issue) => issue.includes('Name is required')));
  assert.ok(edited({ licenses: ['not an identifier'], licenseIds: [200] }).some((issue) => issue.includes('licenses')));
});

test('checks retain issues in unexposed metadata and do not insert displayed defaults', () => {
  const original = JSON.stringify({ ...descriptor, keywords: [...descriptor.keywords, 42],
    resources: [{ title: 'Input', path: 'input.csv', count: -1 }],
    contributors: [{ title: 'Alice', email: 42 }], licenses: [{ path: 'LICENSE', title: 42 }],
  });
  const issues = edited({ overview: { title: 'Changed' } }, original);
  for (const field of ['keywords', 'name', 'count', 'contributors', 'licenses']) {
    assert.ok(issues.some((issue) => issue.includes(field)), field);
  }
  assert.ok(draftIssues('{broken').includes('datapackage.json is not valid JSON.'));
  assert.ok(draftIssues('[]').some((issue) => issue.includes('JSON object')));
  for (const field of ['resources', 'contributors', 'licenses', 'sources']) {
    assert.ok(draftIssues(JSON.stringify({ ...descriptor, [field]: 42 })).some((issue) => issue.includes(field)));
  }
});

test('shared checks still inspect rows beyond the form display limit', () => {
  const resources = Array.from({ length: 201 }, (_, index) => ({ name: `input-${index}`, title: 'Input', path: 'input.csv' }));
  assert.ok(!draftIssues(JSON.stringify({ ...descriptor, resources })).some((issue) => issue.includes('title')));
  resources[200].title = '';
  const issues = draftIssues(JSON.stringify({ ...descriptor, resources }));
  assert.ok(issues.some((issue) => issue.includes('title')));
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
