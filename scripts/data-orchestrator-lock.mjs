#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';

const command = process.argv[2];
const option = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

function gitPath(name) {
  const raw = execFileSync('git', ['rev-parse', '--git-path', name], { encoding: 'utf8' }).trim();
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

const lockPath = gitPath('afflatus-data-orchestrator.lock');
function readOwner() {
  try { return JSON.parse(readFileSync(lockPath, 'utf8')); } catch { return null; }
}

function readOwnerAt(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function sameOwner(left, right) {
  return Boolean(left && right
    && left.token === right.token
    && left.pid === right.pid
    && left.acquiredAt === right.acquiredAt);
}

function writeExclusive(path, value) {
  const fd = openSync(path, 'wx');
  let complete = false;
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
    complete = true;
  } finally {
    closeSync(fd);
    if (!complete) {
      // This process created the O_EXCL file, so it is the only owner that may
      // clean it up when the durable owner write itself fails.
      try { unlinkSync(path); } catch { /* fail closed if the filesystem refuses cleanup */ }
    }
  }
}

function output(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(message, code = 75) {
  console.error(`[data-orchestrator-lock] ${message}`);
  process.exit(code);
}

if (command === 'status') {
  output({ locked: existsSync(lockPath), lockPath, owner: readOwner() });
} else if (command === 'acquire') {
  const now = new Date();
  const ttlMinutes = Number(option('ttl-minutes') || 120);
  if (!Number.isFinite(ttlMinutes) || ttlMinutes < 15 || ttlMinutes > 360) {
    fail('--ttl-minutes must be between 15 and 360', 64);
  }

  // Daily automation never removes a lock it did not create. A stale or
  // ownerless lock is an explicit repair condition, not permission to guess.
  if (existsSync(lockPath)) fail(`orchestrator lock already exists at ${lockPath}: ${JSON.stringify(readOwner())}`);

  const token = randomUUID();
  const schedulerPid = Number(option('pid') || process.ppid);
  if (!Number.isInteger(schedulerPid) || schedulerPid <= 0) fail('--pid must identify the long-lived scheduler process', 64);
  const owner = {
    token,
    pid: schedulerPid,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    cwd: process.cwd(),
  };
  try {
    // O_EXCL makes ownership creation one filesystem operation. A kill may
    // leave a partial file, but daily automation will fail closed and never
    // delete that non-owned repair condition.
    writeExclusive(lockPath, owner);
  } catch (error) {
    fail(`could not acquire ${lockPath}: ${error.message}`);
  }
  output({ acquired: true, lockPath, owner });
} else if (command === 'release') {
  const token = option('token');
  const owner = readOwner();
  if (!token || owner?.token !== token) fail('refusing to release a lock owned by another token');
  const quarantinePath = `${lockPath}.release-${randomUUID()}`;
  try { renameSync(lockPath, quarantinePath); } catch (error) {
    fail(`lock changed while releasing: ${error.message}`);
  }
  const quarantinedOwner = readOwnerAt(quarantinePath);
  if (!sameOwner(owner, quarantinedOwner)) {
    fail(`lock owner changed while releasing; refusing ABA lock deletion; preserved ${quarantinePath}`);
  }
  unlinkSync(quarantinePath);
  output({ released: true, lockPath, token });
} else {
  fail('usage: data-orchestrator-lock.mjs acquire|release|status [--token=<owner-token>] [--pid=<scheduler-pid>] [--ttl-minutes=120]', 64);
}
