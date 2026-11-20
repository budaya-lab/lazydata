import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { validateMetadata } from '@lazydata/validator';
import policy from '@lazydata/validator/policy' with { type: 'json' };
import { MAX_DATASET_TEXT_BYTES } from '../dataset-text-limits.ts';
import { MetadataDraftError, readMetadataObject } from '../metadata-json.ts';
import { DatasetTextError, readDatasetSnapshot } from './dataset-text.ts';

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
export async function saveMetadata(root: string | undefined, name: string, text: string): Promise<string[]> {
  const data = readMetadataObject(text);
  const issues = validateMetadata(data, policy);
  const snapshot = await readDatasetSnapshot(root, name, 'datapackage.json');
  await fs.access(snapshot.path, constants.W_OK);
  if (snapshot.stat.mode & 0o7000n) throw new MetadataDraftError('Special file permissions are not supported for saving.');
  const temporary = join(snapshot.directory, `.datapackage-${randomUUID()}.tmp`);
  const file = await fs.open(temporary, 'wx', 0o600);
  let committed = false;
  try {
    try {
      await file.writeFile(text, 'utf8');
      const stat = await file.stat({ bigint: true });
      if (stat.uid !== snapshot.stat.uid || stat.gid !== snapshot.stat.gid) {
        await file.chown(Number(snapshot.stat.uid), Number(snapshot.stat.gid));
      }
      await file.chmod(Number(snapshot.stat.mode & 0o777n));
      await file.sync();
    } finally { await file.close(); }
    await fs.rename(temporary, snapshot.path);
    committed = true;
  } finally {
    if (!committed) await fs.unlink(temporary);
  }
  return issues;
}
