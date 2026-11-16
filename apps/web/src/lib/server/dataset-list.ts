import { readDescriptor, DescriptorError } from './descriptor.ts';
import { discoverDatasets } from './discovery.ts';
import { inspectMetadata } from './metadata.ts';

type DatasetStatus =
  | { name: string; status: 'passed' | 'issues'; issueCount: number }
  | { name: string; status: 'unavailable'; message: string };

export async function listDatasets(root: string | undefined): Promise<DatasetStatus[]> {
  const names = await discoverDatasets(root);
  const datasets: DatasetStatus[] = [];
  for (const name of names) {
    try {
      const text = await readDescriptor(root, name);
      const issueCount = inspectMetadata(text).issues.length;
      datasets.push({ name, status: issueCount ? 'issues' : 'passed', issueCount });
    } catch (cause) {
      if (!(cause instanceof DescriptorError)) throw cause;
      datasets.push({ name, status: 'unavailable', message: cause.message });
    }
  }
  return datasets;
}
