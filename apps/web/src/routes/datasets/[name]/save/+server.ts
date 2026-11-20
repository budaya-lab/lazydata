import { json } from '@sveltejs/kit';
import { MetadataDraftError } from '../../../../lib/metadata-json.ts';
import { DatasetTextError } from '../../../../lib/server/dataset-text.ts';
import { readSaveText, saveMetadata } from '../../../../lib/server/metadata-save.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, url }) => {
  if (request.headers.get('origin') !== url.origin) return json({ status: 'error', message: 'Forbidden' }, { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ status: 'error', message: 'Supply application/json.' }, { status: 415 });
  }
  try {
    const result = await saveMetadata(process.env.DATASET_ROOT, params.name, await readSaveText(request));
    return json({ status: 'saved', ...result });
  } catch (cause) {
    if (cause instanceof Error && 'status' in cause && cause.status === 413) return json({ status: 'error', message: 'Metadata exceeds the 5 MiB saving limit.' }, { status: 413 });
    if (cause instanceof MetadataDraftError) return json({ status: 'error', message: cause.message }, { status: 400 });
    if (cause instanceof DatasetTextError && cause.status !== 500) {
      return json({ status: 'error', message: cause.message }, { status: cause.status });
    }
    console.error('Metadata saving failed.');
    return json({ status: 'error', message: 'Could not save datapackage.json. Your draft is retained; reload only if you want to discard it.' }, { status: 500 });
  }
};
