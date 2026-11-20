import { validateMetadata } from '@penjaga/validator';
import policy from '@penjaga/validator/policy' with { type: 'json' };

export const CONTRIBUTOR_ROLE_PRESETS = [
  'creator', 'author', 'contributor', 'maintainer', 'publisher', 'editor', 'reviewer',
] as const;
export const MAX_CONTRIBUTOR_ROWS = 200;
export type ContributorFields = { title: string | null; roles: string[] | null };
export type ContributorModel = { rows: ContributorFields[]; message: string };

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function contributorFormModel(text: string): ContributorModel {
  const model: ContributorModel = { rows: [], message: '' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { ...model, message: 'Contributors cannot be loaded from invalid JSON.' };
  }

  if (!object(data) || data.contributors === undefined) return model;
  if (!Array.isArray(data.contributors)) {
    return { ...model, message: 'Contributors must be an array; see the raw descriptor.' };
  }
  if (data.contributors.length > MAX_CONTRIBUTOR_ROWS) {
    return { ...model, message: 'Contributor form limit: 200 rows. See the raw descriptor.' };
  }

  model.rows = data.contributors.map((entry) => {
    let row: ContributorFields = { title: null, roles: null };
    if (object(entry)) {
      row = {
        title: entry.title === undefined ? '' : typeof entry.title === 'string' ? entry.title : null,
        roles: entry.roles === undefined ? [] :
          Array.isArray(entry.roles) && entry.roles.every((role) => typeof role === 'string') ? [...entry.roles] : null,
      };
    }
    if (row.title === null || row.roles === null) {
      model.message = 'Some supplied contributor values are unsupported; see the raw descriptor. Nothing is saved.';
    }
    return row;
  });
  return model;
}

const packageIssues = new Set(validateMetadata({}, policy));

export function contributorFieldIssues(row: ContributorFields): { title?: string; roles?: string } {
  const issues: { title?: string; roles?: string } = {};
  if (row.title === null) issues.title = 'Name has an unsupported value.';
  else if (!row.title.trim()) issues.title = 'Name is required.';

  if (row.roles === null) issues.roles = 'Roles have an unsupported value.';
  else if (row.roles.length) {
    const errors = validateMetadata({ contributors: [{ roles: row.roles }] }, policy)
      .filter((issue) => !packageIssues.has(issue));
    if (errors.length) issues.roles = 'Each role must be nonblank text.';
  }
  return issues;
}
