import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countResourceText } from '../src/lib/server/resource-count.ts';

test('counts CSV/TSV records, not physical lines, excluding headers and blank lines', () => {
  assert.equal(countResourceText('\uFEFFname,value\r\na,1\r\n"b\nwith ""quotes""",2\r\n\r\n', 'csv'), 2);
  assert.equal(countResourceText('a\tb\r\n1\t"two\nlines"\n', 'tsv'), 1);
  assert.equal(countResourceText('a,b'), 0);
  assert.equal(countResourceText('', 'csv'), 0);
  assert.equal(countResourceText('a,b\n,\n"",\n', 'csv'), 2);
});

test('rejects malformed quoting and inconsistent column counts rather than returning partial totals', () => {
  for (const text of ['a,b\n"unfinished,1', 'a,b\nx"y,1', 'a,b\n"x"oops,1', 'a,b\n1,2,3']) {
    assert.throws(() => countResourceText(text, 'csv'), /Invalid delimited data/);
  }
});

test('counts top-level JSON array items and valid nonblank JSONL records', () => {
  assert.equal(countResourceText('[{"a":1},null,[1,2]]', 'json'), 3);
  assert.equal(countResourceText('[]', 'json'), 0);
  assert.equal(countResourceText('{"a":1}\n\n[1,2]\r\nnull\n', 'jsonl'), 3);
  assert.equal(countResourceText(' \n', 'jsonl'), 0);
  assert.throws(() => countResourceText('[broken', 'json'), /Invalid JSON/);
  assert.throws(() => countResourceText('{}\ninvalid', 'jsonl'), /Invalid JSON/);
  assert.equal(countResourceText('{"items":[]}', 'json'), null);
  assert.equal(countResourceText('opaque bytes', 'pdf'), null);
});

test('bounds JSON nesting before parsing untrusted arrays or JSONL values', () => {
  const nested = '['.repeat(129) + '0' + ']'.repeat(129);
  assert.throws(() => countResourceText(nested, 'json'), /128-level/);
  assert.throws(() => countResourceText(nested, 'jsonl'), /128-level/);
  assert.equal(countResourceText('["[\\"\\"[[[", {}]', 'json'), 2);
});
