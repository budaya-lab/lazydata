import { parseBuckets } from '@lazydata/validator';
import { MAX_DATASET_TEXT_BYTES } from '../dataset-text-limits.ts';
import { writeAtomicText } from './atomic-text.ts';
import { DatasetNotFoundError, DatasetTextError, readDatasetSnapshot } from './dataset-text.ts';
import { generateReadme } from './readme-generation.ts';

async function optionalSnapshot(root: string | undefined, name: string, filename: 'README.md' | 'buckets.csv') {
  try {
    return await readDatasetSnapshot(root, name, filename);
  } catch (cause) {
    if (cause instanceof DatasetTextError && !(cause instanceof DatasetNotFoundError) && cause.status === 404) return undefined;
    throw cause;
  }
}

export async function saveReadme(root: string | undefined, name: string, directory: string, data: Record<string, unknown>): Promise<'updated' | 'unchanged'> {
  const existing = await optionalSnapshot(root, name, 'README.md');
  const buckets = await optionalSnapshot(root, name, 'buckets.csv');
  const text = generateReadme(data, buckets ? parseBuckets(buckets.text) : undefined, existing?.text);
  if (Buffer.byteLength(text, 'utf8') > MAX_DATASET_TEXT_BYTES) throw new Error('Generated README exceeds the 5 MiB limit.');
  if (existing?.text === text) return 'unchanged';
  await writeAtomicText(directory, 'README.md', text, existing?.stat);
  return 'updated';
}
