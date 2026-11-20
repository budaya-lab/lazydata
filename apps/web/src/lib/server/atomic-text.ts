import { randomUUID } from 'node:crypto';
import { constants, type BigIntStats } from 'node:fs';
import fs from 'node:fs/promises';
import { join } from 'node:path';

// Call only with a discovered directory and a checked, fixed-filename target.
export async function writeAtomicText(directory: string, filename: 'datapackage.json' | 'README.md', text: string, previous?: BigIntStats): Promise<void> {
  const path = join(directory, filename);
  if (previous) {
    await fs.access(path, constants.W_OK);
    if (previous.mode & 0o7000n) throw new Error('Special file permissions are not supported for saving.');
  }
  const temporary = join(directory, `.${filename}-${randomUUID()}.tmp`);
  const file = await fs.open(temporary, 'wx', 0o600);
  let committed = false;
  try {
    try {
      await file.writeFile(text, 'utf8');
      if (previous) {
        const stat = await file.stat({ bigint: true });
        if (stat.uid !== previous.uid || stat.gid !== previous.gid) {
          await file.chown(Number(previous.uid), Number(previous.gid));
        }
        await file.chmod(Number(previous.mode & 0o777n));
      }
      await file.sync();
    } finally { await file.close(); }
    await fs.rename(temporary, path);
    committed = true;
  } finally {
    if (!committed) await fs.unlink(temporary);
  }
}
