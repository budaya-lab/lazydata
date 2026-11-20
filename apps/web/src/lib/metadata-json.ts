import { visit } from 'jsonc-parser';
import { MAX_DATASET_TEXT_BYTES } from './dataset-text-limits.ts';

export class MetadataDraftError extends Error {}
const encoder = new TextEncoder();

export function checkMetadataSize(text: string): void {
  if (text.length > MAX_DATASET_TEXT_BYTES || encoder.encode(text).byteLength > MAX_DATASET_TEXT_BYTES) {
    throw new MetadataDraftError('Metadata exceeds the 5 MiB editing limit.');
  }
}

export function metadataObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Compare decimal values without expanding large exponents or rounding through Number.
function decimal(text: string): string {
  const [mantissa, exponent = '0'] = text.toLowerCase().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  const digits = mantissa.replace('.', '').replace(/^(-?)0+/, '$1');
  const trailing = digits.match(/0+$/)?.[0].length ?? 0;
  const coefficient = trailing ? digits.slice(0, -trailing) : digits;
  return !coefficient || coefficient === '-' ? '0'
    : `${coefficient}e${BigInt(exponent) - BigInt(fraction) + BigInt(trailing)}`;
}

export function readMetadataObject(text: string): Record<string, unknown> {
  checkMetadataSize(text);
  const containers: (Set<string> | null)[] = [];
  let values = 0;
  function count() {
    if (++values > 100000) throw new MetadataDraftError('Metadata exceeds the 100,000-value editing limit.');
  }
  function begin(object: boolean) {
    count();
    if (containers.length >= 128) throw new MetadataDraftError('Metadata exceeds the 128-level editing limit.');
    containers.push(object ? new Set() : null);
  }
  visit(text, {
    onObjectBegin: () => begin(true), onArrayBegin: () => begin(false),
    onObjectEnd: () => { containers.pop(); }, onArrayEnd: () => { containers.pop(); },
    onObjectProperty: (key) => {
      const keys = containers.at(-1);
      if (!keys || keys.has(key)) throw new MetadataDraftError('Duplicate JSON properties cannot be edited.');
      keys.add(key);
    },
    onLiteralValue: (value, offset, length) => {
      count();
      if (typeof value === 'number') {
        const token = text.slice(offset, offset + length);
        if (!Number.isFinite(value) || Object.is(value, -0) || length > 1024
          || decimal(token) !== decimal(JSON.stringify(value))) {
          throw new MetadataDraftError('A JSON number cannot round-trip safely through this editor.');
        }
      }
    },
    onError: () => { throw new MetadataDraftError('Only strict JSON objects can be edited.'); },
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  let data: unknown;
  try { data = JSON.parse(text); } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    throw new MetadataDraftError('Only strict JSON objects can be edited.');
  }
  if (!metadataObject(data)) throw new MetadataDraftError('Only JSON objects can be edited.');
  return data;
}

export function metadataText(data: Record<string, unknown>): string {
  const text = JSON.stringify(data, null, 2) + '\n';
  checkMetadataSize(text);
  return text;
}
