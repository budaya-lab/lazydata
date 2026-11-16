import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../', import.meta.url));

async function fixture(t: TestContext): Promise<string> {
  const path = await fs.mkdtemp(join(tmpdir(), 'steward-http-'));
  t.after(() => fs.rm(path, { recursive: true, force: true }));
  return path;
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(path: string, relative: string): Promise<void> {
    const stat = await fs.lstat(path);
    if (stat.isSymbolicLink()) {
      result[relative] = `link:${await fs.readlink(path)}`;
    } else if (stat.isDirectory()) {
      result[relative] = 'directory';
      for (const name of (await fs.readdir(path)).sort()) {
        await visit(join(path, name), join(relative, name));
      }
    } else {
      result[relative] = `file:${(await fs.readFile(path)).toString('base64')}`;
    }
  }
  await visit(root, '.');
  return result;
}

async function serve(t: TestContext, mode: 'dev' | 'built', root?: string): Promise<{ url: string; logs: () => string }> {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const closed = once(reservation, 'close');
  reservation.close();
  await closed;

  const env: NodeJS.ProcessEnv = { ...process.env, HOST: '0.0.0.0', PORT: String(port), NO_COLOR: '1' };
  delete env.DATASET_ROOT;
  delete env.SOCKET_PATH;
  if (root !== undefined) env.DATASET_ROOT = root;
  const args = mode === 'built'
    ? ['scripts/start.ts']
    : [fileURLToPath(new URL('bin/vite.js', import.meta.resolve('vite/package.json'))),
      'dev', '--port', String(port), '--strictPort'];
  const child = spawn(process.execPath, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => { output += chunk; });
  child.stderr.on('data', (chunk: Buffer) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.kill('SIGTERM');
    try { await exited; } finally { clearTimeout(timeout); }
  });

  const url = `http://127.0.0.1:${port}`;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out:\n${output}`)), 30000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error(`Server exited:\n${output}`)); });
    child.stdout.on('data', () => {
      if (output.includes(url)) { clearTimeout(timeout); resolve(); }
    });
  });
  return { url, logs: () => output };
}

test('local startup rejects a socket override before loading the server', async (t) => {
  const base = await fixture(t);
  const socket = join(base, 'socket');
  const result = spawnSync(process.execPath, ['scripts/start.ts'], {
    cwd: app,
    env: { ...process.env, SOCKET_PATH: socket },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SOCKET_PATH is not supported/);
  assert.deepEqual(await fs.readdir(base), []);
});

for (const mode of ['dev', 'built'] as const) {
  test(`${mode}: lists escaped names without reading descriptors, following links or writing files`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    const outside = join(base, 'outside');
    for (const directory of ['ds-zeta/nested/ds-hidden', 'ds-alpha', 'ds-<b>&', 'other']) {
      await fs.mkdir(join(root, directory), { recursive: true });
    }
    await fs.mkdir(outside);
    await fs.writeFile(join(outside, 'marker'), 'outside fixture');
    await fs.writeFile(join(root, 'ds-zeta/datapackage.json'), '{invalid JSON');
    await fs.writeFile(join(root, 'ds-file'), 'not a dataset');
    await fs.symlink(outside, join(root, 'ds-outside'), 'dir');
    const before = await snapshot(base);
    const { url, logs } = await serve(t, mode, root);

    for (const path of ['/', `/?root=${encodeURIComponent(outside)}&DATASET_ROOT=${encodeURIComponent(outside)}`]) {
      const response = await fetch(url + path);
      assert.equal(response.status, 200);
      const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
      assert.match(html, /<h1>Datasets<\/h1>/);
      const names = [...html.matchAll(/<li>(.*?)<\/li>/gs)].map((match) => match[1]);
      assert.equal(names.length, 3);
      assert.match(names[0], /^ds-&lt;b(?:>|&gt;)&amp;$/);
      assert.deepEqual(names.slice(1), ['ds-alpha', 'ds-zeta']);
      assert.doesNotMatch(html, /<b>|ds-hidden|ds-outside|invalid JSON|outside fixture/);
      assert.equal(html.includes(root), false);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
      assert.doesNotMatch(html, /<style\b|rel="stylesheet"|\sstyle=/);
    }
    assert.equal((await fetch(url, { headers: { origin: 'https://untrusted.example' } })).status, 403, logs());
    const foreignHost = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(url, { headers: { host: 'untrusted.example' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(foreignHost, 403, logs());
    assert.deepEqual(await snapshot(base), before);
  });

  test(`${mode}: distinguishes empty roots from failed reads`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'empty');
    await fs.mkdir(root);
    const { url } = await serve(t, mode, root);
    const empty = await fetch(url);
    assert.equal(empty.status, 200);
    assert.match(await empty.text(), /No ds-\* folders found/);
    await fs.rmdir(root);
    const missing = await fetch(url);
    assert.equal(missing.status, 500);
    const html = await missing.text();
    assert.match(html, /Could not read DATASET_ROOT/);
    assert.equal(html.includes(root), false);
    assert.doesNotMatch(html, /ENOENT|at discoverDatasets|No ds-\* folders found|<style\b|rel="stylesheet"|\sstyle=/);
  });

  test(`${mode}: missing configuration never falls back to the working directory`, async (t) => {
    const { url, logs } = await serve(t, mode);
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.match(await response.text(), /Set DATASET_ROOT to a parent directory/, logs());
  });
}
