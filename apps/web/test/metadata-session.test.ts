import assert from 'node:assert/strict';
import { test } from 'node:test';
import { receiveMetadataSession, updateMetadataSession } from '../src/lib/metadata-session.ts';

test('view loads retain the working object and revision even when disk changes', () => {
  const original = { name: 'ds-a', metadataText: '{"title":"Old"}', revision: 'v1' };
  const loaded = receiveMetadataSession(null, 'ds-a', original);
  loaded?.draft?.update({ overview: { title: 'New' } });
  const edited = updateMetadataSession(loaded, 'ds-a', '');
  assert.equal(receiveMetadataSession(edited, 'ds-a'), edited);
  assert.equal(receiveMetadataSession(edited, 'ds-a', { ...original, revision: 'v2', metadataText: '{}' }), edited);
  assert.equal(edited?.metadata, original, 'form baseline identity stays stable while the draft changes');
  assert.equal(edited?.draft, loaded?.draft, 'one working object across notifications');
  assert.equal(edited?.metadata.revision, 'v1');
  assert.equal(JSON.parse(edited!.draft!.text()).title, 'New');
  assert.equal(original.metadataText, '{"title":"Old"}');
});

test('owners are isolated and stale notifications cannot affect another dataset', () => {
  const original = { name: 'ds-a', metadataText: '{}', revision: 'v1' };
  const first = receiveMetadataSession(null, 'ds-a', original);
  const second = receiveMetadataSession(null, 'ds-a', original);
  first?.draft?.update({ overview: { title: 'Edited' } });
  const edited = updateMetadataSession(first, 'ds-a', '');
  assert.deepEqual(JSON.parse(second!.draft!.text()), {});
  assert.equal(receiveMetadataSession(edited, 'ds-b'), null);
  const next = receiveMetadataSession(edited, 'ds-b', { ...original, name: 'ds-b' });
  assert.equal(updateMetadataSession(next, 'ds-a', 'stale'), next);
});

test('unsafe JSON remains viewable, with an explicit editing error rather than a page failure', () => {
  const original = { name: 'ds-a', metadataText: '{"n":9007199254740993}', revision: 'v1' };
  const owner = receiveMetadataSession(null, 'ds-a', original);
  assert.equal(owner?.draft, null);
  assert.match(owner!.error, /number.*round-trip/);
  assert.equal(owner?.metadata.metadataText, original.metadataText);
});
