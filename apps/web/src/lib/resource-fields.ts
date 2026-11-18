import { validateMetadata } from '@lazydata/validator';
import policy from '@lazydata/validator/policy' with { type: 'json' };

export type ResourceOption = { path: string; kind: 'file' | 'directory' };
export type ResourceFields = { name: string | null; path: string | null; title: string | null; format: string | null };
export type ResourceModel = { rows: ResourceFields[]; options: ResourceOption[]; required: string[]; message: string };
export const MAX_RESOURCE_ROWS = 200;

export function resourceDefaults(path: string, kind: ResourceOption['kind'] = 'file'): { name: string; format: string } {
  const basename = path.replace(/\/$/, '').split('/').at(-1) ?? '';
  const dot = basename.lastIndexOf('.');
  return kind === 'directory' || dot <= 0
    ? { name: basename, format: '' }
    : { name: basename.slice(0, dot), format: basename.slice(dot + 1).toLowerCase() };
}

export function resourceKind(path: string | null, options: ResourceOption[]): ResourceOption['kind'] | undefined {
  return options.find((option) => option.path === path?.replace(/\/$/, ''))?.kind;
}

export function changeResourcePath(fields: ResourceFields, path: string, options: ResourceOption[]): ResourceFields {
  const previous = resourceDefaults(fields.path ?? '', resourceKind(fields.path, options));
  const kind = resourceKind(path, options);
  const next = resourceDefaults(path, kind);
  return { ...fields, path,
    name: fields.name === '' || fields.name === previous.name ? next.name : fields.name,
    format: kind === 'directory' ? '' : fields.format === '' || fields.format === previous.format ? next.format : fields.format,
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resourceFormModel(text: string, options: ResourceOption[]): ResourceModel {
  const model: ResourceModel = { rows: [], options, required: [...policy.resource.requiredFields], message: '' };
  let data: unknown;
  try { data = JSON.parse(text); } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { ...model, message: 'Resources cannot be loaded from invalid JSON.' };
  }
  if (!object(data) || data.resources === undefined) return model;
  if (!Array.isArray(data.resources)) return { ...model, message: 'Resources must be an array; see the raw descriptor.' };
  if (data.resources.length > MAX_RESOURCE_ROWS) return { ...model, message: 'Resource form limit: 200 rows. See the raw descriptor.' };
  model.rows = data.resources.map((entry) => {
    if (!object(entry)) {
      model.message = 'Some supplied resource values are unsupported; see the raw descriptor. Nothing is saved.';
      return { name: null, path: null, title: null, format: null };
    }
    const path = typeof entry.path === 'string' ? entry.path : entry.path === undefined ? '' : null;
    const kind = resourceKind(path, options);
    const defaults = resourceDefaults(path ?? '', kind);
    const supplied = (key: string, fallback: string): string | null => entry[key] === undefined
      ? fallback : typeof entry[key] === 'string' ? entry[key] : null;
    const row = { name: supplied('name', defaults.name), path, title: supplied('title', ''),
      format: kind === 'directory' ? '' : supplied('format', defaults.format) };
    if (Object.values(row).some((value) => value === null)) {
      model.message = 'Some supplied resource values are unsupported (including path arrays); see the raw descriptor. Nothing is saved.';
    }
    return row;
  });
  return model;
}

const packageIssues = new Set(validateMetadata({}, policy));

export function resourceDraftIssues(rows: (ResourceFields & { count?: number })[]): string[] {
  const resources = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== '')));
  return validateMetadata({ resources }, policy).filter((issue) => !packageIssues.has(issue));
}
