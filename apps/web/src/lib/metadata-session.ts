import { MetadataDraft, MetadataDraftError } from './metadata-draft.ts';

type Snapshot = { name: string; metadataText: string; revision: string };
export type MetadataSession<Model extends Snapshot> = { metadata: Model; draft: MetadataDraft | null; error: string };

// A new router result for the same dataset cannot replace an existing local draft.
export function receiveMetadataSession<Model extends Snapshot>(
  current: MetadataSession<Model> | null, name: string, metadata?: Model,
): MetadataSession<Model> | null {
  if (current?.metadata.name === name) return current;
  if (!metadata || metadata.name !== name) return null;
  try {
    return { metadata, draft: new MetadataDraft(metadata.metadataText), error: '' };
  } catch (cause) {
    if (!(cause instanceof MetadataDraftError)) throw cause;
    return { metadata, draft: null, error: cause.message };
  }
}

export function updateMetadataSession<Model extends Snapshot>(
  current: MetadataSession<Model> | null, name: string, error: string,
): MetadataSession<Model> | null {
  return current?.metadata.name === name ? { ...current, error } : current;
}
