export function addTags(current: readonly string[], entry: string): string[] {
  const result = [...current];
  const known = new Set(current);
  for (const part of entry.split(',')) {
    const tag = part.trim();
    if (tag && !known.has(tag)) {
      result.push(tag);
      known.add(tag);
    }
  }
  return result;
}

export function hasTags(tags: readonly string[]): boolean {
  return tags.some((tag) => Boolean(tag.trim()));
}
