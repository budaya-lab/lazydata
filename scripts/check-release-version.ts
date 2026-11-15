import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, 'utf8'));
const tag = process.env.RELEASE_TAG;
assert.ok(tag, 'RELEASE_TAG is required');
const version = tag.slice(1);

assert.equal(read('package.json').version, version);
assert.equal(read('packages/validator/package.json').version, version);
assert.equal(read('.release-please-manifest.json')['.'], version);
