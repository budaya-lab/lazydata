import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('one repository release updates both package versions', () => {
  const config = readJson('release-please-config.json');
  const release = config.packages['.'];

  assert.deepEqual(Object.keys(config.packages), ['.']);
  assert.equal(release['release-type'], 'node');
  assert.equal(release['initial-version'], '0.1.0');
  assert.equal(config['include-component-in-tag'], false);
  assert.equal(config['include-v-in-tag'], true);
  assert.deepEqual(release['extra-files'], [
    { type: 'json', path: 'packages/validator/package.json', jsonpath: '$.version' },
  ]);
});

test('workspace, validator and released manifest versions stay aligned', () => {
  const workspace = readJson('package.json');
  const validator = readJson('packages/validator/package.json');
  const manifest = readJson('.release-please-manifest.json');

  assert.match(workspace.version, /^\d+\.\d+\.\d+$/);
  assert.equal(validator.version, workspace.version);
  assert.ok(Object.keys(manifest).every((path) => path === '.'));

  if (Object.hasOwn(manifest, '.')) {
    assert.equal(manifest['.'], workspace.version);
  } else {
    assert.equal(workspace.version, '0.0.0', 'only an unreleased project can have an empty manifest');
  }
});
