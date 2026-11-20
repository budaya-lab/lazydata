import fs from 'node:fs/promises';

export class DiscoveryError extends Error {}

export function configuredRoot(root: string | undefined): string {
  if (!root?.trim()) {
    throw new DiscoveryError('Set DATASET_ROOT to a parent directory.');
  }
  return root;
}

export async function discoverDatasets(root: string | undefined): Promise<string[]> {
  const directory = configuredRoot(root);
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('ds-'))
      .map((entry) => entry.name)
      .sort();
  } catch (cause) {
    throw new DiscoveryError('Could not read DATASET_ROOT. Choose an existing, readable parent directory.', { cause });
  }
}
