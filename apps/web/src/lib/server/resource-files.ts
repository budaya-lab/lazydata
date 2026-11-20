import { constants, type BigIntStats } from 'node:fs';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { ResourceOption } from '../resource-fields.ts';
import { configuredRoot, discoverDatasets } from './discovery.ts';
import { countResourceText } from './resource-count.ts';

export const MAX_RESOURCE_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 10000;
const MAX_DEPTH = 32;
const TEMPLATE_FILES = new Set(['README.md', 'datapackage.json', 'dataset.config.json', 'buckets.csv', 'LICENSE', 'CITATION.cff']);
export type ResourceInspection = { status: 'counted'; kind: ResourceOption['kind']; value: number; unit: 'rows' | 'items' | 'files' }
  | { status: 'unsupported'; kind: 'file'; message: string };

export class ResourceReadError extends Error {
  readonly status: 400 | 404 | 413 | 500 | 503;
  constructor(status: ResourceReadError['status'], message: string, options?: ErrorOptions) {
    super(message, options); this.status = status;
  }
}

function safePath(value: string): boolean {
  return value.trim().length > 0 && value.length <= 1024 && !/[\\:\x00-\x1f\x7f]/.test(value)
    && value.replace(/\/$/, '').split('/').every((part) => part.length > 0 && !part.startsWith('.'));
}

async function datasetDirectory(root: string | undefined, name: string): Promise<string> {
  const parent = configuredRoot(root);
  if (!(await discoverDatasets(parent)).includes(name)) throw new ResourceReadError(404, 'Dataset not found.');
  const directory = join(await fs.realpath(parent), name);
  if (await fs.realpath(directory) !== directory || !(await fs.lstat(directory)).isDirectory()) {
    throw new ResourceReadError(404, 'Dataset not found.');
  }
  return directory;
}

function identity(stat: BigIntStats): string {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.nlink, stat.mode].join(':');
}

async function unchanged(path: string, before: BigIntStats): Promise<void> {
  if (await fs.realpath(path) !== path || identity(await fs.lstat(path, { bigint: true })) !== identity(before)) {
    throw new ResourceReadError(500, 'Resource changed while counting. Retry.');
  }
}

export async function listResourcePaths(root: string | undefined, name: string): Promise<ResourceOption[]> {
  try {
    const directory = await datasetDirectory(root, name);
    const before = await fs.lstat(directory, { bigint: true });
    const options: ResourceOption[] = [];
    let seen = 0;
    for await (const entry of await fs.opendir(directory)) {
      if (++seen > MAX_ENTRIES) throw new ResourceReadError(413, 'Root path listing exceeds the 10,000-entry limit.');
      if (!safePath(entry.name) || TEMPLATE_FILES.has(entry.name) || (!entry.isDirectory() && !entry.isFile())) continue;
      const stat = await fs.lstat(join(directory, entry.name));
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1)) continue;
      options.push({ path: entry.name, kind: entry.isDirectory() ? 'directory' : 'file' });
      if (options.length > 1000) throw new ResourceReadError(413, 'Root path suggestions exceed the 1,000-path limit.');
    }
    await unchanged(directory, before);
    return options.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  } catch (cause) {
    if (cause instanceof ResourceReadError) throw cause;
    throw new ResourceReadError(500, 'Could not list resource paths.', { cause });
  }
}

let activeCounts = 0;

export async function inspectResource(root: string | undefined, name: string, resourcePath: string): Promise<ResourceInspection> {
  if (!safePath(resourcePath)) throw new ResourceReadError(400, 'Choose a safe relative path without hidden segments.');
  if (activeCounts >= 2) throw new ResourceReadError(503, 'Resource counter is busy. Retry.');
  activeCounts++;
  try {
    const directory = await datasetDirectory(root, name);
    const anchor = await fs.lstat(directory, { bigint: true });
    const path = join(directory, resourcePath.replace(/\/$/, ''));
    if (await fs.realpath(path) !== path) throw new ResourceReadError(400, 'Resource links are not supported.');
    const before = await fs.lstat(path, { bigint: true });
    let result: ResourceInspection;
    if (before.isDirectory()) {
      let entries = 0; let files = 0;
      const deadline = Date.now() + 5000;
      async function visit(folder: string, depth: number): Promise<void> {
        if (depth > MAX_DEPTH) throw new ResourceReadError(413, 'Directory count exceeds the 32-level limit.');
        const initial = await fs.lstat(folder, { bigint: true });
        if (!initial.isDirectory() || await fs.realpath(folder) !== folder) throw new ResourceReadError(400, 'Directory links are not supported.');
        for await (const entry of await fs.opendir(folder)) {
          if (++entries > MAX_ENTRIES || Date.now() > deadline) throw new ResourceReadError(413, 'Directory count exceeds the 10,000-entry or 5-second limit.');
          const child = join(folder, entry.name);
          const stat = await fs.lstat(child, { bigint: true });
          if (stat.isDirectory()) await visit(child, depth + 1);
          else if (stat.isFile() && stat.nlink === 1n) files++;
          else throw new ResourceReadError(400, 'Directory contains a link or non-regular item. No count was produced.');
        }
        await unchanged(folder, initial);
      }
      await visit(path, 0);
      result = { status: 'counted', kind: 'directory', value: files, unit: 'files' };
    } else {
      if (!before.isFile() || before.nlink !== 1n || resourcePath.endsWith('/')) throw new ResourceReadError(400, 'Choose a regular file, not a link or special item.');
      const format = path.split('.').at(-1)?.toLowerCase() ?? '';
      if (!['csv', 'tsv', 'json', 'jsonl'].includes(format)) {
        result = { status: 'unsupported', kind: 'file', message: 'Unsupported format. Counts support CSV, TSV, JSON arrays and JSONL.' };
      } else {
        if (before.size > BigInt(MAX_RESOURCE_BYTES)) throw new ResourceReadError(413, 'File exceeds the 8 MiB count limit.');
        const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const opened = await file.stat({ bigint: true });
          if (!opened.isFile() || identity(opened) !== identity(before)) throw new ResourceReadError(500, 'Resource changed while opening. Retry.');
          await unchanged(path, before);
          if (await fs.realpath(directory) !== directory) throw new ResourceReadError(500, 'Dataset changed. Reload.');
          const chunks: Buffer[] = [];
          for await (const chunk of file.createReadStream({ autoClose: false, start: 0, end: MAX_RESOURCE_BYTES, signal: AbortSignal.timeout(5000) })) chunks.push(chunk);
          const bytes = Buffer.concat(chunks);
          if (bytes.length > MAX_RESOURCE_BYTES) throw new ResourceReadError(413, 'File exceeds the 8 MiB count limit.');
          if (identity(await file.stat({ bigint: true })) !== identity(before)) throw new ResourceReadError(500, 'Resource changed while reading. Retry.');
          let text: string;
          try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (cause) {
            throw new ResourceReadError(400, 'Resource must contain valid UTF-8.', { cause });
          }
          let value: number | null;
          try { value = countResourceText(text, format); } catch (cause) {
            if (!(cause instanceof Error)) throw cause;
            throw new ResourceReadError(400, cause.message, { cause });
          }
          result = value === null
            ? { status: 'unsupported', kind: 'file', message: 'Unsupported JSON shape. Use a top-level array.' }
            : { status: 'counted', kind: 'file', value, unit: format === 'csv' || format === 'tsv' ? 'rows' : 'items' };
        } finally { await file.close(); }
      }
    }
    await unchanged(path, before);
    const after = await fs.lstat(directory, { bigint: true });
    if (await fs.realpath(directory) !== directory || anchor.dev !== after.dev || anchor.ino !== after.ino) throw new ResourceReadError(500, 'Dataset changed. Reload.');
    return result;
  } catch (cause) {
    if (cause instanceof ResourceReadError) throw cause;
    throw new ResourceReadError(500, 'Could not count this resource. Check that it exists and is readable.', { cause });
  } finally { activeCounts--; }
}
