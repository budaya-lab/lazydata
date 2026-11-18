import { readDescriptor, DescriptorError } from './descriptor.ts';
import { discoverDatasets } from './discovery.ts';
import { inspectMetadata } from './metadata.ts';

export type DatasetStatus = {
  name: string;
  summary: ReturnType<typeof inspectMetadata>['fields'] | null;
} & (
  | { status: 'passed' | 'issues'; issueCount: number }
  | { status: 'unavailable'; message: string }
);

export class DatasetFilterError extends Error {}

export function validateDatasetFilters(query: string, status: string): void {
  if (!['all', 'passed', 'issues', 'unavailable'].includes(status)) {
    throw new DatasetFilterError('Choose a known metadata status.');
  }
  if (query.length > 200) {
    throw new DatasetFilterError('Search must be 200 characters or fewer.');
  }
}

export function datasetView(datasets: readonly DatasetStatus[], query: string, status: string) {
  validateDatasetFilters(query, status);
  const counts = { total: datasets.length, passed: 0, issues: 0, unavailable: 0 };
  for (const dataset of datasets) counts[dataset.status]++;
  const search = query.trim().toLowerCase();
  const filtered = datasets.filter((dataset) => {
    const values = [dataset.name, ...(dataset.summary?.flatMap(({ values }) => values) ?? [])];
    return (status === 'all' || dataset.status === status)
      && values.some((value) => value.toLowerCase().includes(search));
  });
  return { datasets: filtered, counts, query: query.trim(), status };
}

export async function listDatasets(root: string | undefined): Promise<DatasetStatus[]> {
  const names = await discoverDatasets(root);
  const datasets: DatasetStatus[] = [];
  for (const name of names) {
    try {
      const text = await readDescriptor(root, name);
      const metadata = inspectMetadata(text);
      const issueCount = metadata.issues.length;
      const summary = metadata.fields.length ? metadata.fields.filter(({ label }) =>
        ['Title', 'Creators', 'Task', 'Project', 'Stage'].includes(label)
      ) : null;
      datasets.push({ name, status: issueCount ? 'issues' : 'passed', issueCount, summary });
    } catch (cause) {
      if (!(cause instanceof DescriptorError)) throw cause;
      datasets.push({ name, status: 'unavailable', message: cause.message, summary: null });
    }
  }
  return datasets;
}
