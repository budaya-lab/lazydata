// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function isSemver(value: string): boolean {
  return semver.exec(value)?.[0] === value;
}

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const pad = (value: number) => String(value).padStart(2, '0');

function localDay(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateForCreated(value: string): string | null {
  if (timestamp.exec(value)?.[0] !== value || !calendarDate(value.slice(0, 10))) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  const day = localDay(instant);
  return calendarDate(day) ? day : null;
}

export function createdAtLocalMidnight(value: string): string | null {
  if (!calendarDate(value)) return null;
  const midnight = new Date(`${value}T00:00:00`);
  if (localDay(midnight) !== value || midnight.getHours() !== 0 || midnight.getMinutes() !== 0 || midnight.getSeconds() !== 0) return null;
  const offset = -midnight.getTimezoneOffset();
  const minutes = Math.abs(offset);
  const result = `${value}T00:00:00${offset >= 0 ? '+' : '-'}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  // Reject historical sub-minute offsets rather than serialize a different instant.
  return Date.parse(result) === midnight.getTime() ? result : null;
}
