import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_BUCKET_BYTES, parseBuckets } from './buckets.js';

export function validateBuckets(root: string, required = false): string[] {
  const path = join(root, 'buckets.csv');

  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return required ? ['buckets.csv is required'] : [];
    }
    return ['buckets.csv could not be inspected'];
  }

  if (!stat.isFile() || stat.isSymbolicLink()) {
    return ['buckets.csv must be a regular non-symlink file'];
  }

  if (stat.size > MAX_BUCKET_BYTES) return ['buckets.csv exceeds the 1 MB limit'];

  try {
    parseBuckets(readFileSync(path));
    return [];
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return [error.message];
  }
}
