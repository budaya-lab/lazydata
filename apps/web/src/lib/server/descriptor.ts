import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { configuredRoot, discoverDatasets } from './discovery.ts';

export const MAX_DESCRIPTOR_BYTES = 5 * 1024 * 1024;

export class DescriptorError extends Error {
  readonly status: 404 | 413 | 500;

  constructor(status: 404 | 413 | 500, message: string, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}

export async function readDescriptor(root: string | undefined, name: string): Promise<string> {
  const parent = configuredRoot(root);
  if (!(await discoverDatasets(parent)).includes(name)) {
    throw new DescriptorError(404, 'Dataset not found.');
  }

  try {
    const directory = join(await fs.realpath(parent), name);
    if (await fs.realpath(directory) !== directory) {
      throw new DescriptorError(404, 'Dataset not found.');
    }
    const path = join(directory, 'datapackage.json');
    const before = await fs.lstat(path, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw new DescriptorError(500, 'datapackage.json must be a regular file, not a symlink or hard link.');
    }

    const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const opened = await file.stat({ bigint: true });
      if (!opened.isFile() || opened.nlink !== 1n || opened.dev !== before.dev || opened.ino !== before.ino
        || await fs.realpath(directory) !== directory) {
        throw new DescriptorError(500, 'datapackage.json changed while opening it. Reload and try again.');
      }
      if (opened.size > BigInt(MAX_DESCRIPTOR_BYTES)) {
        throw new DescriptorError(413, 'datapackage.json exceeds the 5 MiB viewing limit.');
      }
      const chunks: Buffer[] = [];
      for await (const chunk of file.createReadStream({ autoClose: false, start: 0, end: MAX_DESCRIPTOR_BYTES })) {
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length > MAX_DESCRIPTOR_BYTES) {
        throw new DescriptorError(413, 'datapackage.json exceeds the 5 MiB viewing limit.');
      }
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } finally {
      await file.close();
    }
  } catch (cause) {
    if (cause instanceof DescriptorError) throw cause;
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
      throw new DescriptorError(404, 'This dataset has no datapackage.json.', { cause });
    }
    throw new DescriptorError(500, 'Could not read datapackage.json as a regular UTF-8 file.', { cause });
  }
}
