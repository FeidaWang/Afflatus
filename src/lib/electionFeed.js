/* ============================================================
   Foreground refresh over this site's own cached snapshots. It reads the small
   pointer, then the immutable snapshot it names. A failed or inconsistent read
   keeps what is on screen and records the failure. Nothing here talks to a
   source, and with no base URL nothing runs at all.
   ============================================================ */
import { feedAllowed, pointerErrors, snapshotErrors } from './electionResults.js';

export const VISIBLE_CHECK_MS = 60 * 1000;
export const HIDDEN_CHECK_MS = 5 * 60 * 1000;
const MAX_CHECK_MS = 15 * 60 * 1000;

export function createFeedController({
  base, eventId, hostname, serverApprovedSource, fetchJson, onChange, isHidden = () => false, now = Date.now, schedule = setTimeout, cancel = clearTimeout,
}) {
  const state = { status: 'idle', pointer: null, snapshot: null, paused: false, lastAttemptAt: null, error: null };
  const snapshots = new Map();
  let timer = null;
  let failures = 0;
  let stopped = false;
  let checking = false;

  const delay = () => {
    const normal = isHidden() ? HIDDEN_CHECK_MS : VISIBLE_CHECK_MS;
    return failures ? Math.min(normal * 2 ** failures, MAX_CHECK_MS) : normal;
  };

  function plan() {
    if (timer !== null) cancel(timer);
    timer = null;
    if (!stopped && !state.paused) timer = schedule(check, delay());
  }

  /** Reads one recorded snapshot, checking it is the one asked for. Identical ids never re-download. */
  async function loadSnapshot(snapshotId) {
    if (snapshots.has(snapshotId)) return snapshots.get(snapshotId);
    const snapshot = await fetchJson(`${base}${eventId}/snapshots/${snapshotId}.json`);
    const errors = snapshotErrors(snapshot);
    if (errors.length) throw new Error(`Invalid snapshot: ${errors[0]}`);
    if (snapshot.snapshotId !== snapshotId || snapshot.eventId !== eventId) throw new Error('Snapshot does not match its pointer');
    if (!feedAllowed(snapshot, hostname, { serverApprovedSource })) throw new Error('Snapshot is not cleared for this host');
    snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  async function check() {
    if (checking || stopped) return;
    checking = true;
    state.lastAttemptAt = new Date(now()).toISOString();
    try {
      const pointer = await fetchJson(`${base}${eventId}/latest.json`);
      if (pointer === null) {
        if (state.snapshot) throw new Error('The results feed is unavailable');
        failures = 0;
        state.status = 'unavailable';
        return;
      }
      const errors = pointerErrors(pointer);
      if (errors.length) throw new Error(`Invalid pointer: ${errors[0]}`);
      if (pointer.eventId !== eventId) throw new Error('Pointer is for another event');
      if (!feedAllowed(pointer, hostname, { serverApprovedSource })) throw new Error('Feed is not cleared for this host');
      // A cached older pointer must not move the page backwards.
      if (state.pointer && pointer.revision < state.pointer.revision) return;
      if (state.pointer && pointer.revision === state.pointer.revision && pointer.snapshotId !== state.pointer.snapshotId) {
        throw new Error('Pointer changed without a new revision');
      }
      const snapshot = await loadSnapshot(pointer.snapshotId);
      state.pointer = pointer;
      state.snapshot = snapshot;
      state.status = 'ok';
      state.error = null;
      failures = 0;
    } catch (error) {
      failures += 1;
      state.status = 'error';
      state.error = error.message;
    } finally {
      checking = false;
      if (!stopped) {
        plan();
        onChange(state);
      }
    }
  }

  return {
    state,
    check,
    loadSnapshot,
    start() {
      stopped = false;
      return check();
    },
    stop() {
      stopped = true;
      plan();
    },
    pause() {
      state.paused = true;
      plan();
      onChange(state);
    },
    resume() {
      state.paused = false;
      return check();
    },
    // Coming back to a hidden tab checks straight away. Hiding one only slows the next check.
    visibilityChanged() {
      if (stopped || state.paused) return;
      if (isHidden()) plan();
      else check();
    },
  };
}
