import { readFileSync } from 'node:fs';
import { createContext, SourceTextModule } from 'node:vm';

const context = createContext({ TextEncoder, TextDecoder });
const modules = new Map<string, SourceTextModule>();

function load(url: URL): SourceTextModule {
  const cached = modules.get(url.href);
  if (cached) return cached;

  const module = new SourceTextModule(readFileSync(url, 'utf8'), {
    context,
    identifier: url.href,
  });
  modules.set(url.href, module);
  return module;
}

const entry = load(new URL('../../dist/index.js', import.meta.url));

await entry.link((specifier, parent) => {
  if (!specifier.startsWith('.')) throw new Error(`Nonportable import: ${specifier}`);

  return load(new URL(specifier, parent.identifier));
});
await entry.evaluate();

const policy = JSON.parse(readFileSync(new URL('../../dataset.config.json', import.meta.url), 'utf8'));
const data = JSON.parse(readFileSync(new URL('./datapackage.json', import.meta.url), 'utf8'));
const api = entry.namespace as typeof import('@penjaga/validator');

process.stdout.write(JSON.stringify({
  errors: api.validateMetadata(data, policy),
  stage: api.getStage(data.keywords, policy),
  label: api.stageLabel(data.keywords, policy),
  buckets: api.parseBuckets('year,count\n001,2\n'),
}));
