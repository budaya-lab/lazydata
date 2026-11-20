import { readDatasetText } from './dataset-text.ts';

export { DatasetTextError as DescriptorError, MAX_DATASET_TEXT_BYTES as MAX_DESCRIPTOR_BYTES } from './dataset-text.ts';

export function readDescriptor(root: string | undefined, name: string): Promise<string> {
  return readDatasetText(root, name, 'datapackage.json');
}
