export type SourceFields = { title: string | null; path: string | null };
export type SourceModel = { rows: SourceFields[]; message: string };
export const MAX_SOURCE_ROWS = 200;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sourceLocatorIssue(value: string): string | undefined {
  if (!value.trim()) return 'path is required';

  if (/^https?:/i.test(value)) {
    if (!/^https?:\/\//i.test(value)) return 'path must be a fully qualified HTTP(S) URL or a safe relative POSIX path';
    try {
      const url = new URL(value);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname) return undefined;
    } catch (cause) {
      if (!(cause instanceof TypeError)) throw cause;
    }
    return 'path must be a fully qualified HTTP(S) URL or a safe relative POSIX path';
  }

  if (
    value.startsWith('/') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return 'path must be a fully qualified HTTP(S) URL or a safe relative POSIX path';
  }
}

export function sourceFormModel(text: string): SourceModel {
  const model: SourceModel = { rows: [], message: '' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { ...model, message: 'Sources cannot be loaded from invalid JSON.' };
  }

  if (!object(data) || data.sources === undefined) return model;
  if (!Array.isArray(data.sources)) {
    return { ...model, message: 'Sources must be an array; see the raw descriptor.' };
  }
  if (data.sources.length > MAX_SOURCE_ROWS) {
    return { ...model, message: 'Source form limit: 200 rows. See the raw descriptor.' };
  }

  model.rows = data.sources.map((entry) => {
    if (!object(entry)) {
      model.message = 'Some supplied source values are unsupported; see the raw descriptor. Nothing is saved.';
      return { title: null, path: null };
    }

    const field = (key: 'title' | 'path'): string | null =>
      entry[key] === undefined ? '' : typeof entry[key] === 'string' ? entry[key] : null;
    const row = { title: field('title'), path: field('path') };
    if (row.title === null || row.path === null) {
      model.message = 'Some supplied source values are unsupported; see the raw descriptor. Nothing is saved.';
    }
    return row;
  });
  return model;
}

export function sourceDraftIssues(rows: SourceFields[]): string[] {
  const issues: string[] = [];
  for (const [index, row] of rows.entries()) {
    const prefix = rows.length > 1 ? `source ${index + 1} ` : 'source ';
    if (row.title === null) issues.push(`${prefix}title has an unsupported value`);
    else if (!row.title.trim()) issues.push(`${prefix}title is required`);

    if (row.path === null) issues.push(`${prefix}path has an unsupported value`);
    else {
      const issue = sourceLocatorIssue(row.path);
      if (issue) issues.push(`${prefix}${issue}`);
    }
  }
  return issues;
}
