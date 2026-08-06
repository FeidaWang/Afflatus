import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function atomicWriteJsonGroup(entries) {
  const staged = [];
  try {
    for (const entry of entries) {
      const path = resolve(entry.path);
      mkdirSync(dirname(path), { recursive: true });
      const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(entry.data, null, 2)}\n`, { flag: 'wx' });
      staged.push({ path, tempPath });
    }
    for (const entry of staged) renameSync(entry.tempPath, entry.path);
  } finally {
    for (const entry of staged) rmSync(entry.tempPath, { force: true });
  }
}
