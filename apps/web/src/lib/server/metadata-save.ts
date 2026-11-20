import { validateMetadata } from '@penjaga/validator';
import policy from '@penjaga/validator/policy' with { type: 'json' };
import { MAX_DATASET_TEXT_BYTES } from '../dataset-text-limits.ts';
import { MetadataDraftError, readMetadataObject } from '../metadata-json.ts';
import { DatasetTextError, readDatasetSnapshot } from './dataset-text.ts';
import { writeAtomicText } from './atomic-text.ts';
import { saveReadme } from './readme-save.ts';

export async function readSaveText(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > MAX_DATASET_TEXT_BYTES) {
    throw new DatasetTextError(413, 'Metadata exceeds the 5 MiB saving limit.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MetadataDraftError('Supply a JSON draft.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DATASET_TEXT_BYTES) {
        throw new DatasetTextError(413, 'Metadata exceeds the 5 MiB saving limit.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
  } catch (cause) {
    if (!(cause instanceof TypeError)) throw cause;
    throw new MetadataDraftError('Supply valid UTF-8 JSON.');
  }
}

// Single-user local Save: no external-change detection or revision protocol.
export async function saveMetadata(root: string | undefined, name: string, text: string): Promise<{
  issues: string[]; readme: 'updated' | 'unchanged' | 'skipped' | 'failed'; message: string;
}> {
  const data = readMetadataObject(text);
  const issues = validateMetadata(data, policy);
  const snapshot = await readDatasetSnapshot(root, name, 'datapackage.json');
  if (snapshot.stat.mode & 0o7000n) throw new MetadataDraftError('Special file permissions are not supported for saving.');
  await writeAtomicText(snapshot.directory, 'datapackage.json', text, snapshot.stat);
  if (issues.length) return { issues, readme: 'skipped', message: 'README.md was not updated because metadata checks have issues.' };
  try {
    const readme = await saveReadme(root, name, snapshot.directory, data);
    return { issues, readme, message: readme === 'updated' ? 'README.md updated.' : 'README.md is already up to date.' };
  } catch (cause) {
    console.error('README generation failed after metadata was saved.', cause instanceof Error ? cause.name : 'Unknown error');
    return { issues, readme: 'failed', message: 'Warning: metadata saved, but README.md could not be updated. Check README.md and buckets.csv.' };
  }
}
