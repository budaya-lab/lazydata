import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sourceDraftIssues,
  sourceFormModel,
  sourceLocatorIssue,
} from '../src/lib/source-fields.ts';

const valid = { title: 'Reference', path: 'docs/reference.txt' };

test('accepts only fully qualified HTTP(S) URLs or safe relative POSIX paths', () => {
  for (const value of [
    'https://example.org/catalogue',
    'http://example.org/catalogue',
    'docs/reference.txt',
    'folder name/reference (2025).txt',
    '.well-known/source.json',
  ]) assert.equal(sourceLocatorIssue(value), undefined, value);

  for (const value of [
    '',
    '   ',
    'https://',
    'https:/example.org',
    'ftp://example.org/file',
    '/absolute/path',
    '../outside.json',
    'folder/../outside.json',
    'folder\\file.json',
    'folder//file.json',
  ]) assert.ok(sourceLocatorIssue(value), value);
});

test('requires title and one URL-or-path locator on each local source row', () => {
  assert.deepEqual(sourceDraftIssues([valid]), []);
  assert.deepEqual(sourceDraftIssues([]), []);
  assert.ok(sourceDraftIssues([{ ...valid, title: '' }]).includes('source title is required'));
  assert.ok(sourceDraftIssues([{ ...valid, path: '' }]).includes('source path is required'));
  assert.ok(sourceDraftIssues([{ ...valid, path: '../outside.json' }]).includes(
    'source path must be a fully qualified HTTP(S) URL or a safe relative POSIX path',
  ));
});

test('prefills source title/path without coercion or inventing rows', () => {
  const model = sourceFormModel(JSON.stringify({ sources: [
    { title: ' Supplied title ', path: 'https://example.org/source', email: 'ignored@example.org' },
    { title: 'Local file', path: 'references/list.csv', version: '1.2' },
    { title: 7, path: ['one.csv'] },
    null,
  ] }));

  assert.deepEqual(model.rows, [
    { title: ' Supplied title ', path: 'https://example.org/source' },
    { title: 'Local file', path: 'references/list.csv' },
    { title: null, path: null },
    { title: null, path: null },
  ]);
  assert.ok(model.message.includes('unsupported'));
  assert.deepEqual(sourceFormModel('{}').rows, []);
  assert.deepEqual(sourceFormModel('{broken').rows, []);
  assert.ok(sourceFormModel('{"sources":{}}').message);
});
