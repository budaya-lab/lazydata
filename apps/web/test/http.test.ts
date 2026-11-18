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
import policy from '@lazydata/validator/policy' with { type: 'json' };

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

function breadcrumb(html: string): string {
  const nav = html.match(/<nav\b[^>]*aria-label="Breadcrumb"[^>]*>[\s\S]*?<\/nav>/);
  assert.ok(nav, 'Expected breadcrumb navigation');
  return nav[0].replace(/<!--[\s\S]*?-->/g, '');
}

function tableRow(html: string, name: string): string {
  const row = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)]
    .find(([row]) => row.includes(`>${name}</a>`));
  assert.ok(row, `Missing dataset row: ${name}`);
  return row[0];
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
  if (mode === 'built') Object.assign(env, { PROTOCOL_HEADER: 'x-forwarded-proto', HOST_HEADER: 'x-forwarded-host', PORT_HEADER: 'x-forwarded-port' });
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
  test(`${mode}: keeps the local HTTP origin despite forged proxy headers`, async (t) => {
    const root = await fixture(t);
    const { url, logs } = await serve(t, mode, root);
    const headers = { origin: url, 'x-lazydata-protocol': 'https', 'x-forwarded-proto': 'https',
      'x-forwarded-host': 'untrusted.example', 'x-forwarded-port': '443' };
    assert.equal((await fetch(url, { headers })).status, 200, logs());
    assert.equal((await fetch(url, { method: 'POST', headers, body: new URLSearchParams() })).status, 405);
    assert.equal((await fetch(url, { headers: { ...headers, origin: 'https://untrusted.example' } })).status, 403);
  });

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
      assert.match(html, /<h1\b[^>]*>Datasets<\/h1>/);
      const trail = breadcrumb(html);
      assert.match(trail, />Datasets<\//);
      assert.doesNotMatch(trail, /<a\b/);
      const names = [...html.matchAll(/data-dataset-link[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
      assert.equal(names.length, 3);
      assert.match(names[0], /^ds-&lt;b(?:>|&gt;)&amp;$/);
      assert.deepEqual(names.slice(1), ['ds-alpha', 'ds-zeta']);
      assert.doesNotMatch(html, /<b>|ds-hidden|ds-outside|invalid JSON|outside fixture/);
      assert.equal(html.includes(root), false);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
      assert.doesNotMatch(html, /\sstyle=/);
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
    const unsafeName = 'ds-<img src=x onerror=alert(1)>';
    await fs.mkdir(join(root, unsafeName));
    await fs.writeFile(join(root, unsafeName, 'datapackage.json'), '{}');
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
    selected.searchParams.set('view', 'datapackage');
    const response = await fetch(selected);
    assert.equal(response.status, 200);
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /datapackage\.json/);
    assert.match(html, /<pre[^>]*><code>\{invalid JSON/);
    assert.match(html, /&lt;script(?:>|&gt;)not executable&lt;\/script(?:>|&gt;)/);
    assert.doesNotMatch(html, /<script>|<textarea|<form|outside marker/);
    assert.equal(html.includes(root), false);
    assert.doesNotMatch(html, /Back to datasets/);
    const trail = breadcrumb(html);
    assert.ok(trail.includes(`>${name}</`));
    const collection = trail.match(/<a\b[^>]*href="([^"]+)"[^>]*>Datasets<\/a>/);
    assert.ok(collection);
    const collectionUrl = new URL(collection[1], selected);
    assert.equal(collectionUrl.pathname, '/');
    const returned = await fetch(collectionUrl);
    assert.equal(returned.status, 200);
    assert.match(await returned.text(), /<h1\b[^>]*>Datasets<\/h1>/);
    const literal = links.find((value) => value.includes('ds-literal'));
    assert.ok(literal);
    const literalUrl = new URL(literal, url);
    literalUrl.searchParams.set('view', 'datapackage');
    const literalResponse = await fetch(literalUrl);
    assert.equal(literalResponse.status, 200);
    const literalHtml = await literalResponse.text();
    assert.match(literalHtml, /literal percent marker/);
    assert.ok(breadcrumb(literalHtml).includes('>ds-literal%2F</'));
    const escapedResponse = await fetch(`${url}/datasets/${encodeURIComponent(unsafeName)}?view=metadata`);
    assert.equal(escapedResponse.status, 200);
    const escapedTrail = breadcrumb(await escapedResponse.text());
    assert.match(escapedTrail, /ds-&lt;img/);
    assert.doesNotMatch(escapedTrail, /<img\b|<a[^>]*>ds-/);

    for (const leaf of ['ds-missing', 'ds-unknown']) {
      const missing = await fetch(`${url}/datasets/${leaf}?view=metadata`);
      assert.equal(missing.status, 404);
      assert.match(await missing.text(), /no datapackage\.json|Dataset not found/);
    }
    for (const leaf of ['../outside', 'ds-missing/../../outside']) {
      const denied = await fetch(`${url}/datasets/${encodeURIComponent(leaf)}?view=metadata`);
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

  test(`${mode}: shows overview fields and read-only shared issues without scanning resources`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    const modern = {
      name: 'modern', title: 'Supplied title', description: 'Supplied description',
      keywords: ['task:classification', 'project:example', 'stage:curated'],
      contributors: [{ title: 'Alice', roles: ['creator'] }, { title: 'Bob', roles: ['reviewer'] }],
      resources: [{ name: 'input', title: 'Input', path: 'missing.csv' }],
      sources: [
        { title: 'Web source', path: 'https://example.org/catalogue' },
        { title: 'Local source', path: 'references/source.csv' },
      ],
    };
    const cases = {
      modern: JSON.stringify(modern),
      legacy: JSON.stringify({ name: 'legacy', creator: 'Legacy person', task: 'Legacy task' }),
      malformed: '{invalid JSON',
      unsafe: JSON.stringify({ ...modern, title: '<img src=x onerror=alert(1)>',
        contributors: [{ title: '<script>creator</script>', roles: ['creator'] }],
        resources: [{ name: 'bad<script>', path: [], count: -1 }] }),
      unusual: JSON.stringify({ ...modern, title: 42, created: 'supplied date text\nkept verbatim', contributors: [false, { title: 'Alice', roles: 42 }], resources: [{ path: {} }] }),
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
      const response = await fetch(`${url}/datasets/ds-${name}?view=metadata`);
      assert.equal(response.status, 200, logs());
      pages[name] = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
      assert.match(pages[name], /aria-label="Metadata form"/);
      assert.ok(pages[name].includes('Fields marked * are required.'));
      for (const id of ['name', 'title', 'description', 'tasks', 'projects', 'stage', 'version', 'created', 'extra-keywords']) {
        const start = pages[name].indexOf(`for="metadata-${id}"`);
        assert.ok(start >= 0, `${id} label`);
        const label = pages[name].slice(start, pages[name].indexOf('</label>', start));
        if (['version', 'created', 'extra-keywords'].includes(id)) {
          assert.doesNotMatch(label, />\*<\/span>|\(optional\)/, `${id} stays unmarked`);
        } else {
          assert.match(label, /<span\b[^>]*aria-hidden="true"[^>]*>\*<\/span>/, `${id} has a required marker`);
        }
      }
      assert.match(pages[name], /Metadata validation/);
      assert.match(pages[name], /Shared\s+checks\s+do\s+not\s+read\s+resources\s+or\s+buckets/);
      const overviewAndKeywords = [...pages[name].matchAll(/\bname="(?:name|title|description|version|createdDate|created|metadata-(?:tasks|projects|extra-keywords))"/g)];
      assert.equal(overviewAndKeywords.length, 9);
      assert.doesNotMatch(pages[name], /name="submission"/);
      assert.doesNotMatch(pages[name], /<pre\b|<dl\b|Dataset is valid/);
      assert.equal(pages[name].includes(root), false);
    }
    assert.match(pages.modern, /Metadata checks passed/);
    assert.match(pages.modern, /aria-label="Sources"/);
    assert.match(pages.modern, /Add another source/);
    for (const [name, value] of [
      ['source-0-title', 'Web source'],
      ['source-0-path', 'https://example.org/catalogue'],
      ['source-1-title', 'Local source'],
      ['source-1-path', 'references/source.csv'],
    ]) {
      const control = pages.modern.match(new RegExp(`<input\\b(?=[^>]*name="${name}")[^>]*>`))?.[0];
      assert.ok(control, name);
      assert.ok(control.includes(`value="${value}"`));
      assert.match(control, /\srequired(?:[\s=>])/);
    }
    assert.doesNotMatch(pages.legacy, /Legacy person|Legacy task/);
    assert.match(pages.legacy, /title is required/);
    assert.match(pages.legacy, /keywords must contain exactly one nonempty task: keyword/);
    assert.match(pages.malformed, /datapackage.json is not valid JSON/);
    assert.doesNotMatch(pages.unsafe, /<img src=x|<script>|\[object Object\]/);
    assert.match(pages.unsafe, /resource bad&lt;script(?:>|&gt;) count must be/);
    assert.match(pages.conflicts, /keywords must contain at most one known stage/);
    assert.deepEqual(await snapshot(base), before);
  });

  test(`${mode}: opens rendered README first, flags exact template text and keeps metadata available separately`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    for (const name of ['readme', 'template', 'missing', 'no-metadata', 'unsafe']) {
      await fs.mkdir(join(root, `ds-${name}`), { recursive: true });
    }
    const readme = '# Supplied README\n\n<script>not executable</script>\n\n![Image caption](https://tracker.example/pixel)\n\n[Resource](data/private.csv)\n\n[Public](https://example.org/docs)\n';
    await fs.writeFile(join(root, 'ds-readme/README.md'), readme);
    await fs.writeFile(join(root, 'ds-readme/datapackage.json'), '{broken descriptor marker');
    await fs.writeFile(join(root, 'ds-no-metadata/README.md'), '# README without descriptor');
    await fs.writeFile(join(root, 'ds-missing/datapackage.json'), '{}');
    const template = await fs.readFile(new URL('./fixtures/template-readme-current.md', import.meta.url));
    const templatePath = join(root, 'ds-template/README.md');
    await fs.writeFile(templatePath, template);
    const outside = join(base, 'outside-marker');
    await fs.writeFile(outside, 'outside README marker');
    await fs.symlink(outside, join(root, 'ds-unsafe/README.md'));
    const before = await snapshot(base);
    const { url, logs } = await serve(t, mode, root);
    const response = await fetch(`${url}/datasets/ds-readme`);
    assert.equal(response.status, 200, logs());
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /<h2>Supplied README<\/h2>/);
    assert.doesNotMatch(html, /<script>|<img src="https:\/\/tracker|href="data\/|broken descriptor marker|Metadata validation/);
    assert.match(html, /&lt;script/);
    assert.match(html, /Image caption/);
    const article = html.match(/<article\b[^>]*aria-label="Dataset README"[^>]*>[\s\S]*?<\/article>/);
    assert.ok(article);
    assert.doesNotMatch(article[0], /<script\b|<img\b|<iframe\b|<object\b/);
    const publicLink = article[0].match(/<a\b[^>]*href="https:\/\/example.org\/docs"[^>]*>/);
    assert.ok(publicLink);
    assert.match(publicLink[0], /rel="[^"]*noreferrer/);
    assert.match(publicLink[0], /rel="[^"]*noopener/);
    assert.equal(html.includes(root), false);
    const metadataLink = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>Metadata<\/a>/);
    assert.ok(metadataLink);
    const metadataResponse = await fetch(new URL(metadataLink[1], response.url));
    assert.equal(metadataResponse.status, 200);
    const metadataHtml = (await metadataResponse.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(metadataHtml, /aria-label="Metadata form"/);
    assert.match(metadataHtml, /datapackage.json is not valid JSON/);
    const rawResponse = await fetch(`${url}/datasets/ds-readme?view=datapackage`);
    assert.equal(rawResponse.status, 200);
    assert.match(await rawResponse.text(), /broken descriptor marker/);
    const readmeLink = metadataHtml.match(/<a\b[^>]*href="([^"]+)"[^>]*>README<\/a>/);
    assert.ok(readmeLink);
    assert.match(await (await fetch(new URL(readmeLink[1], metadataResponse.url))).text(), /Supplied README/);
    const flagged = await fetch(`${url}/datasets/ds-template`);
    assert.equal(flagged.status, 200);
    assert.match(await flagged.text(), /Template README/);
    const independent = await fetch(`${url}/datasets/ds-no-metadata`);
    assert.equal(independent.status, 200);
    assert.match(await independent.text(), /README without descriptor/);
    const missing = await fetch(`${url}/datasets/ds-missing`);
    assert.equal(missing.status, 200);
    assert.match(await missing.text(), /This dataset has no README.md/);
    assert.equal((await fetch(`${url}/datasets/ds-missing?view=metadata`)).status, 200);
    const unsafe = await fetch(`${url}/datasets/ds-unsafe`);
    assert.equal(unsafe.status, 200);
    assert.doesNotMatch(await unsafe.text(), /outside README marker/);
    assert.equal((await fetch(`${url}/datasets/ds-unknown`)).status, 404);
    assert.equal((await fetch(`${url}/datasets/ds-readme?view=outside`)).status, 400);
    assert.deepEqual(await snapshot(base), before);
    await fs.appendFile(templatePath, '\n');
    assert.doesNotMatch(await (await fetch(`${url}/datasets/ds-template`)).text(), /Template README/);
    assert.equal(await fs.readFile(outside, 'utf8'), 'outside README marker');
  });

  test(`${mode}: prefills keyword tags and matched-policy stages without writing files`, async (t) => {
    const root = await fixture(t); const directory = join(root, 'ds-keywords');
    await fs.mkdir(directory);
    const path = join(directory, 'datapackage.json');
    const descriptor = { name: 'keywords', title: 'Keywords', description: 'Supplied description',
      keywords: ['task:classification', 'project:South East Asia', 'stage:curated', 'language:Malay', '<script>extra</script>'],
      resources: [{ name: 'input', title: 'Input', path: 'missing.csv' }] };
    await fs.writeFile(path, JSON.stringify(descriptor));
    await fs.writeFile(join(directory, 'dataset.config.json'), '{"stages":{"custom":"Not authoritative"}}');
    const before = await snapshot(root);
    const { url, logs } = await serve(t, mode, root);
    const html = (await (await fetch(`${url}/datasets/ds-keywords?view=metadata`)).text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(html.includes('id="root/keywords"'), logs());
    for (const [id, label] of [['tasks', 'Tasks'], ['projects', 'Projects'], ['extra-keywords', 'Extra keywords']]) {
      assert.ok(html.includes(`for="metadata-${id}"`), `${label} label`);
      assert.match(html, new RegExp(`<input\\b(?=[^>]*id="metadata-${id}")[^>]*>`));
    }
    assert.match(html, /classification/);
    assert.match(html, /South East Asia/);
    assert.match(html, /language:Malay/);
    assert.match(html, /&lt;script(?:>|&gt;)extra/);
    assert.doesNotMatch(html, /<script>extra|Tasks are required\.|Projects are required\.|Stage is required\./);
    const select = html.match(/<select\b(?=[^>]*id="metadata-stage")[^>]*>[\s\S]*?<\/select>/)?.[0];
    assert.ok(select, 'Stage is a native dropdown');
    assert.match(select, /\brequired(?:[\s=>])/);
    assert.deepEqual([...select.matchAll(/<option\b[^>]*value="([^"]*)"/g)].map((match) => match[1]), ['', ...Object.keys(policy.stages)]);
    assert.match(select, /<option\b(?=[^>]*value="curated")(?=[^>]*\bselected)[^>]*>Curated dataset/);
    assert.doesNotMatch(select, /custom|Not authoritative/);
    const extra = html.match(/<input\b(?=[^>]*id="metadata-extra-keywords")[^>]*>/)?.[0];
    assert.ok(extra); assert.doesNotMatch(extra, /\srequired(?:[\s=>])/);
    await fs.writeFile(path, JSON.stringify({ ...descriptor, keywords: ['task:new-task', 'project:New Project', 'stage:unknown'] }));
    const refreshed = await (await fetch(`${url}/datasets/ds-keywords?view=metadata`)).text();
    assert.match(refreshed, /New Project/);
    assert.match(refreshed, /Stage is required\./);
    assert.doesNotMatch(refreshed, /South East Asia/);
    await fs.writeFile(path, JSON.stringify(descriptor));
    assert.deepEqual(await snapshot(root), before);
  });

  test(`${mode}: edits resource rows locally and serves bounded read-only counts for safe dataset paths`, async (t) => {
    const root = await fixture(t); const directory = join(root, 'ds-resources');
    await fs.mkdir(join(directory, 'images.v2/nested'), { recursive: true });
    await fs.writeFile(join(directory, 'items.csv'), 'column\nsecret-one\nsecret-two\n');
    await fs.writeFile(join(directory, 'images.v2/nested/one.bin'), 'directory marker');
    await fs.writeFile(join(directory, 'datapackage.json'), JSON.stringify({ resources: [{ path: 'items.csv', title: 'Supplied resource', count: 999 }] }));
    await fs.writeFile(join(root, 'outside.json'), '["outside private marker"]');
    await fs.symlink(join(root, 'outside.json'), join(directory, 'linked.json'));
    const before = await snapshot(root);
    const { url, logs } = await serve(t, mode, root);
    const html = (await (await fetch(`${url}/datasets/ds-resources?view=metadata`)).text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(html.includes('id="root/resources"'), logs());
    assert.match(html, /aria-label="Resources"/);
    for (const [key, value] of [['name', 'items'], ['path', 'items.csv'], ['title', 'Supplied resource'], ['format', 'csv']]) {
      const control = html.match(new RegExp(`<input\\b(?=[^>]*name="resource-0-${key}")[^>]*>`))?.[0];
      assert.ok(control, key); assert.ok(control.includes(`value="${value}"`));
      if (policy.resource.requiredFields.includes(key as 'name' | 'path' | 'title')) assert.match(control, /\srequired(?:[\s=>])/);
    }
    assert.match(html, /<datalist\b/); assert.ok(html.includes('value="images.v2/"'));
    assert.match(html, /Add another resource/); assert.match(html, /aria-label="Remove resource items"/);
    assert.doesNotMatch(html, /<input\b[^>]*name="resource-0-count"/);
    assert.match(html, /Not counted/);
    const endpoint = `${url}/datasets/ds-resources/resources`;
    const result = await fetch(`${endpoint}?path=items.csv`);
    assert.equal(result.status, 200, logs());
    assert.deepEqual(await result.json(), { status: 'counted', kind: 'file', value: 2, unit: 'rows' });
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const folder = await fetch(`${endpoint}?path=images.v2%2F`);
    assert.deepEqual(await folder.json(), { status: 'counted', kind: 'directory', value: 1, unit: 'files' });
    for (const path of ['../outside.json', 'linked.json', '.env', 'https://example.com/data.csv']) {
      const denied = await fetch(`${endpoint}?${new URLSearchParams({ path })}`);
      assert.equal(denied.status, 400); assert.doesNotMatch(await denied.text(), /outside private marker|secret-one/);
    }
    assert.equal((await fetch(endpoint)).status, 400);
    assert.equal((await fetch(`${endpoint}?path=items.csv&path=items.csv`)).status, 400);
    assert.equal((await fetch(`${endpoint}?path=items.csv`, { headers: { origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { origin: url } })).status, 405);
    assert.deepEqual(await snapshot(root), before);
  });

  test(`${mode}: shows optional SemVer and browser-only Created date controls without changing stored timestamps`, async (t) => {
    const root = await fixture(t); const directory = join(root, 'ds-version-created');
    await fs.mkdir(directory);
    const path = join(directory, 'datapackage.json');
    const descriptor = { name: 'version-created', title: 'Version and Created', description: 'Supplied description',
      version: '1.2.3-rc.1+build.7', created: '2026-01-01T23:45:56.789-03:30' };
    await fs.writeFile(path, JSON.stringify(descriptor));
    const before = await snapshot(root);
    const { url, logs } = await serve(t, mode, root);
    const html = (await (await fetch(`${url}/datasets/ds-version-created?view=metadata`)).text()).replace(/<!--[\s\S]*?-->/g, '');
    const version = html.match(/<input\b(?=[^>]*id="metadata-version")[^>]*>/)?.[0];
    assert.ok(version, logs()); assert.ok(html.includes('for="metadata-version"'));
    assert.match(version, /value="1\.2\.3-rc\.1\+build\.7"/);
    assert.match(version, /aria-invalid="false"/); assert.doesNotMatch(version, /\srequired(?:[\s=>])/);
    const date = html.match(/<input\b(?=[^>]*id="metadata-created")[^>]*>/)?.[0];
    assert.ok(date); assert.ok(html.includes('for="metadata-created"'));
    assert.match(date, /type="date"/); assert.match(date, /\sdisabled(?:[\s=>])/);
    assert.match(date, /value=""/); assert.doesNotMatch(date, /\srequired(?:[\s=>])/);
    const serialized = html.match(/<input\b(?=[^>]*type="hidden")(?=[^>]*name="created")[^>]*>/)?.[0];
    assert.ok(serialized); assert.ok(serialized.includes(`value="${descriptor.created}"`));
    const previewStart = html.indexOf('id="metadata-created-help"');
    assert.ok(previewStart >= 0);
    const preview = html.slice(previewStart, html.indexOf('</p>', previewStart));
    assert.ok(preview.includes(descriptor.created), 'Created shows the exact recorded RFC3339 value');
    assert.doesNotMatch(html, /Date changes use midnight|type="(?:time|datetime-local)"/);
    await fs.writeFile(path, JSON.stringify({ ...descriptor, version: '01.2.3' }));
    const invalid = await (await fetch(`${url}/datasets/ds-version-created?view=metadata`)).text();
    assert.match(invalid, /<input\b(?=[^>]*id="metadata-version")(?=[^>]*aria-invalid="true")[^>]*>/);
    assert.match(invalid, /id="metadata-version-error"/);
    await fs.writeFile(path, JSON.stringify({ ...descriptor, version: 42 }));
    assert.match(await (await fetch(`${url}/datasets/ds-version-created?view=metadata`)).text(),
      /<input\b(?=[^>]*id="metadata-version")(?=[^>]*aria-invalid="true")[^>]*>/);
    await fs.writeFile(path, JSON.stringify(descriptor));
    assert.deepEqual(await snapshot(root), before);
  });

  test(`${mode}: prefills overview from current descriptor values without writing them`, async (t) => {
    const root = await fixture(t); const directory = join(root, 'ds-prefill');
    await fs.mkdir(directory);
    const path = join(directory, 'datapackage.json');
    const descriptor = { name: 'saved-package-name', title: 'Saved title', description: 'First line\nSecond <script> line' };
    await fs.writeFile(path, JSON.stringify(descriptor));
    const before = await snapshot(root);
    const { url, logs } = await serve(t, mode, root);
    const html = (await (await fetch(`${url}/datasets/ds-prefill?view=metadata`)).text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /<input\b(?=[^>]*name="name")(?=[^>]*value="saved-package-name")[^>]*>/, logs());
    assert.match(html, /<input\b(?=[^>]*name="title")(?=[^>]*value="Saved title")[^>]*>/);
    assert.match(html, /<textarea\b[^>]*name="description"[^>]*>First line\nSecond &lt;script(?:>|&gt;) line<\/textarea>/);
    assert.doesNotMatch(html, /Name is required\.|Title is required\.|Description is required\.|<script>/);
    await fs.writeFile(path, JSON.stringify({ ...descriptor, title: 'Updated externally' }));
    const refreshed = await (await fetch(`${url}/datasets/ds-prefill?view=metadata`)).text();
    assert.match(refreshed, /<input\b(?=[^>]*name="title")(?=[^>]*value="Updated externally")[^>]*>/);
    await fs.writeFile(path, JSON.stringify(descriptor));
    assert.deepEqual(await snapshot(root), before);
  });

  test(`${mode}: shows required overview fields with inline empty errors and no write endpoint`, async (t) => {
    const root = await fixture(t); const directory = join(root, 'ds-placeholder');
    await fs.mkdir(directory);
    await fs.writeFile(join(directory, 'datapackage.json'), '{\r\n "unknown":900719925474099312345\r\n}\r\n');
    await fs.writeFile(join(directory, 'README.md'), '# Keep README');
    await fs.writeFile(join(directory, 'input.csv'), 'untouched resource');
    const before = await snapshot(root);
    const { url, logs } = await serve(t, mode, root);
    const response = await fetch(`${url}/datasets/ds-placeholder?view=metadata`);
    assert.equal(response.status, 200, logs());
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /aria-label="Metadata sections"/);
    assert.ok(html.includes('href="#metadata-overview"'));
    assert.ok(html.includes('id="metadata-overview"'));
    for (const [key, label, tag] of [['name', 'Name', 'input'], ['title', 'Title', 'input'], ['description', 'Description', 'textarea']]) {
      const control = [...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)]
        .find(([element]) => element.includes(`name="${key}"`));
      assert.ok(control, `${label} control`);
      assert.ok(control[0].startsWith(`<${tag}`));
      const id = control[0].match(/\bid="([^"]+)"/)?.[1];
      assert.ok(id);
      assert.ok(html.includes(`for="${id}"`), `${label} has an associated label`);
      assert.match(control[0], /\brequired(?:[=\s>])/);
      assert.match(control[0], /aria-invalid="true"/);
      const errorId = control[0].match(/aria-describedby="([^"]+)"/)?.[1];
      assert.ok(errorId, `${label} describes its error`);
      assert.ok(html.includes(`id="${errorId}"`));
      assert.ok(html.includes(`${label} is required.`));
    }
    for (const label of ['Save changes', 'Reset form']) {
      const button = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(([value]) => value.includes(label));
      assert.ok(button, label); assert.match(button[0], /\bdisabled(?:[=\s>])/);
    }
    assert.match(html, /Reload file/);
    assert.equal([...html.matchAll(/<(?:input|textarea)\b/g)].length, 9);
    for (const [id, message] of [['tasks', 'Tasks are required.'], ['projects', 'Projects are required.'], ['stage', 'Stage is required.']]) {
      const control = html.match(new RegExp(`<(?:input|select)\\b(?=[^>]*id="metadata-${id}")[^>]*>`))?.[0];
      assert.ok(control); assert.match(control, /\srequired(?:[\s=>])/);
      assert.match(control, /aria-invalid="true"/);
      assert.ok(control.includes(`metadata-${id}-error`));
      assert.ok(html.includes(`id="metadata-${id}-error"`));
      assert.ok(html.includes(message));
    }
    assert.doesNotMatch(html, /name="submission"|Unsaved changes/);
    for (const query of ['?view=metadata&/save', '?/save']) {
      const post = await fetch(`${url}/datasets/ds-placeholder${query}`, {
        method: 'POST', headers: { origin: url, accept: 'application/json', 'x-sveltekit-action': 'true' },
        body: new URLSearchParams({ submission: '{"fields":[]}' }),
      });
      assert.equal(post.status, 405, 'Metadata saving is not implemented');
    }
    const raw = await fetch(`${url}/datasets/ds-placeholder?view=datapackage`);
    assert.equal(raw.status, 200); assert.match(await raw.text(), /900719925474099312345/);
    assert.deepEqual(await snapshot(root), before, 'GET and refused POST leave all fixture bytes untouched');
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
    assert.match(tableRow(html, 'ds-passed'), /Metadata checks passed/);
    assert.match(tableRow(html, 'ds-issues'), /Metadata issues \(1\)/);
    assert.match(tableRow(html, 'ds-missing'), /Metadata unavailable/);
    assert.match(tableRow(html, 'ds-unsafe'), /Metadata unavailable/);
    assert.match(html, /Resource files and buckets are not read/);
    assert.doesNotMatch(html, /outside marker|Dataset is valid/);
    assert.equal(html.includes(root), false);
    assert.deepEqual(await snapshot(base), before);

    await fs.writeFile(changed, valid);
    const fixed = await snapshot(base);
    const refreshed = await fetch(url);
    assert.equal(refreshed.status, 200, logs());
    assert.match(tableRow((await refreshed.text()).replace(/<!--[\s\S]*?-->/g, ''), 'ds-issues'), /Metadata checks passed/);
    assert.deepEqual(await snapshot(base), fixed);
  });

  test(`${mode}: serves a dashboard table with supplied metadata, stable totals and GET filters`, async (t) => {
    const base = await fixture(t);
    const root = join(base, 'datasets');
    const modern = { name: 'example', title: '<b>Supplied title</b>', description: 'unneeded-list-marker',
      keywords: ['task:classification', 'project:example', 'stage:curated'],
      contributors: [{ title: 'Alice', roles: ['creator'] }],
      resources: [{ name: 'input', title: 'Input', path: 'private-resource-marker.csv' }],
    };
    for (const name of ['modern', 'issues', 'missing']) await fs.mkdir(join(root, `ds-${name}`), { recursive: true });
    await fs.writeFile(join(root, 'ds-modern/datapackage.json'), JSON.stringify(modern));
    await fs.writeFile(join(root, 'ds-issues/datapackage.json'), '{invalid JSON');
    const before = await snapshot(base);
    const { url, logs } = await serve(t, mode, root);
    const response = await fetch(url);
    assert.equal(response.status, 200, logs());
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');
    assert.match(html, /aria-label="Dataset views"/);
    assert.match(html, /<table\b/);
    assert.match(html, /<caption[^>]*>Showing 3 of 3 datasets/);
    for (const heading of ['Dataset', 'Metadata checks', 'Task', 'Project', 'Stage', 'Creators']) {
      assert.match(html, new RegExp(`<th[^>]*>${heading}</th>`));
    }
    assert.match(html, /&lt;b(?:>|&gt;)Supplied title&lt;\/b(?:>|&gt;)/);
    assert.match(html, /Alice/);
    assert.match(html, /<form[^>]*method="GET"[^>]*role="search"/i);
    assert.equal([...html.matchAll(/<main\b/g)].length, 1);
    assert.match(html, /aria-current="page"[^>]*>[\s\S]*?All datasets/);
    assert.match(html, /<form[^>]*data-sveltekit-reload/);
    assert.match(html, /name="q"/);
    assert.match(html, /name="status"/);
    assert.doesNotMatch(html, /<b>|private-resource-marker|unneeded-list-marker/);
    const csp = response.headers.get('content-security-policy') ?? '';
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(csp, /script-src 'self' 'nonce-/);
    if (mode === 'built') assert.doesNotMatch(csp, /unsafe-inline/);
    assert.match(csp, /frame-ancestors 'none'/);
    if (mode === 'built') {
      const css = html.match(/<link[^>]*href="([^"]+\.css)"/);
      assert.ok(css, 'Built page references a local stylesheet');
      const stylesheet = await fetch(new URL(css[1], url));
      assert.equal(stylesheet.status, 200);
      assert.match(stylesheet.headers.get('content-type') ?? '', /text\/css/);
      assert.doesNotMatch(await stylesheet.text(), /https?:\/\/fonts\.(googleapis|gstatic)/);
    }
    for (const [query, expected] of [
      ['?q=ALICE&status=passed', ['ds-modern']],
      ['?q=classification&status=issues', []],
      ['?status=issues', ['ds-issues']],
      ['?q=ds-missing&status=unavailable', ['ds-missing']],
      ['?q=%5B.*%5D&status=all', []],
    ] as const) {
      const filtered = await fetch(url + query);
      assert.equal(filtered.status, 200, logs());
      const body = (await filtered.text()).replace(/<!--[\s\S]*?-->/g, '');
      const links = [...body.matchAll(/data-dataset-link[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
      assert.deepEqual(links, expected);
      assert.match(body, /data-count="total"[^>]*>3</);
      assert.match(body, /data-count="passed"[^>]*>1</);
      assert.match(body, /data-count="issues"[^>]*>1</);
      assert.match(body, /data-count="unavailable"[^>]*>1</);
      if (!expected.length) assert.match(body, /No matching datasets/);
    }
    const escaped = await fetch(url + '?q=%22%3E%3Cimg%20src=x%20onerror=alert(1)%3E');
    assert.equal(escaped.status, 200);
    assert.doesNotMatch(await escaped.text(), /<img\s+src=x/);
    for (const query of ['?status=invalid', `?q=${'a'.repeat(201)}`]) {
      const invalid = await fetch(url + query);
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.text()).includes(root), false);
    }
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
    assert.doesNotMatch(html, /ENOENT|at discoverDatasets|No ds-\* folders found|\sstyle=/);
  });

  test(`${mode}: missing configuration never falls back to the working directory`, async (t) => {
    const { url, logs } = await serve(t, mode);
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.match(await response.text(), /Set DATASET_ROOT to a parent directory/, logs());
  });
}
