import { validateMetadata } from '@lazydata/validator';
import policy from '@lazydata/validator/policy' with { type: 'json' };

export const stageOptions = Object.entries(policy.stages).map(([value, label]) => ({ value, label }));

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

export function inspectMetadata(text: string): {
  fields: MetadataField[];
  issues: string[];
  overview: { name: string; title: string; description: string };
  keywordFields: { tasks: string[]; projects: string[]; stage: string; extraKeywords: string[] };
} {
  const emptyOverview = { name: '', title: '', description: '' };
  const keywordFields: ReturnType<typeof inspectMetadata>['keywordFields'] = {
    tasks: [], projects: [], stage: '', extraKeywords: [],
  };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    return { fields: [], issues: ['datapackage.json is not valid JSON.'], overview: emptyOverview, keywordFields };
  }

  const issues = validateMetadata(data, policy);
  if (!isObject(data)) return { fields: [], issues, overview: emptyOverview, keywordFields };

  const overview = {
    name: typeof data.name === 'string' ? data.name : '',
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
  };
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

  const keywords: string[] = Array.isArray(data.keywords)
    ? data.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : [];
  const prefixedValues = (prefix: string) => keywords.filter((keyword) => keyword.startsWith(prefix))
    .map((keyword) => keyword.slice(prefix.length));
  keywordFields.tasks = prefixedValues('task:');
  keywordFields.projects = prefixedValues('project:');
  const stages = prefixedValues('stage:');
  keywordFields.stage = stages.length === 1 && Object.hasOwn(policy.stages, stages[0]) ? stages[0] : '';
  keywordFields.extraKeywords = keywords.filter((keyword) =>
    !['task:', 'project:', 'stage:'].some((prefix) => keyword.startsWith(prefix)));
  for (const [label, values] of [['Task', keywordFields.tasks], ['Project', keywordFields.projects], ['Stage', stages]] as const) {
    fields.push({ label, values: values.map(displayValue) });
  }
  return { fields, issues, overview, keywordFields };
}
