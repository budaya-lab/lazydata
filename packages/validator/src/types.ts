export type PackageField =
  | 'name'
  | 'title'
  | 'description'
  | 'keywords'
  | 'resources'
  | 'created'
  | 'contributors'
  | 'licenses'
  | 'sources';

export type ResourceField = 'name' | 'title' | 'path' | 'count';

export interface DatasetPolicy {
  readonly schemaVersion: 1;
  readonly stages: Readonly<Record<string, string>>;
  readonly package: {
    readonly requiredFields: readonly PackageField[];
  };
  readonly resource: {
    readonly requiredFields: readonly ResourceField[];
  };
  readonly keywords: {
    readonly requiredPrefixes: readonly string[];
    readonly allowOtherKeywords: boolean;
  };
  readonly buckets: {
    readonly required: boolean;
  };
}

export interface BucketRow {
  [column: string]: string | number;
  count: number;
}

export interface Buckets {
  labelColumn: string;
  rows: BucketRow[];
}
