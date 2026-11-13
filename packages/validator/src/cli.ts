#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { validateDataPackage } from './repository.js';

const usage = 'Usage: lazydata-validate [dataset-root]';

function readDescriptor(root: string): unknown {
  try {
    return JSON.parse(readFileSync(join(root, 'datapackage.json'), 'utf8'));
  } catch (cause) {
    throw new Error('Could not read datapackage.json as JSON', { cause });
  }
}

try {
  const { positionals, values } = parseArgs({
    options: { help: { type: 'boolean', short: 'h' } },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(usage);
  } else {
    if (positionals.length > 1) throw new Error(usage);

    const root = resolve(positionals[0] ?? process.cwd());
    const data = readDescriptor(root);
    const errors = validateDataPackage(data, root);

    if (errors.length) {
      console.error(errors.map((error) => `datapackage.json: ${error}`).join('\n'));
      process.exitCode = 1;
    } else {
      console.log('datapackage.json: valid');
    }
  }
} catch (error) {
  console.error(`datapackage.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
