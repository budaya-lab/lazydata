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
  licenseIds?: number[];
};

// Inspect the actual serialized draft, never a second form-derived candidate.
export function draftIssues(text: string, dateError?: string): string[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return ['datapackage.json is not valid JSON.'];
  }
  const issues = validateMetadata(data, policy);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return issues;
  if ('version' in data && data.version !== '' && (typeof data.version !== 'string' || !isSemver(data.version))) {
    issues.push('Use a valid SemVer version, such as 1.0.0.');
  }
  if (dateError) issues.push(dateError);
  issues.push(...sourceDraftIssues(sourceFormModel(text).rows));
  for (const [index, row] of contributorFormModel(text).rows.entries()) {
    for (const issue of Object.values(contributorFieldIssues(row))) issues.push(`Contributor ${index + 1}: ${issue}`);
  }
  return [...new Set(issues)];
}
