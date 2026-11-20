import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createServer } from 'vite';

type Link = { href: string; onclick?: (event: MouseEvent) => Promise<void> };

// Compile the real page; replace router/component boundaries so its link handlers
// can be exercised without a DOM. This is not an interactive browser test.
test('README navigation refreshes server data while Metadata/JSON switches keep the draft', async (t) => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'steward-navigation-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const app = fileURLToPath(new URL('../', import.meta.url));
  const server = await createServer({
    root: app, configFile: false, publicDir: false, logLevel: 'error',
    cacheDir: directory, server: { middlewareMode: true, watch: null },
    resolve: { alias: { $lib: join(app, 'src/lib') } },
    plugins: [{
      name: 'navigation-test-boundaries', enforce: 'pre',
      resolveId(id) {
        if (['$app/navigation', '$app/state', '$app/paths', 'virtual:navigation'].includes(id)) return '\0navigation';
        if (id === 'virtual:components' || id.includes('/components/ui/button/index.js')
          || id.includes('/components/ui/alert/index.js') || id.endsWith('/components/metadata-form.svelte')
          || id.endsWith('/components/readme-body.svelte')) return '\0components';
      },
      load(id) {
        if (id === '\0navigation') return `
          export const calls = [];
          export const page = { shallow: null };
          export function afterNavigate() {}
          export function beforeNavigate() {}
          export async function goto(url, options) { calls.push({ url, options }); }
          export function resolve(route, params) { return route.replace('[name]', params.name); }
        `;
        if (id === '\0components') return `
          export const buttons = [];
          export function Button(renderer, props) { buttons.push(props); }
          export default function Stub() {}
          export { Stub as Root, Stub as Title, Stub as Description };
        `;
      },
    }, svelte({ configFile: false })],
  });
  t.after(() => server.close());
  const { render } = await server.ssrLoadModule('svelte/server');
  const { default: Page } = await server.ssrLoadModule('/src/routes/datasets/[name]/+page.svelte');
  const { buttons } = await server.ssrLoadModule('virtual:components') as { buttons: Link[] };
  const { calls } = await server.ssrLoadModule('virtual:navigation') as { calls: { url: string; options: Record<string, unknown> }[] };
  const rendered = render(Page, { props: { data: { name: 'ds-example', view: 'metadata',
    metadataText: '{"title":"Saved title"}', revision: 'v1', issues: [], overview: {},
  } } });
  assert.match(rendered.body, /Dataset sections/);

  for (const view of ['readme', 'metadata', 'datapackage']) {
    const href = `/datasets/ds-example${view === 'readme' ? '' : `?view=${view}`}`;
    const link = buttons.find((button) => button.href === href);
    assert.ok(link);
    assert.equal(typeof link.onclick, 'function', `${view} must select the appropriate navigation behavior`);
    let prevented = false;
    const event = { button: 0, preventDefault() { prevented = true; } } as MouseEvent;
    await link.onclick!(event);
    assert.equal(prevented, true);
    assert.deepEqual(calls.pop(), { url: href, options: view === 'readme'
      ? { refreshAll: true, reset: true } : { shallow: true, reset: true } });
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      prevented = false;
      await link.onclick!({ ...event, ...modifier });
      assert.equal(prevented, false, 'modified clicks keep native link behavior');
      assert.equal(calls.length, 0);
    }
  }
});
