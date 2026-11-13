export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isResourcePath(path: unknown): path is string {
  if (!isText(path) || path.startsWith('/') || path.includes('\\')) return false;

  const segments = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');

  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
}
