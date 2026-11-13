import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const data = JSON.parse(readFileSync(new URL('./fixtures/datapackage.json', import.meta.url), 'utf8'));

function run(args, cwd) {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
}

test('CLI accepts an explicit dataset root without running dataset-local scripts', () => {
  const root = mkdtempSync(join(tmpdir(), 'validator-cli-'));

  try {
    writeFileSync(join(root, 'datapackage.json'), JSON.stringify(data));
    writeFileSync(join(root, 'input.csv'), 'value\nexample\n');
    writeFileSync(join(root, 'validate-datapackage.mjs'),
      'import { writeFileSync } from "node:fs"; writeFileSync("executed.txt", "unexpected");');

    assert.equal(run([root]), 'datapackage.json: valid\n');
    assert.equal(existsSync(join(root, 'executed.txt')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI shows help and rejects unsupported options or extra dataset roots', () => {
  assert.match(run(['--help']), /Usage: lazydata-validate/);
  assert.match(run(['-h']), /Usage: lazydata-validate/);

  for (const args of [['--unknown'], ['first', 'second']]) {
    assert.throws(() => run(args), (error) => error.status === 1);
  }
});

test('CLI does not disclose local paths or malformed descriptor contents in read errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'validator-private-'));

  try {
    for (const malformed of [undefined, 'private-example-not-json']) {
      if (malformed !== undefined) writeFileSync(join(root, 'datapackage.json'), malformed);

      assert.throws(() => run([root]), (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /datapackage\.json/);
        assert.ok(!error.stderr.includes(root));
        assert.doesNotMatch(error.stderr, /private-example-not-json/);
        return true;
      });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
