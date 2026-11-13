import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));

test('portable exports work without Node globals or built-in imports', () => {
  const script = fileURLToPath(new URL('./fixtures/portable-validation.mjs', import.meta.url));
  const output = execFileSync(process.execPath, ['--experimental-vm-modules', script], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  assert.deepEqual(JSON.parse(output), {
    errors: [],
    stage: 'master',
    label: 'Master collection',
    buckets: { labelColumn: 'year', rows: [{ year: '001', count: 2 }] },
  });
});

test('an isolated consumer uses its bundled policy and never changes files, including config failures', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'validation-consumer-')));
  const bundle = join(root, 'bundle');
  const dataset = join(root, 'dataset');
  const configPath = join(bundle, 'dataset.config.json');

  const snapshot = () => readdirSync(root, { recursive: true }).sort().map((path) => {
    const file = join(root, path);
    const stat = statSync(file);

    return {
      path,
      mode: stat.mode,
      modified: stat.mtimeMs,
      contents: stat.isFile() ? readFileSync(file) : null,
    };
  });

  const unchanged = (run) => {
    const before = snapshot();

    try {
      return run();
    } finally {
      assert.deepEqual(snapshot(), before, 'validation must not change bundle or dataset files');
    }
  };

  try {
    mkdirSync(bundle);
    mkdirSync(dataset);
    cpSync(join(source, 'dist'), join(bundle, 'dist'), { recursive: true });
    cpSync(join(source, 'package.json'), join(bundle, 'package.json'));
    cpSync(join(source, 'dataset.config.json'), configPath);

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const data = JSON.parse(readFileSync(join(source, 'test/fixtures/datapackage.json'), 'utf8'));

    writeFileSync(join(dataset, 'input.csv'), 'value\nexample\n');
    writeFileSync(join(dataset, 'datapackage.json'), JSON.stringify(data));

    const beforeImport = snapshot();
    const portable = await import(pathToFileURL(join(bundle, 'dist/index.js')).href);
    const local = await import(pathToFileURL(join(bundle, 'dist/repository.js')).href);

    assert.deepEqual(snapshot(), beforeImport, 'imports must not change files');
    assert.deepEqual(unchanged(() => local.validateDataPackage(data, dataset)), []);

    const invalid = { ...data, title: ' ' };

    assert.deepEqual(
      unchanged(() => local.validateDataPackage(invalid, dataset)),
      portable.validateMetadata(invalid, config)
    );

    const missing = {
      ...data,
      resources: [{ name: 'missing', title: 'Missing', path: 'missing.csv' }],
    };

    assert.deepEqual(portable.validateMetadata(missing, config), []);
    assert.match(unchanged(() => local.validateDataPackage(missing, dataset)).join('\n'), /does not exist/);

    const weaker = structuredClone(config);
    weaker.keywords.requiredPrefixes = [];
    writeFileSync(join(dataset, 'dataset.config.json'), JSON.stringify(weaker));

    assert.match(
      unchanged(() => local.validateDataPackage({ ...data, keywords: ['stage:master'] }, dataset)).join('\n'),
      /task:|project:/
    );

    config.buckets.required = true;
    writeFileSync(configPath, JSON.stringify(config));

    assert.match(unchanged(() => local.validateDataPackage(data, dataset)).join('\n'), /buckets.csv is required/);

    writeFileSync(join(dataset, 'buckets.csv'), 'year,count\n001,2\n');
    assert.deepEqual(unchanged(() => local.validateDataPackage(data, dataset)), []);

    const cli = join(bundle, 'dist/cli.js');

    for (const invalidConfig of ['{invalid', JSON.stringify({ ...config, schemaVersion: 2 }), undefined]) {
      if (invalidConfig === undefined) rmSync(configPath);
      else writeFileSync(configPath, invalidConfig);

      unchanged(() => {
        assert.throws(() => local.validateDataPackage(data, dataset), /dataset\.config/);
        assert.throws(
          () => execFileSync(process.execPath, [cli], { cwd: dataset, stdio: 'pipe' }),
          (error) => error.status === 1 && /dataset\.config/.test(error.stderr)
        );
      });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
