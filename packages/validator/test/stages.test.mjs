import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { getStage, stageLabel } from '@lazydata/validator';

const policy = JSON.parse(readFileSync(new URL('../dataset.config.json', import.meta.url), 'utf8'));

test('stage helpers allow missing catalogue stages and use configured labels', () => {
  assert.equal(getStage(undefined, policy), undefined);
  assert.equal(stageLabel(['subject'], policy), undefined);
  assert.equal(getStage(['stage:ground-truth'], policy), 'ground-truth');
  assert.equal(stageLabel(['stage:ground-truth'], policy), 'Ground truth');

  const custom = { ...policy, stages: { draft: 'Draft collection' } };

  assert.equal(getStage(['topic:example', 'stage:draft'], custom), 'draft');
  assert.equal(stageLabel(['stage:draft'], custom), 'Draft collection');
  assert.throws(() => getStage(['stage:master'], custom), /stage/);
});

test('stage helpers reject malformed, duplicate and unknown stages', () => {
  for (const keywords of [
    null,
    'stage:master',
    [42],
    [' '],
    ['stage:'],
    ['stage:unknown'],
    ['stage:master', 'stage:master'],
    ['stage:master', 'stage:curated'],
  ]) {
    assert.throws(() => getStage(keywords, policy), /keywords|stage/);
  }
});
