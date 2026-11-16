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
  test(`${mode}: lists escaped names and statuses without following links or writing files`, async (t) => {
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
      const names = [...html.matchAll(/<li><a href="[^"]+">(.*?)<\/a>/gs)].map((match) => match[1]);
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

  test(`${mode}: opens the selected descriptor as escaped text without writes`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    const name = 'ds-100% #?';
    const directory = join(root, name);
    const outside = join(base, 'outside');
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(join(root, 'ds-missing'));
    await fs.mkdir(join(root, 'ds-literal%2F'));
    await fs.writeFile(join(root, 'ds-literal%2F/datapackage.json'), 'literal percent marker');
    await fs.mkdir(outside);
    const text = '{invalid JSON\n<script>not executable</script> & raw text\n';
    const path = join(directory, 'datapackage.json');
    await fs.writeFile(path, text);
    await fs.writeFile(join(outside, 'datapackage.json'), 'outside marker');
    const before = await snapshot(base);
    const { url } = await serve(t, mode, root);
    const listing = await (await fetch(url)).text();
    const links = [...listing.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    const href = links.find((value) => value.includes('/datasets/'));
    assert.ok(href);
    const selected = new URL(href, url);
    const response = await fetch(selected);
    assert.equal(response.status, 200);
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /datapackage\.json/);
    assert.match(html, /<pre><code>\{invalid JSON/);
    assert.match(html, /&lt;script(?:>|&gt;)not executable&lt;\/script(?:>|&gt;)/);
    assert.doesNotMatch(html, /<script>|<textarea|<form|<style\b|outside marker/);
    assert.equal(html.includes(root), false);
    const back = html.match(/<a href="([^"]+)">Back to datasets<\/a>/);
    assert.ok(back);
    assert.equal((await fetch(new URL(back[1], selected))).status, 200);
    const literal = links.find((value) => value.includes('ds-literal'));
    assert.ok(literal);
    const literalResponse = await fetch(new URL(literal, url));
    assert.equal(literalResponse.status, 200);
    assert.match(await literalResponse.text(), /literal percent marker/);

    for (const leaf of ['ds-missing', 'ds-unknown']) {
      const missing = await fetch(`${url}/datasets/${leaf}`);
      assert.equal(missing.status, 404);
      assert.match(await missing.text(), /no datapackage\.json|Dataset not found/);
    }
    for (const leaf of ['../outside', 'ds-missing/../../outside']) {
      const denied = await fetch(`${url}/datasets/${encodeURIComponent(leaf)}`);
      assert.ok([400, 404].includes(denied.status));
      assert.doesNotMatch(await denied.text(), /outside marker/);
    }
    assert.deepEqual(await snapshot(base), before);

    await fs.unlink(path);
    await fs.symlink(join(outside, 'datapackage.json'), path);
    const linked = await fetch(selected);
    assert.equal(linked.status, 500);
    assert.doesNotMatch(await linked.text(), /outside marker/);
    assert.equal(await fs.readFile(join(outside, 'datapackage.json'), 'utf8'), 'outside marker');
  });

  test(`${mode}: shows supplied metadata and shared issues without migrating or scanning resources`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    const modern = {
      name: 'modern', title: 'Supplied title', description: 'Supplied description',
      keywords: ['task:classification', 'project:example', 'stage:curated'],
      contributors: [{ title: 'Alice', roles: ['creator'] }, { title: 'Bob', roles: ['reviewer'] }],
      resources: [{ name: 'input', title: 'Input', path: 'missing.csv' }],
    };
    const cases = {
      modern: JSON.stringify(modern),
      legacy: JSON.stringify({ name: 'legacy', creator: 'Legacy person', task: 'Legacy task' }),
      malformed: '{invalid JSON',
      unsafe: JSON.stringify({ ...modern, title: '<img src=x onerror=alert(1)>',
        contributors: [{ title: '<script>creator</script>', roles: ['creator'] }],
        resources: [{ name: 'bad<script>', path: [], count: -1 }] }),
      conflicts: JSON.stringify({ ...modern, keywords: ['task:one', 'task:two', 'project:', 'stage:unknown', 'stage:master'] }),
    };
    for (const [name, text] of Object.entries(cases)) {
      const directory = join(root, `ds-${name}`);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(join(directory, 'datapackage.json'), text);
      await fs.writeFile(join(directory, 'dataset.config.json'), '{invalid local policy');
      await fs.writeFile(join(directory, 'buckets.csv'), 'not a valid bucket summary');
    }
    const before = await snapshot(base);
    const { url, logs } = await serve(t, mode, root);
    const pages: Record<string, string> = {};
    for (const name of Object.keys(cases)) {
      const response = await fetch(`${url}/datasets/ds-${name}`);
      assert.equal(response.status, 200, logs());
      pages[name] = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
      assert.match(pages[name], /<h2>Metadata validation<\/h2>/);
      assert.match(pages[name], /Resource files and buckets are not read/);
      assert.doesNotMatch(pages[name], /<style\b|rel="stylesheet"|<textarea|<form|Dataset is valid/);
      assert.equal(pages[name].includes(root), false);
    }
    assert.match(pages.modern, /<dt>Creators<\/dt>\s*<dd>Alice<\/dd>/);
    assert.match(pages.modern, /<dt>Task<\/dt>\s*<dd>classification<\/dd>/);
    assert.match(pages.modern, /<dt>Project<\/dt>\s*<dd>example<\/dd>/);
    assert.match(pages.modern, /<dt>Stage<\/dt>\s*<dd>curated<\/dd>/);
    assert.match(pages.modern, /Metadata checks passed/);
    for (const label of ['Creators', 'Task', 'Project', 'Stage']) {
      assert.match(pages.legacy, new RegExp(`<dt>${label}</dt>\\s*<dd>Not supplied</dd>`));
    }
    assert.match(pages.legacy, /title is required/);
    assert.match(pages.legacy, /keywords must contain exactly one nonempty task: keyword/);
    assert.match(pages.malformed, /datapackage.json is not valid JSON/);
    assert.match(pages.malformed, /<pre><code>\{invalid JSON/);
    assert.doesNotMatch(pages.unsafe, /<img|<script>|\[object Object\]/);
    assert.match(pages.unsafe, /&lt;img/);
    assert.match(pages.unsafe, /resource bad&lt;script(?:>|&gt;) count must be/);
    assert.match(pages.conflicts, /<dt>Task<\/dt>\s*<dd>one; two<\/dd>/);
    assert.match(pages.conflicts, /<dt>Stage<\/dt>\s*<dd>unknown; master<\/dd>/);
    assert.match(pages.conflicts, /keywords must contain at most one known stage/);
    assert.deepEqual(await snapshot(base), before);
  });

  test(`${mode}: displays current metadata statuses beside every dataset link`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    const valid = JSON.stringify({ name: 'example', title: 'Example', description: 'Supplied description',
      keywords: ['task:example', 'project:example', 'stage:master'],
      resources: [{ name: 'input', title: 'Input', path: 'missing.csv' }],
    });
    for (const name of ['passed', 'issues', 'missing', 'unsafe']) {
      await fs.mkdir(join(root, `ds-${name}`), { recursive: true });
    }
    await fs.writeFile(join(root, 'ds-passed/datapackage.json'), valid);
    const changed = join(root, 'ds-issues/datapackage.json');
    await fs.writeFile(changed, '{invalid JSON');
    const marker = join(base, 'outside-marker');
    await fs.writeFile(marker, 'outside marker');
    await fs.symlink(marker, join(root, 'ds-unsafe/datapackage.json'));
    const before = await snapshot(base);
    const { url, logs } = await serve(t, mode, root);
    const response = await fetch(url);
    assert.equal(response.status, 200, logs());
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /ds-passed<\/a>\s*— Metadata checks passed/);
    assert.match(html, /ds-issues<\/a>\s*— Metadata issues \(1\)/);
    assert.match(html, /ds-missing<\/a>\s*— Metadata unavailable:/);
    assert.match(html, /ds-unsafe<\/a>\s*— Metadata unavailable:/);
    assert.match(html, /Resource files and buckets are not read/);
    assert.doesNotMatch(html, /outside marker|<style\b|Dataset is valid/);
    assert.equal(html.includes(root), false);
    assert.deepEqual(await snapshot(base), before);

    await fs.writeFile(changed, valid);
    const fixed = await snapshot(base);
    const refreshed = await fetch(url);
    assert.equal(refreshed.status, 200, logs());
    assert.match((await refreshed.text()).replace(/<!--[\s\S]*?-->/g, ''), /ds-issues<\/a>\s*— Metadata checks passed/);
    assert.deepEqual(await snapshot(base), fixed);
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
