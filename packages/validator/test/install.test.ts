import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const source = fileURLToPath(new URL('../', import.meta.url));

test('semver tarball installs by URL and reinstalls from a frozen lockfile without a compiler', async () => {
  const root = mkdtempSync(join(tmpdir(), 'validator-install-'));
  let server: Server | undefined;

  try {
    let archive = process.env.VALIDATOR_ARCHIVE;
    let version = process.env.VALIDATOR_VERSION;
    assert.equal(Boolean(archive), Boolean(version), 'supply both archive and version, or neither');

    if (!archive) {
      version = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
      const archives = join(root, 'archives');
      mkdirSync(archives);
      await run('pnpm', ['pack', '--pack-destination', archives], { cwd: source });
      const files = readdirSync(archives);
      assert.equal(files.length, 1);
      archive = join(archives, files[0]);
    }

    assert.ok(typeof version === 'string');
    assert.ok(typeof archive === 'string');
    assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    const filename = `lazydata-validator-${version}.tgz`;
    assert.equal(basename(archive), filename);
    const bytes = readFileSync(resolve(archive));
    const requests: (string | undefined)[] = [];
    const host = createServer((request, response) => {
      requests.push(request.url);
      if (request.url !== `/${filename}`) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(bytes);
    });
    server = host;
    await new Promise<void>((done, reject) => {
      host.once('error', reject);
      host.listen(0, '127.0.0.1', () => {
        host.off('error', reject);
        done();
      });
    });

    const address = host.address();
    assert.ok(address !== null && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const url = `${base}/${filename}`;
    const consumer = join(root, 'consumer');
    const store = join(root, 'store');
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    writeFileSync(join(consumer, '.npmrc'), `registry=${base}/registry/\nfetch-retries=0\n`);
    await run('pnpm', ['--config.updateNotifier=false', 'add', '--ignore-scripts', '--save-exact', '--store-dir', store, url], {
      cwd: consumer, timeout: 30_000,
    });

    const installed = join(consumer, 'node_modules', '@lazydata', 'validator');
    const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    assert.equal(manifest.name, '@lazydata/validator');
    assert.equal(manifest.version, version);
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.ok(!existsSync(join(consumer, 'node_modules', 'typescript')));
    assert.ok(!existsSync(join(installed, 'src')));
    assert.ok(existsSync(join(installed, 'dist', 'index.d.ts')));
    const dependency = JSON.parse(readFileSync(join(consumer, 'package.json'), 'utf8')).dependencies;
    assert.equal(dependency['@lazydata/validator'], url);

    const dataset = join(consumer, 'dataset');
    mkdirSync(dataset);
    writeFileSync(join(dataset, 'input.csv'), 'value\nexample\n');
    writeFileSync(join(dataset, 'datapackage.json'), JSON.stringify({
      name: 'ds-example', title: 'Example dataset', description: 'Fictional installation fixture.',
      keywords: ['task:test', 'project:example', 'stage:master'],
      resources: [{ name: 'input', title: 'Example input', path: 'input.csv', format: 'csv' }],
    }));
    writeFileSync(join(consumer, 'consumer.mjs'), `
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      import { validateMetadata, validatePolicy } from '@lazydata/validator';
      import { validateDataPackage } from '@lazydata/validator/repository';
      import policy from '@lazydata/validator/policy' with { type: 'json' };
      const data = JSON.parse(readFileSync('dataset/datapackage.json', 'utf8'));
      assert.deepEqual(validatePolicy(policy), []);
      assert.deepEqual(validateMetadata(data, policy), []);
      assert.deepEqual(validateDataPackage(data, 'dataset'), []);
    `);

    const command = join(consumer, 'node_modules', '.bin', 'lazydata-validate');
    await run(process.execPath, ['consumer.mjs'], { cwd: consumer });
    const first = await run(command, [dataset], { cwd: consumer });
    assert.equal(first.stdout, 'datapackage.json: valid\n');

    const lock = readFileSync(join(consumer, 'pnpm-lock.yaml'), 'utf8');
    const requestCount = requests.length;
    assert.ok(requestCount > 0);
    assert.ok(requests.every((path) => path === `/${filename}`),
      `installation must not contact a registry: ${JSON.stringify(requests)}`);
    rmSync(join(consumer, 'node_modules'), { recursive: true });
    await run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--store-dir', store], {
      cwd: consumer, timeout: 30_000,
    });
    assert.equal(readFileSync(join(consumer, 'pnpm-lock.yaml'), 'utf8'), lock);
    assert.equal(requests.length, requestCount, 'frozen reinstall must use the local store');
    await run(process.execPath, ['consumer.mjs'], { cwd: consumer });
    const result = await run(command, [dataset], { cwd: consumer });
    assert.equal(result.stdout, 'datapackage.json: valid\n');
  } finally {
    const closing = server;
    if (closing?.listening) {
      await new Promise<void>((done, reject) => closing.close((error) => error ? reject(error) : done()));
    }
    rmSync(root, { recursive: true, force: true });
  }
});
