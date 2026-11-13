import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));

test('packed API, types, policy and CLI work without workspace sources or runtime dependencies', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'validator-artifact-')));
  const archives = join(root, 'archives');
  const installed = join(root, 'node_modules', '@lazydata', 'validator');
  const dataset = join(root, 'dataset');

  try {
    mkdirSync(archives);
    mkdirSync(installed, { recursive: true });
    mkdirSync(dataset);
    execFileSync('pnpm', ['pack', '--pack-destination', archives], { cwd: source, stdio: 'pipe' });

    const [archive] = readdirSync(archives);
    assert.ok(archive?.endsWith('.tgz'));
    execFileSync('tar', ['-xzf', join(archives, archive), '-C', installed, '--strip-components=1']);

    const data = readFileSync(new URL('./fixtures/datapackage.json', import.meta.url), 'utf8');
    writeFileSync(join(dataset, 'datapackage.json'), data);
    writeFileSync(join(dataset, 'input.csv'), 'value\nexample\n');
    writeFileSync(join(root, 'consumer.mjs'), `
      import { readFileSync } from 'node:fs';
      import { validateMetadata, validatePolicy, getStage, stageLabel, parseBuckets } from '@lazydata/validator';
      import { validateDataPackage } from '@lazydata/validator/repository';
      import policy from '@lazydata/validator/policy' with { type: 'json' };

      const data = JSON.parse(readFileSync('dataset/datapackage.json', 'utf8'));
      console.log(JSON.stringify({
        policy: validatePolicy(policy),
        metadata: validateMetadata(data, policy),
        repository: validateDataPackage(data, 'dataset'),
        stage: getStage(data.keywords, policy),
        label: stageLabel(data.keywords, policy),
        buckets: parseBuckets('year,count\\n001,2\\n'),
      }));
    `);

    const output = execFileSync(process.execPath, ['consumer.mjs'], { cwd: root, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), {
      policy: [],
      metadata: [],
      repository: [],
      stage: 'master',
      label: 'Master collection',
      buckets: { labelColumn: 'year', rows: [{ year: '001', count: 2 }] },
    });

    writeFileSync(join(root, 'consumer.mts'), `
      import { validateMetadata, parseBuckets } from '@lazydata/validator';
      import type { DatasetPolicy, Buckets } from '@lazydata/validator';
      import { validateDataPackage } from '@lazydata/validator/repository';
      import policy from '@lazydata/validator/policy' with { type: 'json' };

      const errors: string[] = validateMetadata({ name: 'example' }, policy);
      const local: string[] = validateDataPackage(null, '.');
      const buckets: Buckets = parseBuckets('year,count\\n001,2');
      const version: DatasetPolicy['schemaVersion'] = 1;
      void [errors, local, buckets, version];
    `);
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        lib: ['ES2022', 'DOM'],
        types: [],
        strict: true,
        noEmit: true,
        resolveJsonModule: true,
        verbatimModuleSyntax: true,
      },
      files: ['consumer.mts'],
    }));
    execFileSync('pnpm', ['exec', 'tsc', '-p', join(root, 'tsconfig.json')], { cwd: source, stdio: 'pipe' });

    const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    const command = join(root, 'lazydata-validate');
    symlinkSync(join(installed, manifest.bin['lazydata-validate']), command);

    assert.equal(execFileSync(command, [dataset], { cwd: root, encoding: 'utf8' }), 'datapackage.json: valid\n');

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
