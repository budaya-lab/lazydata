import assert from 'node:assert/strict';

type CommandFailure = Error & { status: number; stderr: string | Buffer };

export function assertCommandFailure(error: unknown): asserts error is CommandFailure {
  assert.ok(error instanceof Error);
  assert.ok('status' in error && typeof error.status === 'number');
  assert.ok('stderr' in error && (typeof error.stderr === 'string' || Buffer.isBuffer(error.stderr)));
}
