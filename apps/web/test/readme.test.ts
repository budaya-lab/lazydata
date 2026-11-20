import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { renderReadme, readReadme } from '../src/lib/server/readme.ts';
import type { ReadmeNode } from '../src/lib/readme.ts';
import { DatasetNotFoundError, MAX_DATASET_TEXT_BYTES } from '../src/lib/server/dataset-text.ts';

function flattened(nodes: ReadmeNode[]): ReadmeNode[] {
  return nodes.flatMap((node) => node.tag === 'text' ? [node] : [node, ...flattened(node.children)]);
}

async function fixture(t: TestContext) {
  const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'steward-readme-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ds-example');
  await fs.mkdir(directory);
  return { root, directory, path: join(directory, 'README.md') };
}

test('flags only exact reviewed template bytes, including a historical template', async () => {
  for (const suffix of ['current', 'v0.1.0']) {
    const text = await fs.readFile(new URL(`./fixtures/template-readme-${suffix}.md`, import.meta.url), 'utf8');
    assert.equal(renderReadme(text).template, true);
    for (const changed of [text + '\n', text.replace(/\n/g, '\r\n'), '\uFEFF' + text, text.replace('# ', '# Dataset: ')]) {
      assert.equal(renderReadme(changed).template, false);
    }
  }
  assert.equal(renderReadme('# My dataset\n\nReplace this README with dataset notes.').template, false);
});

test('disables embedded HTML, automatic image loads and executable Markdown while preserving readable content', () => {
  const nodes = flattened(renderReadme(`# Dataset\n\n<script>alert(1)</script>\n\n<img src="https://tracker.example/pixel" onerror="alert(1)">\n\n![Image caption](https://tracker.example/pixel)\n\n\`\`\`mermaid\nflowchart LR\nA --> B\n\`\`\``).nodes);
  assert.ok(nodes.every(({ tag }) => !['script', 'img', 'iframe', 'object'].includes(tag)));
  const text = nodes.flatMap((node) => node.tag === 'text' ? [node.text] : []).join(' ');
  assert.match(text, /<script>/);
  assert.match(text, /Image caption/);
  assert.ok(nodes.some(({ tag }) => tag === 'h2'));
  assert.ok(nodes.some(({ tag }) => tag === 'pre'));
});

test('allows only credential-free HTTPS navigation and does not map local resource links', () => {
  const nodes = flattened(renderReadme('[Public](https://example.org/docs) [Local](data/input.csv) [Outside](../other/README.md) [HTTP](http://example.org) [Credentials](https://user:password@example.org) [Code](javascript:alert%281%29) [Data](data:text/html,test)').nodes);
  const hrefs = nodes.flatMap((node) => node.tag !== 'text' && node.href ? [node.href] : []);
  assert.deepEqual(hrefs, ['https://example.org/docs']);
  const text = nodes.flatMap((node) => node.tag === 'text' ? [node.text] : []).join(' ');
  for (const label of ['Local', 'Outside', 'HTTP', 'Credentials']) assert.ok(text.includes(label));
  assert.doesNotMatch(JSON.stringify(nodes), /password@/);
});

test('reads README independently of metadata and leaves its original bytes unchanged', async (t) => {
  const { root, path } = await fixture(t);
  const text = '# Supplied README\r\n\r\nDataset notes.\r\n';
  await fs.writeFile(path, text);
  const result = await readReadme(root, 'ds-example');
  assert.equal(result.status, 'available');
  if (result.status === 'available') assert.match(JSON.stringify(result.nodes), /Supplied README/);
  assert.equal(await fs.readFile(path, 'utf8'), text);
});

test('reports missing README without hiding an admitted dataset or creating files', async (t) => {
  const { root, directory } = await fixture(t);
  assert.deepEqual(await readReadme(root, 'ds-example'), { status: 'unavailable', message: 'This dataset has no README.md.' });
  assert.deepEqual(await fs.readdir(directory), []);
  await assert.rejects(readReadme(root, 'ds-unknown'), DatasetNotFoundError);
  await assert.rejects(readReadme(root, '../outside'), DatasetNotFoundError);
});

test('rejects README symlinks, hard links, directories, invalid UTF-8 and oversize without reading their contents', async (t) => {
  const { root, path } = await fixture(t);
  const marker = join(root, 'outside-marker');
  await fs.writeFile(marker, 'outside marker');
  await fs.symlink(marker, path);
  assert.equal((await readReadme(root, 'ds-example')).status, 'unavailable');
  await fs.unlink(path);
  await fs.link(marker, path);
  assert.equal((await readReadme(root, 'ds-example')).status, 'unavailable');
  await fs.unlink(path);
  await fs.mkdir(path);
  assert.equal((await readReadme(root, 'ds-example')).status, 'unavailable');
  await fs.rmdir(path);
  await fs.writeFile(path, Buffer.from([0xff]));
  assert.equal((await readReadme(root, 'ds-example')).status, 'unavailable');
  await fs.writeFile(path, Buffer.alloc(MAX_DATASET_TEXT_BYTES + 1, 32));
  const oversized = await readReadme(root, 'ds-example');
  assert.equal(oversized.status, 'unavailable');
  assert.match(JSON.stringify(oversized), /5 MiB/);
  assert.equal(JSON.stringify(oversized).includes(root), false);
  assert.equal(await fs.readFile(marker, 'utf8'), 'outside marker');
  assert.equal((await fs.stat(path)).size, MAX_DATASET_TEXT_BYTES + 1);
});

test('preserves file identity and actual read bounds for README races', async (t) => {
  const { root, path } = await fixture(t);
  await fs.writeFile(path, 'Original');
  const open = fs.open.bind(fs);
  const swap = t.mock.method(fs, 'open', async (value: Parameters<typeof fs.open>[0], flags: Parameters<typeof fs.open>[1]) => {
    await fs.rename(path, path + '.previous');
    await fs.writeFile(path, 'Replacement');
    return open(value, flags);
  });
  const changed = await readReadme(root, 'ds-example');
  assert.match(JSON.stringify(changed), /changed while opening/);
  swap.mock.restore();
  const file = await fs.open(path, 'r');
  const before = await file.stat({ bigint: true });
  t.mock.method(fs, 'open', async () => file);
  t.mock.method(file, 'stat', async () => {
    await fs.appendFile(path, Buffer.alloc(MAX_DATASET_TEXT_BYTES + 1, 32));
    return before;
  });
  assert.match(JSON.stringify(await readReadme(root, 'ds-example')), /5 MiB/);
});
