import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { validateMetadata } from '@lazydata/validator';

const policy = JSON.parse(readFileSync(new URL('../dataset.config.json', import.meta.url), 'utf8'));
const data = {
  name: 'example',
  title: 'Example',
  description: 'Synthetic example.',
  keywords: ['task:example', 'project:example', 'stage:master', 'subject', 'topic:example'],
  resources: [{ name: 'input', title: 'Input', path: 'not-present.csv' }],
};

test('portable metadata validation accepts safe references without inspecting or changing them', () => {
  const freeze = (value) => {
    if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }

    return value;
  };

  const descriptor = freeze(structuredClone(data));
  const config = freeze(structuredClone(policy));

  assert.deepEqual(validateMetadata(descriptor, config), []);
});

test('requires one nonblank value per prefix while allowing other keywords', () => {
  for (const prefix of ['task', 'project', 'stage']) {
    const others = data.keywords.filter((keyword) => !keyword.startsWith(`${prefix}:`));
    const valid = data.keywords.find((keyword) => keyword.startsWith(`${prefix}:`));

    for (const keywords of [others, [...others, `${prefix}: `], [...data.keywords, valid]]) {
      const errors = validateMetadata({ ...data, keywords }, policy);

      assert.ok(errors.some((error) => error.includes(prefix)), JSON.stringify(keywords));
    }
  }

  for (const keywords of [null, [''], [' '], [42]]) {
    assert.ok(validateMetadata({ ...data, keywords }, policy).some((error) => /keywords/.test(error)));
  }
});

test('policy changes control required fields and other-keyword allowance', () => {
  const optionalTitles = structuredClone(policy);
  optionalTitles.package.requiredFields = ['name', 'keywords', 'resources'];
  optionalTitles.resource.requiredFields = ['name', 'path'];

  const untitled = {
    ...data,
    title: undefined,
    description: undefined,
    resources: [{ name: 'input', path: 'input.csv' }],
  };

  assert.deepEqual(validateMetadata(untitled, optionalTitles), []);
  assert.ok(validateMetadata({ ...untitled, title: ' ' }, optionalTitles).length > 0);

  const requireCreated = structuredClone(policy);
  requireCreated.package.requiredFields.push('created');

  assert.ok(validateMetadata(data, requireCreated).some((error) => /created/.test(error)));

  const onlyPrefixed = structuredClone(policy);
  onlyPrefixed.keywords.allowOtherKeywords = false;

  assert.ok(validateMetadata(data, onlyPrefixed).some((error) => /other keywords/.test(error)));
  assert.deepEqual(validateMetadata({ ...data, keywords: data.keywords.slice(0, 3) }, onlyPrefixed), []);

  const extraPrefix = structuredClone(policy);
  extraPrefix.keywords.requiredPrefixes.push('collection');

  assert.ok(validateMetadata(data, extraPrefix).some((error) => /collection/.test(error)));
  assert.deepEqual(validateMetadata({
    ...data,
    keywords: [...data.keywords, 'collection:example'],
  }, extraPrefix), []);
});

test('invalid policy fails instead of reporting a successful metadata validation', () => {
  assert.throws(() => validateMetadata(data, { ...policy, schemaVersion: 2 }), /dataset\.config/);
});
