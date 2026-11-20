import { constants, type BigIntStats } from 'node:fs';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { configuredRoot, discoverDatasets } from './discovery.ts';
import { MAX_DATASET_TEXT_BYTES } from '../dataset-text-limits.ts';

export { MAX_DATASET_TEXT_BYTES } from '../dataset-text-limits.ts';

export class DatasetTextError extends Error {
  readonly status: 404 | 413 | 500;

  constructor(status: 404 | 413 | 500, message: string, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}

export class DatasetNotFoundError extends DatasetTextError {
  constructor() {
    super(404, 'Dataset not found.');
  }
}

export type DatasetSnapshot = {
  text: string; directory: string; path: string; stat: BigIntStats; directoryStat: BigIntStats; version: string;
};

function identity(stat: BigIntStats): string {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.nlink, stat.mode, stat.uid, stat.gid].join(':');
}

export async function readDatasetSnapshot(root: string | undefined, name: string, filename: 'datapackage.json' | 'README.md' | 'buckets.csv'): Promise<DatasetSnapshot> {
  const limit = filename === 'buckets.csv' ? 1_000_000 : MAX_DATASET_TEXT_BYTES;
  const limitMessage = `${filename} exceeds the ${filename === 'buckets.csv' ? '1 MB' : '5 MiB'} viewing limit.`;
  const parent = configuredRoot(root);
  if (!(await discoverDatasets(parent)).includes(name)) throw new DatasetNotFoundError();

  try {
    const directory = join(await fs.realpath(parent), name);
    if (await fs.realpath(directory) !== directory) throw new DatasetNotFoundError();
    const directoryStat = await fs.stat(directory, { bigint: true });
    if (!directoryStat.isDirectory()) throw new DatasetNotFoundError();
    const path = join(directory, filename);
    const before = await fs.lstat(path, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw new DatasetTextError(500, `${filename} must be a regular file, not a symlink or hard link.`);
    }

    const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const opened = await file.stat({ bigint: true });
      if (!opened.isFile() || opened.nlink !== 1n || opened.dev !== before.dev || opened.ino !== before.ino
        || await fs.realpath(directory) !== directory) {
        throw new DatasetTextError(500, `${filename} changed while opening it. Reload and try again.`);
      }
      if (opened.size > BigInt(limit)) {
        throw new DatasetTextError(413, limitMessage);
      }
      const chunks: Buffer[] = [];
      for await (const chunk of file.createReadStream({ autoClose: false, start: 0, end: limit })) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      if (bytes.length > limit) {
        throw new DatasetTextError(413, limitMessage);
      }
      const after = await file.stat({ bigint: true });
      const afterDirectory = await fs.stat(directory, { bigint: true });
      if (identity(after) !== identity(opened) || afterDirectory.dev !== directoryStat.dev || afterDirectory.ino !== directoryStat.ino
        || await fs.realpath(directory) !== directory) {
        throw new DatasetTextError(500, `${filename} changed while reading it. Reload and try again.`);
      }
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const version = createHash('sha256').update(`${identity(after)}:${directoryStat.dev}:${directoryStat.ino}\0`).update(bytes).digest('hex');
      return { text, directory, path, stat: after, directoryStat, version };
    } finally {
      await file.close();
    }
  } catch (cause) {
    if (cause instanceof DatasetTextError) throw cause;
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
      throw new DatasetTextError(404, `This dataset has no ${filename}.`, { cause });
    }
    throw new DatasetTextError(500, `Could not read ${filename} as a regular UTF-8 file.`, { cause });
  }
}

export async function readDatasetText(root: string | undefined, name: string, filename: 'datapackage.json' | 'README.md'): Promise<string> {
  return (await readDatasetSnapshot(root, name, filename)).text;
}
