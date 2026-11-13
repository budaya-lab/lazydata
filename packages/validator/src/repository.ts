import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { validateBuckets } from './buckets-node.js';
import { validateMetadata } from './metadata.js';
import { assertPolicy } from './policy.js';
import type { DatasetPolicy } from './types.js';
import { isObject, isResourcePath } from './values.js';

function readPolicy(): DatasetPolicy {
  let policy: unknown;
  try {
    policy = JSON.parse(readFileSync(new URL('../dataset.config.json', import.meta.url), 'utf8'));
  } catch (cause) {
    throw new Error('Could not read dataset.config.json as JSON', { cause });
  }

  assertPolicy(policy);
  return policy;
}

function outsideRoot(root: string, file: string): boolean {
  const path = relative(root, file);

  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
}

function validateResourcePath(
  path: string,
  root: string,
  errors: string[],
  format: unknown,
): void {
  const file = resolve(root, path);

  if (outsideRoot(root, file)) {
    errors.push(`resource path escapes the repository: ${path}`);
    return;
  }

  try {
    const realFile = realpathSync(file);
    const realRoot = realpathSync(root);

    if (outsideRoot(realRoot, realFile)) {
      errors.push(`resource path resolves outside the repository: ${path}`);
      return;
    }

    const stat = statSync(realFile);

    if (stat.isDirectory()) {
      if (format !== undefined) errors.push(`directory resources must omit format: ${path}`);
    } else if (!stat.isFile() || path.endsWith('/')) {
      errors.push(`resource path must reference a file or directory without a trailing slash on files: ${path}`);
    }
  } catch {
    errors.push(`resource path does not exist: ${path}`);
  }
}

export function validateDataPackage(data: unknown, root = process.cwd()): string[] {
  const policy = readPolicy();
  const errors = validateMetadata(data, policy);

  if (!isObject(data)) return errors;

  const repository = resolve(root);

  if (Array.isArray(data.resources)) {
    for (const resource of data.resources) {
      if (!isObject(resource) || resource.path === undefined) continue;

      const paths: unknown[] = Array.isArray(resource.path) ? resource.path : [resource.path];

      for (const path of paths) {
        if (isResourcePath(path)) {
          validateResourcePath(path, repository, errors, resource.format);
        }
      }
    }
  }

  return [...errors, ...validateBuckets(repository, policy.buckets.required)];
}
