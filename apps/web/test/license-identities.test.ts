import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLicenseIdentities } from '../src/lib/license-identities.ts';

test('duplicate tag removal retains the identity of the actual surviving entry', () => {
  const ids = createLicenseIdentities(['MIT', 'MIT']);
  assert.deepEqual(ids.update(['MIT'], 0), [1]);
  assert.deepEqual(ids.update(['MIT', 'Custom']), [1, 200]);
});

test('pending tag edits keep new identities away from supplied entry identities', () => {
  const ids = createLicenseIdentities(['MIT']);
  assert.deepEqual(ids.update(['MIT', 'C']), [0, 200]);
  const next = ids.update(['MIT', 'Custom']);
  assert.equal(next[0], 0);
  assert.ok(next[1] >= 200);
  assert.deepEqual(ids.update(['MIT']), [0]);
});
