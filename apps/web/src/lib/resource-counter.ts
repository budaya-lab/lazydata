export type CountResult = { status: 'counted'; kind: 'file' | 'directory'; value: number; unit: 'rows' | 'items' | 'files' }
  | { status: 'unsupported' | 'error'; message: string };

function result(value: unknown): CountResult {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid count response.');
  const data = value as Record<string, unknown>;
  if (data.status === 'counted' && (data.kind === 'file' || data.kind === 'directory')
    && typeof data.value === 'number' && Number.isSafeInteger(data.value) && data.value >= 0
    && (data.unit === 'rows' || data.unit === 'items' || data.unit === 'files')) {
    return { status: 'counted', kind: data.kind, value: data.value, unit: data.unit };
  }
  if ((data.status === 'unsupported' || data.status === 'error') && typeof data.message === 'string' && data.message.length <= 200) {
    return { status: data.status, message: data.message };
  }
  throw new Error('Invalid count response.');
}

// One queue per form, never shared SSR/user data. Obsolete queued work is skipped.
export function createResourceCounter(url: string, fetcher: typeof fetch = fetch) {
  let pending = Promise.resolve();
  return (path: string, current: () => boolean = () => true): Promise<CountResult | null> => {
    const task = pending.then(async () => {
      if (!current()) return null;
      const response = await fetcher(`${url}?${new URLSearchParams({ path })}`);
      const parsed = result(await response.json());
      if (!response.ok && parsed.status !== 'error') throw new Error('Count request failed.');
      return parsed;
    });
    // The original task propagates errors to its caller; failures must not block later jobs.
    pending = task.then(() => undefined, () => undefined);
    return task;
  };
}
