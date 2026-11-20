import { MetadataDraft, MetadataDraftError } from '../../src/lib/metadata-draft.ts';
import { receiveMetadataSession, updateMetadataSession } from '../../src/lib/metadata-session.ts';

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function refused(action: () => unknown): void {
  try { action(); } catch (cause) {
    if (cause instanceof MetadataDraftError) return;
    throw cause;
  }
  throw new Error('Expected a metadata editing refusal.');
}

export function runMetadataBrowserProbe(): string {
  const original = '{ "title":"Ol\\u0064", "resources":[{"owner":"A"},{"owner":"B","n":123}], "sources":[{"title":"Source","path":"original.csv","n":1.2300e-9}], "extra":{"kept":true} }';
  const owner = receiveMetadataSession(null, 'ds-test', { name: 'ds-test', metadataText: original, revision: 'v1' });
  const draft = owner?.draft;
  expect(!!draft, 'Working object was not created.');
  draft!.update({ overview: { title: '中文 😀' } });
  draft!.update({ resources: [
    { id: 1, fields: { name: null, path: null, format: null, title: 'Resource' } },
    { id: 200, fields: { name: null, title: null, format: null, path: 'new.csv' } },
  ] });
  draft!.update({ sources: [{ id: 0, fields: { title: 'Source', path: 'https://example.invalid/source' } }] });
  draft!.update({ keywords: { tasks: ['new'] }, licenses: ['MIT'], licenseIds: [200],
    contributors: [{ id: 200, fields: { title: 'Person', roles: ['creator'] } }] });
  const data = JSON.parse(draft!.text());
  expect(data.title === '中文 😀', 'Unicode title changed.');
  expect(data.resources[0].owner === 'B' && data.resources[0].n === 123, 'Surviving row metadata changed.');
  expect(data.sources[0].n === 1.23e-9 && data.extra.kept, 'Unexposed metadata changed.');
  expect(data.contributors[0].roles[0] === 'creator', 'Contributor roles did not sync.');
  const edited = updateMetadataSession(owner, 'ds-test', '');
  expect(receiveMetadataSession(edited, 'ds-test')?.draft === draft, 'View change replaced the working object.');
  refused(() => new MetadataDraft('{"x":1,"x":2}'));
  refused(() => new MetadataDraft('{"x":9007199254740993}'));
  const before = draft!.text();
  refused(() => draft!.update({ overview: { title: '字'.repeat(2 * 1024 * 1024) } }));
  expect(draft!.text() === before, 'Refused edit changed the draft.');
  return 'object editing and UTF-8 limits passed';
}
