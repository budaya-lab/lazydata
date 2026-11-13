import type { DatasetPolicy, PackageField, ResourceField } from './types.js';
import { isObject, isText } from './values.js';

const supportedPackageFields: readonly PackageField[] = [
  'name', 'title', 'description', 'keywords', 'resources',
  'created', 'contributors', 'licenses', 'sources',
];
const supportedResourceFields: readonly ResourceField[] = ['name', 'title', 'path', 'count'];
const prefixName = /^[a-z][a-z0-9-]*$/;

function hasKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isObject(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function validList(
  value: unknown,
  validItem: (item: unknown) => boolean,
): value is unknown[] {
  return Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every(validItem);
}

function validRequiredFields(
  section: unknown,
  allowed: readonly string[],
  minimum: readonly string[],
): boolean {
  if (!hasKeys(section, ['requiredFields'])) return false;

  const fields = section.requiredFields;

  return validList(fields, (field) => typeof field === 'string' && allowed.includes(field)) &&
    minimum.every((field) => fields.includes(field));
}

export function validatePolicy(policy: unknown): string[] {
  if (!hasKeys(policy, ['schemaVersion', 'stages', 'package', 'resource', 'keywords', 'buckets'])) {
    return ['dataset.config.json needs exactly schemaVersion, stages, package, resource, keywords and buckets'];
  }

  const errors: string[] = [];

  if (policy.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }

  if (
    !isObject(policy.stages) ||
    Object.keys(policy.stages).length === 0 ||
    Object.entries(policy.stages).some(([name, label]) => !prefixName.test(name) || !isText(label))
  ) {
    errors.push('stages must contain valid lowercase names and nonblank labels');
  }

  if (!validRequiredFields(policy.package, supportedPackageFields, ['name', 'resources'])) {
    errors.push('package.requiredFields must contain unique supported fields, including name and resources');
  }

  if (!validRequiredFields(policy.resource, supportedResourceFields, ['name', 'path'])) {
    errors.push('resource.requiredFields must contain unique supported fields, including name and path');
  }

  if (
    !hasKeys(policy.keywords, ['requiredPrefixes', 'allowOtherKeywords']) ||
    !validList(policy.keywords.requiredPrefixes, (prefix) => isText(prefix) && prefixName.test(prefix)) ||
    typeof policy.keywords.allowOtherKeywords !== 'boolean'
  ) {
    errors.push('keywords needs unique valid requiredPrefixes and a boolean allowOtherKeywords');
  }

  if (
    isObject(policy.keywords) &&
    Array.isArray(policy.keywords.requiredPrefixes) &&
    policy.keywords.requiredPrefixes.length > 0 &&
    isObject(policy.package) &&
    Array.isArray(policy.package.requiredFields) &&
    !policy.package.requiredFields.includes('keywords')
  ) {
    errors.push('package.requiredFields must include keywords when prefixes are required');
  }

  if (!hasKeys(policy.buckets, ['required']) || typeof policy.buckets.required !== 'boolean') {
    errors.push('buckets needs a boolean required field');
  }

  return errors;
}

export function assertPolicy(policy: unknown): asserts policy is DatasetPolicy {
  const errors = validatePolicy(policy);

  if (errors.length) {
    throw new Error(`Invalid dataset.config.json: ${errors.join('; ')}`);
  }
}
