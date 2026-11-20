import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createResourceCounter } from '../src/lib/resource-counter.ts';

const counted = { status: 'counted', kind: 'file', value: 0, unit: 'rows' };

test('serializes per-form count requests and skips obsolete queued paths', async () => {
  const calls: string[] = []; let finish!: () => void;
  const gate = new Promise<void>((resolve) => { finish = resolve; });
  const fetcher: typeof fetch = async (input) => {
    calls.push(String(input));
    if (calls.length === 1) await gate;
    return Response.json(counted);
  };
  const counter = createResourceCounter('/datasets/ds-example/resources', fetcher);
  const first = counter('a & b.csv'); const skipped = counter('stale.csv', () => false); const last = counter('second.csv');
  await Promise.resolve(); assert.equal(calls.length, 1);
  finish();
  assert.deepEqual(await first, counted); assert.equal(await skipped, null); assert.deepEqual(await last, counted);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0], 'http://localhost').searchParams.get('path'), 'a & b.csv');
});

test('propagates malformed/failed responses and continues the queue after a failure', async () => {
  let call = 0;
  const counter = createResourceCounter('/resources', async () => {
    call++;
    return call === 1 ? Response.json({ ...counted, value: -1 })
      : call === 2 ? Response.json({ status: 'error', message: 'Count limit.' }, { status: 413 })
      : Response.json(counted);
  });
  await assert.rejects(counter('invalid.csv'), /Invalid count response/);
  assert.deepEqual(await counter('large.csv'), { status: 'error', message: 'Count limit.' });
  assert.deepEqual(await counter('empty.csv'), counted);
  const failed = createResourceCounter('/resources', async () => { throw new TypeError('Network failure'); });
  await assert.rejects(failed('a.csv'), /Network failure/);
});
