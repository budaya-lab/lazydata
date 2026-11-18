import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LICENSE_PRESETS,
  licenseDraftIssues,
  licenseFormModel,
} from '../src/lib/license-fields.ts';

test('license presets use names accepted by the shared policy and permit custom identifiers', () => {
  assert.ok(LICENSE_PRESETS.includes('MIT'));
  assert.ok(LICENSE_PRESETS.includes('Apache-2.0'));
  assert.ok(LICENSE_PRESETS.includes('CC-BY-4.0'));
  for (const name of [...LICENSE_PRESETS, 'Research-License-1.0']) {
    assert.deepEqual(licenseDraftIssues([name]), [], name);
  }
  assert.ok(licenseDraftIssues(['GNU General Public License']).length > 0);
});

test('licenses are optional unless matched policy says otherwise', () => {
  assert.deepEqual(licenseDraftIssues([]), []);
  assert.ok(licenseDraftIssues([], true).length > 0);
  assert.ok(licenseDraftIssues(['']).length > 0);
});

test('prefills supplied names without coercion and warns for unsupported path-only entries', () => {
  const model = licenseFormModel(JSON.stringify({ licenses: [
    { name: 'MIT', title: 'MIT License' },
    { name: 'Custom-License' },
    { path: 'LICENSE' },
    { name: 3 },
    null,
  ] }));

  assert.equal(model.required, false);
  assert.deepEqual(model.names, ['MIT', 'Custom-License']);
  assert.match(model.message, /unsupported/);
  assert.deepEqual(licenseFormModel('{}').names, []);
  assert.deepEqual(licenseFormModel('{broken').names, []);
  assert.ok(licenseFormModel('{"licenses":{}}').message);
});
