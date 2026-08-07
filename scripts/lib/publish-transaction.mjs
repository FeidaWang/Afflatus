import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const JOURNAL_NAME = 'afflatus-data-publish.json';
const LOCK_NAME = 'afflatus-data-pipeline.lock';
const TRAILER = 'Afflatus-Data-Publish';

export class PublishTransactionError extends Error {
  constructor(phase, message, options = {}) {
    super(message, options);
    this.name = 'PublishTransactionError';
    this.phase = phase;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function removeFile(path) {
  if (existsSync(path)) unlinkSync(path);
}

function durableWrite(path, content, { exclusive = false } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, exclusive ? 'wx' : 'w');
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeJournal(path, journal) {
  const tempPath = `${path}.${process.pid}.tmp`;
  removeFile(tempPath);
  try {
    durableWrite(tempPath, `${JSON.stringify(journal, null, 2)}\n`, { exclusive: true });
    renameSync(tempPath, path);
  } finally {
    removeFile(tempPath);
  }
}

function resolveGitDirectory(repoRoot) {
  const dotGit = join(repoRoot, '.git');
  const stat = statSync(dotGit);
  if (stat.isDirectory()) return dotGit;
  const match = /^gitdir:\s*(.+)\s*$/i.exec(readFileSync(dotGit, 'utf8'));
  if (!match) throw new Error(`${dotGit} is not a Git directory or gitdir pointer`);
  return resolve(repoRoot, match[1]);
}

function assertInsideRepo(repoRoot, path, label) {
  const rel = relative(repoRoot, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${label} must be a file below the repository root`);
  }
  return rel;
}

function normalizeEntries(repoRoot, entries, transactionId) {
  const seen = new Set();
  return entries.map((entry) => {
    const targetPath = resolve(repoRoot, entry.path);
    const relativePath = assertInsideRepo(repoRoot, targetPath, entry.path);
    if (seen.has(targetPath)) throw new Error(`duplicate publish target ${relativePath}`);
    seen.add(targetPath);
    const content = typeof entry.content === 'string'
      ? entry.content
      : `${JSON.stringify(entry.data, null, 2)}\n`;
    return {
      relativePath,
      targetPath,
      stagePath: `${targetPath}.${transactionId}.stage`,
      backupPath: `${targetPath}.${transactionId}.backup`,
      hadOriginal: existsSync(targetPath),
      expectedSha256: sha256(content),
      content,
    };
  });
}

function defaultCommandRunner(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function acquireLock(lockPath, journalPath, transactionId) {
  const ownerPath = join(lockPath, 'owner.json');
  try {
    mkdirSync(lockPath);
  } catch (error) {
    // A killed publisher leaves both its journal and its project-owned lock.
    // Only reclaim a lock with an explicit dead PID; never guess about the
    // empty legacy shell-script lock or steal one from a live process.
    let owner = null;
    try { owner = JSON.parse(readFileSync(ownerPath, 'utf8')); } catch { /* not ours to reclaim */ }
    if (!owner || processIsAlive(owner.pid)) {
      throw new PublishTransactionError('lock', 'another Afflatus data publisher is active', { cause: error });
    }
    removeFile(ownerPath);
    try { rmdirSync(lockPath); } catch (removeError) {
      throw new PublishTransactionError('lock', 'stale data-publisher lock could not be reclaimed', { cause: removeError });
    }
    mkdirSync(lockPath);
  }
  durableWrite(ownerPath, `${JSON.stringify({ pid: process.pid, transactionId })}\n`, { exclusive: true });
  return ownerPath;
}

function commandFailure(phase, command, args, result) {
  const detail = String(result?.stderr || result?.error?.message || '').trim();
  return new PublishTransactionError(
    phase,
    `${[command, ...args].join(' ')} failed with status ${result?.status ?? 'unknown'}${detail ? `: ${detail}` : ''}`,
  );
}

function runChecked(runner, phase, command, args, options) {
  const result = runner(command, args, options);
  if (result?.status !== 0) throw commandFailure(phase, command, args, result);
  return result;
}

function cleanupArtifacts(journalPath, journal) {
  for (const entry of journal.entries) {
    removeFile(entry.stagePath);
    removeFile(entry.backupPath);
  }
  removeFile(journalPath);
}

function rollbackJournal(repoRoot, journalPath, journal) {
  for (const entry of [...journal.entries].reverse()) {
    assertInsideRepo(repoRoot, entry.targetPath, 'journal target');
    assertInsideRepo(repoRoot, entry.stagePath, 'journal stage');
    assertInsideRepo(repoRoot, entry.backupPath, 'journal backup');
    if (existsSync(entry.backupPath)) {
      removeFile(entry.targetPath);
      renameSync(entry.backupPath, entry.targetPath);
    } else if (!entry.hadOriginal) {
      removeFile(entry.targetPath);
    }
    removeFile(entry.stagePath);
  }
  removeFile(journalPath);
}

/**
 * Recover an interrupted publish. A transaction whose Git trailer reached
 * HEAD is committed even if the process died before journal cleanup; every
 * other incomplete journal is restored from its same-directory backups.
 */
export function recoverAtomicPublish({ repoRoot = process.cwd(), commandRunner = defaultCommandRunner } = {}) {
  const root = resolve(repoRoot);
  const gitDirectory = resolveGitDirectory(root);
  const journalPath = join(gitDirectory, JOURNAL_NAME);
  if (!existsSync(journalPath)) return { recovered: false };
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const trailer = `${TRAILER}: ${journal.id}`;
  const head = commandRunner('git', ['log', '-1', '--format=%B'], { cwd: root, capture: true });
  const committed = journal.phase === 'committed'
    || (head?.status === 0 && String(head.stdout || '').includes(trailer));
  if (committed) {
    cleanupArtifacts(journalPath, journal);
    return { recovered: true, action: 'finalized', transactionId: journal.id };
  }
  rollbackJournal(root, journalPath, journal);
  return { recovered: true, action: 'rolled-back', transactionId: journal.id };
}

/**
 * Complete data publication boundary:
 * prepare/validate -> same-filesystem stage/rename -> build smoke -> path-only
 * Git commit. Build/commit failures restore every target byte-for-byte.
 */
export function runAtomicPublishTransaction({
  repoRoot = process.cwd(),
  pipelineId,
  prepare,
  entries,
  commitMessage = `data: publish ${pipelineId || 'pipeline'}`,
  buildCommand = ['npm', 'run', 'build'],
  commandRunner = defaultCommandRunner,
  transactionId = `${Date.now()}-${process.pid}`,
  onPhase = () => {},
} = {}) {
  if (!pipelineId) throw new PublishTransactionError('validate', 'pipelineId is required');
  if (typeof prepare !== 'function' && !Array.isArray(entries)) {
    throw new PublishTransactionError('validate', 'prepare() or entries[] is required');
  }
  const root = resolve(repoRoot);
  const gitDirectory = resolveGitDirectory(root);
  const lockPath = join(gitDirectory, LOCK_NAME);
  const journalPath = join(gitDirectory, JOURNAL_NAME);
  const lockOwnerPath = acquireLock(lockPath, journalPath, transactionId);

  let journal = null;
  let normalized = [];
  let committed = false;
  try {
    recoverAtomicPublish({ repoRoot: root, commandRunner });
    onPhase('validate');
    let prepared;
    try {
      prepared = typeof prepare === 'function' ? prepare() : entries;
      if (!Array.isArray(prepared) || !prepared.length) throw new Error('publish set is empty');
    } catch (error) {
      throw new PublishTransactionError('validate', error.message, { cause: error });
    }
    normalized = normalizeEntries(root, prepared, transactionId);
    const paths = normalized.map((entry) => entry.relativePath);

    // Do not overwrite a human/sibling publisher's target edits. `--only`
    // later preserves unrelated staged files, but these exact paths must start
    // clean for byte-perfect rollback to have an unambiguous base.
    const worktree = commandRunner('git', ['diff', '--quiet', '--', ...paths], { cwd: root, capture: true });
    const index = commandRunner('git', ['diff', '--cached', '--quiet', '--', ...paths], { cwd: root, capture: true });
    if (worktree?.status !== 0 || index?.status !== 0) {
      throw new PublishTransactionError('validate', 'publish targets contain pre-existing Git changes');
    }

    onPhase('stage');
    journal = {
      version: 1,
      id: transactionId,
      pipelineId,
      phase: 'preparing',
      entries: normalized.map(({ content: _content, ...entry }) => entry),
    };
    // Journal the exact stage/backup names before the first filesystem write,
    // so even a kill in the middle of staging is self-cleaning on next run.
    writeJournal(journalPath, journal);
    for (const entry of normalized) {
      removeFile(entry.stagePath);
      removeFile(entry.backupPath);
      durableWrite(entry.stagePath, entry.content, { exclusive: true });
    }
    journal.phase = 'staged';
    writeJournal(journalPath, journal);

    onPhase('publish');
    for (const entry of normalized) {
      if (entry.hadOriginal) renameSync(entry.targetPath, entry.backupPath);
      renameSync(entry.stagePath, entry.targetPath);
    }
    journal.phase = 'published';
    writeJournal(journalPath, journal);

    onPhase('build');
    const [buildProgram, ...buildArgs] = buildCommand;
    runChecked(commandRunner, 'build', buildProgram, buildArgs, {
      cwd: root,
      env: { ...process.env, AFFLATUS_DATA_PUBLISH_TRANSACTION: transactionId },
    });
    for (const entry of normalized) {
      if (sha256(readFileSync(entry.targetPath)) !== entry.expectedSha256) {
        throw new PublishTransactionError('build', `${entry.relativePath} changed during build smoke`);
      }
    }
    journal.phase = 'build-passed';
    writeJournal(journalPath, journal);

    onPhase('commit');
    const changed = commandRunner('git', ['diff', '--quiet', '--', ...paths], { cwd: root, capture: true });
    if (changed?.status === 0) {
      journal.phase = 'committed';
      journal.commit = 'unchanged';
      writeJournal(journalPath, journal);
      committed = true;
      cleanupArtifacts(journalPath, journal);
      onPhase('complete');
      return { status: 'unchanged', transactionId, paths };
    }
    if (changed?.status !== 1) throw commandFailure('commit', 'git', ['diff', '--quiet'], changed);

    runChecked(commandRunner, 'commit', 'git', [
      'commit', '--only',
      '-m', commitMessage,
      '-m', `${TRAILER}: ${transactionId}`,
      '--', ...paths,
    ], { cwd: root });
    committed = true;
    const head = runChecked(commandRunner, 'commit', 'git', ['rev-parse', 'HEAD'], { cwd: root, capture: true });
    journal.phase = 'committed';
    journal.commit = String(head.stdout || '').trim();
    writeJournal(journalPath, journal);
    cleanupArtifacts(journalPath, journal);
    onPhase('complete');
    return { status: 'committed', transactionId, commit: journal.commit, paths };
  } catch (error) {
    if (!committed && journal) rollbackJournal(root, journalPath, journal);
    else if (!journal) {
      for (const entry of normalized) {
        removeFile(entry.stagePath);
        removeFile(entry.backupPath);
      }
    }
    if (error instanceof PublishTransactionError) throw error;
    throw new PublishTransactionError(journal?.phase || 'validate', error.message, { cause: error });
  } finally {
    removeFile(lockOwnerPath);
    try { rmdirSync(lockPath); } catch { /* another recovery can clear a stale lock manually */ }
  }
}
