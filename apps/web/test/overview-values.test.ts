import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { isSemver } from '../src/lib/overview-values.ts';

const helpers = new URL('../src/lib/overview-values.ts', import.meta.url).href;

function inZone(zone: string, dates: string[], timestamps: string[] = []): { midnights: (string | null)[]; days: (string | null)[] } {
  const source = `import { createdAtLocalMidnight, localDateForCreated } from ${JSON.stringify(helpers)};
    console.log(JSON.stringify({ midnights: ${JSON.stringify(dates)}.map(createdAtLocalMidnight),
      days: ${JSON.stringify(timestamps)}.map(localDateForCreated) }));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    env: { ...process.env, TZ: zone }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test('accepts exact SemVer including prerelease and build metadata, without numeric coercion', () => {
  for (const value of ['0.0.0', '1.2.3', '1.0.0-alpha.1', '1.0.0-0', '1.2.3+001', '1.2.3-rc.1+build.42', '999999999999999999999.0.0']) {
    assert.equal(isSemver(value), true, value);
  }
  for (const value of ['', ' ', 'v1.2.3', '1', '1.2', '01.2.3', '1.02.3', '1.2.03',
    '1.2.3-01', '1.2.3-alpha..1', '1.2.3+', '1.2.3+bad..build', ' 1.2.3', '1.2.3 ', '1.2.3\n']) {
    assert.equal(isSemver(value), false, JSON.stringify(value));
  }
});

test('serializes the selected date at midnight with its local numeric RFC3339 offset', () => {
  for (const [zone, offset] of [['UTC', '+00:00'], ['Asia/Singapore', '+08:00'],
    ['Asia/Kathmandu', '+05:45'], ['America/St_Johns', '-03:30'], ['Pacific/Chatham', '+13:45']]) {
    assert.deepEqual(inZone(zone, ['2026-01-02']).midnights, [`2026-01-02T00:00:00${offset}`], zone);
  }
});

test('uses the offset at the selected midnight, not now or noon on the transition date', () => {
  assert.deepEqual(inZone('America/New_York', ['2026-03-08', '2026-03-09', '2026-11-01', '2026-11-02']).midnights,
    ['2026-03-08T00:00:00-05:00', '2026-03-09T00:00:00-04:00', '2026-11-01T00:00:00-04:00', '2026-11-02T00:00:00-05:00']);
});

test('does not silently roll an invalid date or nonexistent local midnight forward', () => {
  assert.deepEqual(inZone('UTC', ['', '2026-02-29', '2026-04-31', '2026-1-02', '0000-01-01', '10000-01-01', '2026-01-01\n']).midnights,
    [null, null, null, null, null, null, null]);
  assert.deepEqual(inZone('America/Sao_Paulo', ['2018-11-04']).midnights, [null]);
  assert.deepEqual(inZone('Pacific/Apia', ['2011-12-30']).midnights, [null]);
  assert.deepEqual(inZone('Europe/Paris', ['1900-01-01']).midnights, [null]);
  assert.deepEqual(inZone('UTC', ['2024-02-29', '0099-01-02']).midnights,
    ['2024-02-29T00:00:00+00:00', '0099-01-02T00:00:00+00:00']);
});

test('prefills the browser-local calendar date from an existing RFC3339 instant', () => {
  const timestamps = ['2026-01-01T20:00:00.123Z', '2026-01-02T00:00:00+08:00', '2026-01-01T20:00:00-00:00'];
  assert.deepEqual(inZone('Asia/Singapore', [], timestamps).days, ['2026-01-02', '2026-01-02', '2026-01-02']);
  assert.deepEqual(inZone('America/Los_Angeles', [], timestamps).days, ['2026-01-01', '2026-01-01', '2026-01-01']);
});

test('does not invent a date from missing, malformed or normalized-overflow timestamp text', () => {
  assert.deepEqual(inZone('UTC', [], ['', '2026-01-01', 'January 1 2026', '2026-02-31T00:00:00Z',
    '2026-01-01T24:00:00Z', '2026-01-01T00:00:00+24:00', '2026-01-01T00:00:00Z\n']).days,
    [null, null, null, null, null, null, null]);
});
