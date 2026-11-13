import { assertPolicy } from './policy.js';
import { validateKeywords } from './stages.js';
import { isObject, isResourcePath, isText } from './values.js';

const namePattern = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

function requiredFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  errors: string[],
  prefix = '',
): void {
  for (const field of fields) {
    if (value[field] === undefined) errors.push(`${prefix}${field} is required`);
  }
}

function validTextFields(entry: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => entry[field] === undefined || isText(entry[field]));
}

function validMetadataList(
  value: unknown,
  minItems: number,
  validEntry: (entry: Record<string, unknown>) => boolean,
): boolean {
  return Array.isArray(value) && value.length >= minItems && value.every((entry) =>
    isObject(entry) && Object.keys(entry).length > 0 && validEntry(entry)
  );
}

function validDateTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;

  const [, year, month, day, hour, minute, second, , , offsetHour, offsetMinute] = match;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();

  return Number(month) >= 1 && Number(month) <= 12 &&
    Number(day) >= 1 && Number(day) <= daysInMonth &&
    Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 &&
    (offsetHour === undefined || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59));
}

export function validateMetadata(data: unknown, policy: unknown): string[] {
  assertPolicy(policy);
  if (!isObject(data)) return ['datapackage.json must be a JSON object'];

  const errors: string[] = [];
  requiredFields(data, policy.package.requiredFields, errors);

  if (data.name !== undefined && (typeof data.name !== 'string' || !namePattern.test(data.name))) {
    errors.push('name must be a lowercase package identifier using letters, digits, dots, underscores, or hyphens');
  }

  for (const field of ['title', 'description']) {
    if (data[field] !== undefined && !isText(data[field])) {
      errors.push(`${field} must be nonempty text`);
    }
  }

  errors.push(...validateKeywords(data.keywords, policy));

  if (data.created !== undefined && !validDateTime(data.created)) {
    errors.push('created must be an RFC 3339 date-time when provided');
  }

  if (
    data.contributors !== undefined &&
    !validMetadataList(data.contributors, 1, (contributor) =>
      validTextFields(contributor, ['title', 'path', 'email', 'givenName', 'familyName', 'organization']) &&
      (
        contributor.roles === undefined ||
        (
          Array.isArray(contributor.roles) &&
          contributor.roles.length > 0 &&
          contributor.roles.every(isText)
        )
      )
    )
  ) {
    errors.push(
      'contributors must be a nonempty array of nonempty objects; supplied text fields and roles ' +
      'must be nonblank strings, with roles in a nonempty array'
    );
  }

  if (
    data.licenses !== undefined &&
    !validMetadataList(data.licenses, 1, (license) =>
      validTextFields(license, ['name', 'path', 'title']) &&
      (isText(license.name) || isText(license.path)) &&
      (license.name === undefined || (isText(license.name) && /^[A-Za-z0-9._-]+$/.test(license.name)))
    )
  ) {
    errors.push(
      'licenses must be a nonempty array of objects with a license name or path; ' +
      'names must be identifiers and supplied fields must be nonblank text'
    );
  }

  if (
    data.sources !== undefined &&
    !validMetadataList(data.sources, 0, (source) =>
      validTextFields(source, ['title', 'path', 'email', 'version'])
    )
  ) {
    errors.push(
      'sources must be an array of nonempty objects with nonblank text ' +
      'for supplied title, path, email and version fields'
    );
  }

  if (data.resources === undefined) return errors;

  if (!Array.isArray(data.resources) || data.resources.length === 0) {
    errors.push('resources must contain at least one resource');
    return errors;
  }

  const names = new Set<string>();

  for (const resource of data.resources) {
    if (!isObject(resource)) {
      errors.push('each resource must be an object');
      continue;
    }

    requiredFields(resource, policy.resource.requiredFields, errors, 'resource ');

    if (
      resource.name !== undefined &&
      (typeof resource.name !== 'string' || !namePattern.test(resource.name))
    ) {
      errors.push('each resource needs a valid lowercase name');
    } else if (typeof resource.name === 'string') {
      if (names.has(resource.name)) errors.push(`resource names must be unique: ${resource.name}`);
      names.add(resource.name);
    }

    if (resource.title !== undefined && !isText(resource.title)) {
      errors.push('each resource needs a nonempty title');
    }

    if (
      resource.count !== undefined &&
      (
        typeof resource.count !== 'number' ||
        !Number.isSafeInteger(resource.count) ||
        resource.count < 0
      )
    ) {
      errors.push(`resource ${resource.name ?? '(unnamed)'} count must be a non-negative safe integer`);
    }

    if (
      resource.name === 'buckets' &&
      (resource.path !== 'buckets.csv' || (resource.format !== undefined && resource.format !== 'csv'))
    ) {
      errors.push('the buckets resource must reference root buckets.csv with CSV format');
    }

    if (resource.data !== undefined) {
      errors.push(`resource ${resource.name ?? '(unnamed)'} must reference local file path(s)`);
    }

    if (resource.path === undefined) continue;

    const paths: unknown[] = Array.isArray(resource.path) ? resource.path : [resource.path];

    if (paths.length === 0) {
      errors.push(`resource ${resource.name ?? '(unnamed)'} must include at least one path`);
    }

    if (paths.some((path) => !isResourcePath(path))) {
      errors.push('resource paths must be safe, nonempty relative POSIX paths');
    }
  }

  return errors;
}
