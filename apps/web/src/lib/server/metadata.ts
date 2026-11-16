import { validateMetadata } from '@lazydata/validator';
import policy from '@lazydata/validator/policy' with { type: 'json' };

interface MetadataField {
  label: string;
  values: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function displayValue(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  try {
    return JSON.stringify(value);
  } catch (cause) {
    if (!(cause instanceof RangeError)) throw cause;
    return 'Could not summarize this value; see raw descriptor.';
  }
}

function suppliedValues(value: unknown): string[] {
  return value === undefined ? [] : [displayValue(value)];
}

function contributorLabel(value: unknown): string {
  if (!isObject(value) || typeof value.title !== 'string' || !value.title.trim()) {
    return displayValue(value);
  }
  return value.roles === undefined ? value.title : `${value.title} (roles: ${displayValue(value.roles)})`;
}

export function inspectMetadata(text: string): { fields: MetadataField[]; issues: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { fields: [], issues: ['datapackage.json is not valid JSON.'] };
  }

  const issues = validateMetadata(data, policy);
  if (!isObject(data)) return { fields: [], issues };

  const fields: MetadataField[] = [
    ['Name', 'name'], ['Title', 'title'], ['Description', 'description'],
    ['Version', 'version'], ['Created', 'created'], ['Licences', 'licenses'], ['Keywords', 'keywords'],
  ].map(([label, key]) => ({ label, values: suppliedValues(data[key]) }));

  const contributors: unknown[] = Array.isArray(data.contributors) ? data.contributors : [];
  const creators: string[] = [];
  for (const entry of contributors) {
    if (!isObject(entry) || !Array.isArray(entry.roles) || !entry.roles.includes('creator')) continue;
    creators.push(typeof entry.title === 'string' && entry.title.trim() ? entry.title : displayValue(entry));
  }
  fields.push({ label: 'Creators', values: creators });
  fields.push({ label: 'Contributors', values: contributors.length
    ? contributors.map(contributorLabel) : suppliedValues(data.contributors) });

  const keywords: unknown[] = Array.isArray(data.keywords) ? data.keywords : [];
  for (const [label, prefix] of [['Task', 'task:'], ['Project', 'project:'], ['Stage', 'stage:']]) {
    fields.push({ label, values: keywords.filter((keyword): keyword is string =>
      typeof keyword === 'string' && keyword.startsWith(prefix)
    ).map((keyword) => displayValue(keyword.slice(prefix.length))) });
  }
  return { fields, issues };
}
