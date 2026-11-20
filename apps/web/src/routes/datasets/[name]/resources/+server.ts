import { json } from '@sveltejs/kit';
import { inspectResource, ResourceReadError } from '../../../../lib/server/resource-files.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  if (url.searchParams.getAll('path').length !== 1) return json({ status: 'error', message: 'Provide exactly one resource path.' }, { status: 400 });
  try {
    return json(await inspectResource(process.env.DATASET_ROOT, params.name, url.searchParams.get('path')!));
  } catch (cause) {
    if (cause instanceof ResourceReadError) {
      if (cause.status === 500) console.error('Resource counting failed.');
      return json({ status: 'error', message: cause.message }, { status: cause.status });
    }
    console.error('Unexpected resource counting failure.');
    return json({ status: 'error', message: 'Could not count this resource.' }, { status: 500 });
  }
};
