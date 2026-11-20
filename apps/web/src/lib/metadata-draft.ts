import type { DraftChanges, DraftRow, KeywordEdits } from './draft-checks.ts';
import { MetadataDraftError, metadataObject, metadataText, readMetadataObject } from './metadata-json.ts';
export { MetadataDraftError } from './metadata-json.ts';

type Section = 'resources' | 'sources' | 'contributors';
type Row = NonNullable<DraftChanges[Section]>[number];
type Entries = Map<number, unknown>;
const sections: Section[] = ['resources', 'sources', 'contributors'];

function editableArray(value: unknown, empty: boolean, section: string): unknown[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200) {
    if (empty) return null;
    throw new MetadataDraftError(`${section} cannot be edited as a supported array (maximum 200 entries).`);
  }
  return value;
}

function editRows(rows: Row[], references: Entries): { items: unknown[]; references: Entries } {
  if (rows.length > 200 || new Set(rows.map((row) => row.id)).size !== rows.length) {
    throw new MetadataDraftError('Invalid form row identities or too many rows.');
  }
  const next = new Map<number, unknown>();
  const items = rows.map(({ id, fields }: DraftRow<Row['fields']>) => {
    if (!Number.isSafeInteger(id) || id < 0 || (id < 200 && !references.has(id))) {
      throw new MetadataDraftError('Stale form row identity.');
    }
    const previous = references.get(id);
    const values = Object.entries(fields).filter(([, value]) => value !== null);
    if (previous !== undefined && !metadataObject(previous)) {
      if (values.length) throw new MetadataDraftError('This row is not a JSON object.');
      next.set(id, previous);
      return previous;
    }
    const entry = { ...previous };
    for (const [key, value] of values) {
      if (!Object.hasOwn(entry, key) && (value === '' || (Array.isArray(value) && !value.length))) continue;
      entry[key] = value;
    }
    next.set(id, entry);
    return entry;
  });
  return { items, references: next };
}

function editKeywords(value: unknown, changes: KeywordEdits): unknown[] {
  if (value !== undefined && !Array.isArray(value)) throw new MetadataDraftError('Keywords must be a JSON array.');
  let words: unknown[] = value ?? [];
  for (const [group, values] of Object.entries(changes)) {
    const prefix = { tasks: 'task:', projects: 'project:', stage: 'stage:' }[group];
    const matches = (word: unknown) => typeof word === 'string' && (prefix ? word.startsWith(prefix)
      : !['task:', 'project:', 'stage:'].some((known) => word.startsWith(known)));
    const replacements = group === 'stage' ? (values ? [`stage:${values}`] : [])
      : (values as string[]).map((word) => `${prefix ?? ''}${word}`);
    const first = words.findIndex(matches);
    const position = first < 0 ? words.length : first;
    words = words.filter((word) => !matches(word));
    words.splice(position, 0, ...replacements);
  }
  return words;
}

// One working object. Row references only connect the existing form's stable IDs to its objects.
export class MetadataDraft {
  private data: Record<string, unknown>;
  private initial: string;
  private rows: Record<Section, Entries>;
  private licenses: Entries;

  constructor(text: string) {
    this.data = readMetadataObject(text);
    this.initial = metadataText(this.data);
    this.rows = { resources: new Map(), sources: new Map(), contributors: new Map() };
    for (const key of sections) {
      const value = this.data[key];
      if (Array.isArray(value) && value.length <= 200) this.rows[key] = new Map(value.map((entry, id) => [id, entry]));
    }
    const licenses = this.data.licenses;
    this.licenses = new Map((Array.isArray(licenses) && licenses.length <= 200 ? licenses : [])
      .filter((entry) => metadataObject(entry) && typeof entry.name === 'string').map((entry, id) => [id, entry]));
  }

  text(): string { return metadataText(this.data); }
  get dirty(): boolean { return this.text() !== this.initial; }
  markSaved(text: string): void { this.initial = text; }

  update(changes: DraftChanges): void {
    const next = { ...this.data };
    const rows = { ...this.rows };
    let licenses = this.licenses;
    for (const [key, value] of Object.entries(changes.overview ?? {})) {
      if (key !== 'createdError' && !(key === 'created' && changes.overview?.createdError) && typeof value === 'string') {
        if (value !== '' || Object.hasOwn(next, key)) next[key] = value;
      }
    }
    if (changes.keywords) next.keywords = editKeywords(next.keywords, changes.keywords);
    for (const key of sections) {
      const entries = changes[key];
      if (!entries || editableArray(next[key], !entries.length, key) === null) continue;
      const result = editRows(entries, rows[key]);
      if (next[key] !== undefined || result.items.length) next[key] = result.items;
      rows[key] = result.references;
    }
    if (changes.licenses) {
      const current = editableArray(next.licenses, !changes.licenses.length, 'Licenses');
      if (current) {
        const names = changes.licenses;
        const ids = changes.licenseIds;
        if (!ids || ids.length !== names.length || names.length > 200 || new Set(ids).size !== ids.length) {
          throw new MetadataDraftError('Invalid license entry identities.');
        }
        licenses = new Map();
        const selected = names.map((name, index) => {
          const id = ids[index];
          if (!Number.isSafeInteger(id) || id < 0 || (id < 200 && !this.licenses.has(id))) {
            throw new MetadataDraftError('Stale license entry identity.');
          }
          const entry = this.licenses.get(id) ?? { name };
          if (!metadataObject(entry) || entry.name !== name) throw new MetadataDraftError('Stale license name.');
          licenses.set(id, entry);
          return entry;
        });
        const items = current.filter((entry) => !metadataObject(entry) || typeof entry.name !== 'string' || selected.includes(entry));
        items.push(...selected.filter((entry) => !items.includes(entry)));
        if (next.licenses !== undefined || items.length) next.licenses = items;
      }
    }
    // Validate serialized size before committing any changes or row references.
    metadataText(next);
    this.data = next;
    this.rows = rows;
    this.licenses = licenses;
  }
}
