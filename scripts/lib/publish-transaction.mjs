import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const JOURNAL_NAME = 'afflatus-data-publish.json';
const LOCK_NAME = 'afflatus-data-pipeline.lock';
const TRAILER = 'Afflatus-Data-Publish';
const PIPELINE_TRAILER = 'Afflatus-Data-Pipeline';

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
  if (path && existsSync(path)) unlinkSync(path);
}

function durableWrite(path, content, { exclusive = false } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, exclusive ? 'wx' : 'w');
  let complete = false;
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
    complete = true;
  } finally {
    closeSync(fd);
    if (!complete && exclusive) removeFile(path);
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

function normalizeDerivedEntries(repoRoot, paths, transactionId, occupiedTargets) {
  const seen = new Set(occupiedTargets);
  return paths.map((path) => {
    const targetPath = resolve(repoRoot, path);
    const relativePath = assertInsideRepo(repoRoot, targetPath, path);
    if (seen.has(targetPath)) throw new Error(`duplicate publish target ${relativePath}`);
    seen.add(targetPath);
    return {
      kind: 'derived',
      relativePath,
      targetPath,
      backupPath: `${targetPath}.${transactionId}.derived-backup`,
      hadOriginal: existsSync(targetPath),
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

function samePublisherOwner(left, right) {
  return Boolean(left && right
    && left.transactionId === right.transactionId
    && left.pid === right.pid);
}

function readPublisherOwner(directory) {
  try { return JSON.parse(readFileSync(directory, 'utf8')); } catch { return null; }
}

function acquireLock(lockPath, transactionId) {
  const owner = { pid: process.pid, transactionId };
  try {
    durableWrite(lockPath, `${JSON.stringify(owner)}\n`, { exclusive: true });
  } catch (error) {
    throw new PublishTransactionError('lock', 'publisher lock already exists or could not be acquired atomically', { cause: error });
  }
  return lockPath;
}

function changedTrackedPaths(commandRunner, root, cached = false) {
  const args = ['diff', ...(cached ? ['--cached'] : []), '--name-only', '-z', '--'];
  const result = runChecked(commandRunner, 'validate', 'git', args, { cwd: root, capture: true });
  return String(result.stdout || '').split('\0').filter(Boolean);
}

function assertTrackedBoundary(commandRunner, root, allowedPaths = []) {
  const allowed = new Set(allowedPaths);
  const changed = [
    ...changedTrackedPaths(commandRunner, root, false),
    ...changedTrackedPaths(commandRunner, root, true),
  ];
  const unexpected = [...new Set(changed)].filter((path) => !allowed.has(path));
  if (unexpected.length) {
    throw new PublishTransactionError('validate', `tracked worktree or index contains changes outside the publication boundary: ${unexpected.join(', ')}`);
  }
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

function normalizeVerificationCommands(buildCommand, verificationCommands) {
  const commands = verificationCommands ?? (buildCommand ? [{
    phase: 'build',
    command: buildCommand,
  }] : []);
  if (!Array.isArray(commands)) {
    throw new PublishTransactionError('validate', 'verificationCommands must be an array');
  }
  return commands.map((verification, index) => {
    const command = Array.isArray(verification) ? verification : verification?.command;
    const phase = Array.isArray(verification) ? `verify-${index + 1}` : verification?.phase;
    if (!Array.isArray(command) || !command.length) {
      throw new PublishTransactionError('validate', `verificationCommands[${index}].command must be non-empty`);
    }
    if (typeof phase !== 'string' || !phase.trim()) {
      throw new PublishTransactionError('validate', `verificationCommands[${index}].phase must be non-empty`);
    }
    return { phase, command };
  });
}

function normalizePreCommitCommands(preCommitCommands) {
  if (preCommitCommands == null) return [];
  if (!Array.isArray(preCommitCommands)) {
    throw new PublishTransactionError('validate', 'preCommitCommands must be an array');
  }
  return preCommitCommands.map((check, index) => {
    const command = Array.isArray(check) ? check : check?.command;
    const phase = Array.isArray(check) ? `pre-commit-${index + 1}` : check?.phase;
    if (!Array.isArray(command) || !command.length) {
      throw new PublishTransactionError('validate', `preCommitCommands[${index}].command must be non-empty`);
    }
    if (typeof phase !== 'string' || !phase.trim()) {
      throw new PublishTransactionError('validate', `preCommitCommands[${index}].phase must be non-empty`);
    }
    return { phase, command };
  });
}

function normalizePreCommitHooks(preCommitHooks) {
  if (preCommitHooks == null) return [];
  if (!Array.isArray(preCommitHooks)) {
    throw new PublishTransactionError('validate', 'preCommitHooks must be an array');
  }
  return preCommitHooks.map((entry, index) => {
    const hook = typeof entry === 'function' ? entry : entry?.hook;
    const phase = typeof entry === 'function' ? `pre-commit-hook-${index + 1}` : entry?.phase;
    if (typeof hook !== 'function') {
      throw new PublishTransactionError('validate', `preCommitHooks[${index}].hook must be a function`);
    }
    if (typeof phase !== 'string' || !phase.trim()) {
      throw new PublishTransactionError('validate', `preCommitHooks[${index}].phase must be non-empty`);
    }
    return { phase, hook };
  });
}

function assertPublishedBytes(entries, phase) {
  for (const entry of entries) {
    if (sha256(readFileSync(entry.targetPath)) !== entry.expectedSha256) {
      throw new PublishTransactionError(phase, `${entry.relativePath} changed during ${phase}`);
    }
  }
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
    if (entry.stagePath) assertInsideRepo(repoRoot, entry.stagePath, 'journal stage');
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
 * prepare/validate -> same-filesystem stage/rename -> regenerate declared
 * derived artifacts -> ordered verification commands -> commit-adjacent gates
 * -> path-only Git commit. Derive/verification/pre-commit/commit failures
 * restore every target byte-for-byte.
 */
export function runAtomicPublishTransaction({
  repoRoot = process.cwd(),
  pipelineId,
  prepare,
  entries,
  commitMessage = `data: publish ${pipelineId || 'pipeline'}`,
  deriveCommand = null,
  derivedPaths = [],
  buildCommand = ['npm', 'run', 'build'],
  verificationCommands,
  preCommitCommands = [],
  preCommitHooks = [],
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
  acquireLock(lockPath, transactionId);

  let journal = null;
  let normalized = [];
  let normalizedDerived = [];
  let committed = false;
  try {
    // Daily automation may remove only the lock it just acquired. A previous
    // transaction journal is an explicit repair condition; silently rolling
    // it back here would mutate repository data before the clean preflight.
    if (existsSync(journalPath)) {
      throw new PublishTransactionError(
        'recover',
        `publish journal already exists at ${journalPath}; run explicit recovery after confirming no publisher is active`,
      );
    }
    onPhase('validate');
    assertTrackedBoundary(commandRunner, root);
    let prepared;
    try {
      prepared = typeof prepare === 'function' ? prepare() : entries;
      if (!Array.isArray(prepared) || !prepared.length) throw new Error('publish set is empty');
    } catch (error) {
      throw new PublishTransactionError('validate', error.message, { cause: error });
    }
    normalized = normalizeEntries(root, prepared, transactionId);
    const declaredPaths = normalized.map((entry) => entry.relativePath);
    if (normalized.every((entry) => (
      entry.hadOriginal && sha256(readFileSync(entry.targetPath)) === entry.expectedSha256
    ))) {
      onPhase('complete');
      return { status: 'unchanged', transactionId, paths: declaredPaths };
    }
    normalizedDerived = normalizeDerivedEntries(
      root,
      derivedPaths,
      transactionId,
      normalized.map((entry) => entry.targetPath),
    );
    if (normalizedDerived.length && (!Array.isArray(deriveCommand) || !deriveCommand.length)) {
      throw new PublishTransactionError('validate', 'deriveCommand is required when derivedPaths are declared');
    }
    if (!normalizedDerived.length && deriveCommand) {
      throw new PublishTransactionError('validate', 'derivedPaths are required when deriveCommand is declared');
    }
    const verifications = normalizeVerificationCommands(buildCommand, verificationCommands);
    const commitCommands = normalizePreCommitCommands(preCommitCommands);
    const commitHooks = normalizePreCommitHooks(preCommitHooks);
    const allEntries = [...normalized, ...normalizedDerived];
    const paths = allEntries.map((entry) => entry.relativePath);

    onPhase('stage');
    journal = {
      version: 1,
      id: transactionId,
      pipelineId,
      phase: 'preparing',
      entries: [
        ...normalized.map(({ content: _content, ...entry }) => ({ kind: 'publish', ...entry })),
        ...normalizedDerived,
      ],
    };
    // Journal the exact stage/backup names before the first filesystem write,
    // so even a kill in the middle of staging is self-cleaning on next run.
    writeJournal(journalPath, journal);
    for (const entry of normalized) {
      removeFile(entry.stagePath);
      removeFile(entry.backupPath);
      durableWrite(entry.stagePath, entry.content, { exclusive: true });
    }
    for (const entry of normalizedDerived) {
      removeFile(entry.backupPath);
      if (entry.hadOriginal) {
        durableWrite(entry.backupPath, readFileSync(entry.targetPath), { exclusive: true });
      }
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

    if (normalizedDerived.length) {
      onPhase('derive');
      const [deriveProgram, ...deriveArgs] = deriveCommand;
      runChecked(commandRunner, 'derive', deriveProgram, deriveArgs, {
        cwd: root,
        env: { ...process.env, AFFLATUS_DATA_PUBLISH_TRANSACTION: transactionId },
      });
      for (const entry of normalizedDerived) {
        if (!existsSync(entry.targetPath)) {
          throw new PublishTransactionError('derive', `${entry.relativePath} was not generated`);
        }
        entry.expectedSha256 = sha256(readFileSync(entry.targetPath));
        const journalEntry = journal.entries.find((item) => item.targetPath === entry.targetPath);
        journalEntry.expectedSha256 = entry.expectedSha256;
      }
      journal.phase = 'derived';
      writeJournal(journalPath, journal);
    }

    for (const { phase, command } of verifications) {
      onPhase(phase);
      const [program, ...args] = command;
      runChecked(commandRunner, phase, program, args, {
        cwd: root,
        env: { ...process.env, AFFLATUS_DATA_PUBLISH_TRANSACTION: transactionId },
      });
      assertPublishedBytes(allEntries, phase);
    }
    journal.phase = 'verified';
    writeJournal(journalPath, journal);

    assertTrackedBoundary(commandRunner, root, paths);
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

    // These gates intentionally run after every potentially long derive/test/
    // build step and after confirming that a commit is actually needed. Keep
    // this block adjacent to git commit: it is the final authority for
    // real-time publication windows and other expiring commit conditions.
    for (const { phase, command } of commitCommands) {
      onPhase(phase);
      const [program, ...args] = command;
      runChecked(commandRunner, phase, program, args, {
        cwd: root,
        env: { ...process.env, AFFLATUS_DATA_PUBLISH_TRANSACTION: transactionId },
      });
      assertPublishedBytes(allEntries, phase);
    }
    for (const { phase, hook } of commitHooks) {
      onPhase(phase);
      let result;
      try {
        result = hook({
          repoRoot: root,
          pipelineId,
          transactionId,
          paths: [...paths],
          commandRunner,
        });
      } catch (error) {
        throw new PublishTransactionError(phase, error.message, { cause: error });
      }
      if (result && typeof result.then === 'function') {
        throw new PublishTransactionError(phase, 'preCommitHooks must be synchronous');
      }
      assertPublishedBytes(allEntries, phase);
    }
    if (commitCommands.length || commitHooks.length) {
      journal.phase = 'pre-commit-passed';
      writeJournal(journalPath, journal);
    }

    onPhase('commit');
    runChecked(commandRunner, 'commit', 'git', [
      'commit', '--only',
      '-m', commitMessage,
      '-m', `${TRAILER}: ${transactionId}`,
      '-m', `${PIPELINE_TRAILER}: ${pipelineId}`,
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
      for (const entry of [...normalized, ...normalizedDerived]) {
        removeFile(entry.stagePath);
        removeFile(entry.backupPath);
      }
    }
    if (error instanceof PublishTransactionError) throw error;
    throw new PublishTransactionError(journal?.phase || 'validate', error.message, { cause: error });
  } finally {
    const liveOwner = readPublisherOwner(lockPath);
    if (liveOwner?.transactionId === transactionId && liveOwner?.pid === process.pid) {
      const releasePath = `${lockPath}.release-${transactionId}`;
      try {
        renameSync(lockPath, releasePath);
        const releasedOwner = readPublisherOwner(releasePath);
        if (samePublisherOwner(liveOwner, releasedOwner)) {
          removeFile(releasePath);
        }
        // An owner mismatch is quarantined for explicit repair. Never rename
        // it over lockPath: a new publisher may have acquired that O_EXCL path
        // during this release window.
      } catch { /* a different owner or recovery won; never remove it */ }
    }
  }
}
