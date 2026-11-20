// Record counting only. This is not shared validation policy.
function delimitedRecords(text: string, separator: string): number {
  let state: 'start' | 'plain' | 'quoted' | 'after' = 'start';
  let columns = 1; let headerColumns: number | undefined; let records = 0; let started = false;
  const invalid = () => { throw new Error('Invalid delimited data. Check quoting and column counts.'); };
  const endRecord = () => {
    if (started) {
      if (headerColumns === undefined) headerColumns = columns;
      else if (headerColumns !== columns) invalid();
      records++;
    }
    state = 'start'; columns = 1; started = false;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (state === 'quoted') {
      if (char === '"') {
        if (text[index + 1] === '"') index++;
        else state = 'after';
      }
      continue;
    }
    if (char === separator) { columns++; started = true; state = 'start'; }
    else if (char === '\n' || char === '\r') {
      endRecord();
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else if (char === '"') {
      if (state !== 'start') invalid();
      state = 'quoted'; started = true;
    } else {
      if (state === 'after') invalid();
      state = 'plain'; started = true;
    }
  }
  if (state === 'quoted') invalid();
  endRecord();
  return Math.max(0, records - 1);
}

function checkJsonDepth(text: string): void {
  let depth = 0; let quoted = false; let escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[' || char === '{') {
      if (++depth > 128) throw new Error('JSON exceeds the 128-level count limit.');
    } else if (char === ']' || char === '}') depth--;
  }
}

export function countResourceText(input: string, format = 'csv'): number | null {
  const text = input.replace(/^\uFEFF/, '');
  if (format === 'csv' || format === 'tsv') return delimitedRecords(text, format === 'csv' ? ',' : '\t');
  if (format !== 'json' && format !== 'jsonl') return null;
  checkJsonDepth(text);
  try {
    if (format === 'json') {
      const value: unknown = JSON.parse(text);
      return Array.isArray(value) ? value.length : null;
    }
    let count = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      JSON.parse(line); count++;
    }
    return count;
  } catch (cause) {
    if (!(cause instanceof SyntaxError)) throw cause;
    throw new Error('Invalid JSON data. No count was produced.', { cause });
  }
}
