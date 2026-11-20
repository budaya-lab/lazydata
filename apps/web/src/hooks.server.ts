import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
  const host = event.request.headers.get('host');
  const origin = event.request.headers.get('origin');
  const local = /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host ?? '');
  const response = !local || (origin !== null && origin !== event.url.origin)
    ? new Response('Forbidden', { status: 403 })
    : await resolve(event);

  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('cache-control', 'no-store');
  return response;
};
