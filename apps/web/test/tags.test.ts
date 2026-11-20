import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addTags, hasTags } from '../src/lib/tags.ts';

test('adds comma-separated tags while preserving spaces inside project names', () => {
  assert.deepEqual(addTags([], '  South East Asia , Image Classification  '),
    ['South East Asia', 'Image Classification']);
});

test('ignores blank and newly duplicated tags without rewriting supplied tags', () => {
  const supplied = Object.freeze(['existing', 'existing', '  supplied project  ']);
  assert.deepEqual(addTags(supplied, ' ,existing,New Project,New Project, '),
    ['existing', 'existing', '  supplied project  ', 'New Project']);
  assert.deepEqual(supplied, ['existing', 'existing', '  supplied project  ']);
  assert.deepEqual(addTags([], ' , \n, '), []);
});

test('requires at least one nonblank tag without coercion or case folding', () => {
  assert.equal(hasTags([]), false);
  assert.equal(hasTags(['', ' \t']), false);
  assert.equal(hasTags(['', 'Valid tag']), true);
  assert.deepEqual(addTags(['Project'], 'project'), ['Project', 'project']);
});
