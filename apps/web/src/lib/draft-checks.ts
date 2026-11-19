import { validateMetadata } from '@lazydata/validator';
import policy from '@lazydata/validator/policy' with { type: 'json' };
import { contributorFieldIssues, contributorFormModel, type ContributorFields } from './contributor-fields.ts';
import { isSemver } from './overview-values.ts';
import type { ResourceFields } from './resource-fields.ts';
import { sourceDraftIssues, sourceFormModel, type SourceFields } from './source-fields.ts';

export type OverviewEdits = Partial<{
  name: string; title: string; description: string;
  version: string | null; created: string | null; createdError: string;
}>;
export type KeywordEdits = Partial<{
  tasks: string[]; projects: string[]; stage: string; extraKeywords: string[];
}>;
export type DraftRow<T> = { id: number; fields: T };
export type DraftChanges = {
  overview?: OverviewEdits;
  keywords?: KeywordEdits;
  resources?: DraftRow<ResourceFields>[];
  sources?: DraftRow<SourceFields>[];
  contributors?: DraftRow<ContributorFields>[];
  licenses?: string[];
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A validation-only overlay, not a serializer or a persistence contract.
function replaceRows<T extends ResourceFields | SourceFields | ContributorFields>(
  data: Record<string, unknown>,
  key: 'resources' | 'sources' | 'contributors',
  rows: DraftRow<T>[] | undefined,
  limitations: string[],
) {
  if (rows === undefined) return;
  const supplied = data[key];
  if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length > 200)) {
    limitations.push(`${key}: cannot fully check edits against an unsupported or over-limit saved array.`);
    return;
  }
  const original: unknown[] = Array.isArray(supplied) ? supplied : [];
  const next = rows.map(({ id, fields }) => {
    const previous = original[id];
    if (previous !== undefined && !object(previous) && Object.values(fields).every((value) => value === null)) {
      return previous;
    }
    const entry: Record<string, unknown> = object(previous) ? { ...previous } : {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === null && Object.hasOwn(entry, key)) continue;
      if (value === '' || (Array.isArray(value) && value.length === 0)) delete entry[key];
      else entry[key] = value;
    }
    return entry;
  });
  if (next.length === 0 && key !== 'resources') delete data[key];
  else data[key] = next;
}

function replaceLicenses(data: Record<string, unknown>, names: string[] | undefined, limitations: string[]) {
  if (names === undefined) return;
  const supplied = data.licenses;
  if (supplied !== undefined && (!Array.isArray(supplied) || supplied.length > 200)) {
    limitations.push('licenses: cannot fully check edits against an unsupported or over-limit saved array.');
    return;
  }
  const remaining: unknown[] = Array.isArray(supplied) ? [...supplied] : [];
  const licenses: unknown[] = names.map((name) => {
    const index = remaining.findIndex((entry) => object(entry) && entry.name === name);
    return index < 0 ? { name } : remaining.splice(index, 1)[0];
  });
  // Name-only controls cannot remove or repair entries they do not expose.
  licenses.push(...remaining.filter((entry) => !object(entry) || typeof entry.name !== 'string'));
  if (licenses.length) data.licenses = licenses;
  else delete data.licenses;
}

export function draftIssues(text: string, changes: DraftChanges): string[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return ['datapackage.json is not valid JSON.'];
  }
  if (!object(data)) return validateMetadata(data, policy);

  for (const [key, value] of Object.entries(changes.overview ?? {})) {
    if (key === 'createdError') continue;
    if (value === '' && (key === 'version' || key === 'created')) delete data[key];
    else data[key] = value;
  }
  if (changes.keywords && (data.keywords === undefined || Array.isArray(data.keywords))) {
    let keywords: unknown[] = Array.isArray(data.keywords) ? [...data.keywords] : [];
    for (const [key, values] of Object.entries(changes.keywords)) {
      const prefix = { tasks: 'task:', projects: 'project:', stage: 'stage:' }[key];
      keywords = keywords.filter((keyword) => typeof keyword !== 'string' || (prefix
        ? !keyword.startsWith(prefix)
        : ['task:', 'project:', 'stage:'].some((known) => keyword.startsWith(known))));
      if (key === 'stage') {
        if (values) keywords.push(`stage:${values}`);
      } else if (Array.isArray(values)) {
        keywords.push(...values.map((value) => `${prefix ?? ''}${value}`));
      }
    }
    data.keywords = keywords;
  }
  const limitations: string[] = [];
  replaceRows(data, 'resources', changes.resources, limitations);
  replaceRows(data, 'sources', changes.sources, limitations);
  replaceRows(data, 'contributors', changes.contributors, limitations);
  replaceLicenses(data, changes.licenses, limitations);

  const issues = [...validateMetadata(data, policy), ...limitations];
  if (data.version !== undefined && data.version !== '' && (typeof data.version !== 'string' || !isSemver(data.version))) {
    issues.push('Use a valid SemVer version, such as 1.0.0.');
  }
  if (changes.overview?.createdError) issues.push(changes.overview.createdError);
  for (const [index, row] of (changes.resources ?? []).entries()) {
    for (const [key, value] of Object.entries(row.fields)) {
      if (value === null) issues.push(`Resource ${index + 1}: ${key} has an unsupported supplied value.`);
    }
  }
  const sources = changes.sources?.map((row) => row.fields) ?? sourceFormModel(text).rows;
  issues.push(...sourceDraftIssues(sources));
  const contributors = changes.contributors?.map((row) => row.fields) ?? contributorFormModel(text).rows;
  for (const [index, row] of contributors.entries()) {
    for (const issue of Object.values(contributorFieldIssues(row))) issues.push(`Contributor ${index + 1}: ${issue}`);
  }
  return [...new Set(issues)];
}
