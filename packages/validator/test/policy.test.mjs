import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { validatePolicy } from '@lazydata/validator';

const policy = JSON.parse(readFileSync(new URL('../dataset.config.json', import.meta.url), 'utf8'));

test('accepts the policy without changing it', () => {
  const before = structuredClone(policy);

  assert.deepEqual(validatePolicy(policy), []);
  assert.deepEqual(policy, before);
});

test('rejects malformed, unsupported and contradictory policies', () => {
  for (const invalid of [
    null,
    [],
    { ...policy, schemaVersion: 2 },
    { ...policy, extra: true },
    { ...policy, stages: {} },
    { ...policy, stages: { Master: 'Master' } },
    { ...policy, stages: { master: ' ' } },
    { ...policy, package: { requiredFields: ['title'] } },
    { ...policy, package: { requiredFields: ['name', 'resources', 'unknown'] } },
    { ...policy, resource: { requiredFields: ['name', 'path', 'format'] } },
    { ...policy, resource: { requiredFields: ['name', 'path', 'path'] } },
    { ...policy, keywords: { ...policy.keywords, requiredPrefixes: ['task', 'task'] } },
    { ...policy, keywords: { ...policy.keywords, requiredPrefixes: ['task:'] } },
    { ...policy, keywords: { ...policy.keywords, allowOtherKeywords: 'yes' } },
    { ...policy, buckets: { required: null } },
    { ...policy, buckets: { required: false, extra: true } },
  ]) {
    assert.notDeepEqual(validatePolicy(invalid), [], JSON.stringify(invalid));
  }

  const missingKeywords = structuredClone(policy);
  missingKeywords.package.requiredFields = ['name', 'resources'];

  assert.notDeepEqual(validatePolicy(missingKeywords), []);
});
