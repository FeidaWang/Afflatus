import { describe, expect, it } from 'vitest';
import {
  createNarrationPlayer,
  findNarrationCue,
  formatNarrationTime,
  resolveNarrationChapter,
} from '../src/lib/narrationPlayer.js';

class FakeTarget {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this.innerHTML = '';
    this.value = '0';
    this.max = '1';
    this.classList = { toggle() {} };
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type, target: this });
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
}

class FakeAudio extends FakeTarget {
  constructor(log = []) {
    super();
    this.log = log;
    this.paused = true;
    this.ended = false;
    this.currentTime = 0;
    this.duration = Number.NaN;
    this.playbackRate = 1;
    this.preload = 'none';
    this._src = '';
  }

  set src(value) { this._src = value; if (value) this.log.push('src'); }
  get src() { return this._src; }
  load() { this.log.push('load'); }
  play() {
    this.log.push('play');
    this.paused = false;
    this.ended = false;
    this.dispatch('play');
    return Promise.resolve();
  }
  pause() {
    const changed = !this.paused;
    this.paused = true;
    if (changed) this.dispatch('pause');
  }
}

function playerFixture({
  savedPosition = null,
  savedAssetId = '',
  indexAssetId = 'preview-v1',
  indexFailures = 0,
  timelineFailures = 0,
} = {}) {
  const controls = Object.fromEntries([
    'play', 'rewind', 'forward', 'rate', 'seek', 'time', 'status',
  ].map((name) => [name, new FakeTarget()]));
  const windowListeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const ownerWindow = {
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setTimeout(callback) { timerId += 1; timers.set(timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const root = new FakeTarget();
  root.ownerDocument = { defaultView: ownerWindow };
  root.querySelector = (selector) => ({
    '[data-narration-play]': controls.play,
    '[data-narration-rewind]': controls.rewind,
    '[data-narration-forward]': controls.forward,
    '[data-narration-rate]': controls.rate,
    '[data-narration-seek]': controls.seek,
    '[data-narration-time]': controls.time,
    '[data-narration-status]': controls.status,
  })[selector] || null;
  const log = [];
  const fetches = [];
  let remainingIndexFailures = indexFailures;
  let remainingTimelineFailures = timelineFailures;
  const audio = new FakeAudio(log);
  const writes = [];
  const state = {
    narration: {
      rate: 1,
      positions: savedPosition == null ? {} : {
        book: { 1: { time: savedPosition, updatedAt: 1, assetId: savedAssetId } },
      },
    },
  };
  const store = {
    getState: () => state,
    setNarrationRate(rate) { state.narration.rate = rate; },
    setNarrationPosition(bookId, chapterId, time, updatedAt, assetId) {
      writes.push({ bookId, chapterId, time, updatedAt, assetId });
      state.narration.positions[bookId] ||= {};
      state.narration.positions[bookId][String(chapterId)] = { time, updatedAt, assetId };
    },
  };
  const index = {
    chapters: {
      1: { audio: '/one.mp3', timeline: '/one.json', assetId: indexAssetId, duration: 100 },
      2: { audio: '/two.mp3', timeline: '/two.json', assetId: 'chapter-two-v1', duration: 120 },
    },
  };
  const fetchImpl = async (url) => {
    fetches.push(url);
    if (url.endsWith('/index.json') && remainingIndexFailures > 0) {
      remainingIndexFailures -= 1;
      return { ok: false, status: 503, json: async () => null };
    }
    if (!url.endsWith('/index.json') && remainingTimelineFailures > 0) {
      remainingTimelineFailures -= 1;
      return { ok: false, status: 503, json: async () => null };
    }
    return {
      ok: true,
      status: 200,
      json: async () => url.endsWith('/index.json') ? index : { cues: [] },
    };
  };
  const player = createNarrationPlayer({
    root,
    store,
    fetchImpl,
    audioFactory: () => audio,
  });
  return {
    audio,
    controls,
    fetches,
    log,
    ownerWindow,
    player,
    root,
    runNextTimer() {
      const next = timers.entries().next().value;
      if (!next) return false;
      const [id, callback] = next;
      timers.delete(id);
      callback();
      return true;
    },
    state,
    windowListeners,
    writes,
  };
}

describe('narration player helpers', () => {
  it('formats chapter-length timestamps without wrapping at one hour', () => {
    expect(formatNarrationTime(0)).toBe('0:00');
    expect(formatNarrationTime(65.9)).toBe('1:05');
    expect(formatNarrationTime(3661)).toBe('61:01');
  });

  it('finds the active cue while leaving intentional pauses unhighlighted', () => {
    const cues = [
      { id: 'a', start: 0.2, end: 1.5 },
      { id: 'b', start: 1.8, end: 3.2 },
    ];
    expect(findNarrationCue(cues, 0.1)).toBeNull();
    expect(findNarrationCue(cues, 1.2)?.id).toBe('a');
    expect(findNarrationCue(cues, 1.6)).toBeNull();
    expect(findNarrationCue(cues, 2.4)?.id).toBe('b');
    expect(findNarrationCue(cues, 3.2)).toBeNull();
  });

  it('supports object and array chapter indexes', () => {
    expect(resolveNarrationChapter({ chapters: { 1: { audio: '/one.mp3' } } }, 1)).toEqual({
      audio: '/one.mp3',
    });
    expect(resolveNarrationChapter({ chapters: [{ id: '2', audio: '/two.mp3' }] }, 2)).toEqual({
      id: '2',
      audio: '/two.mp3',
    });
  });
});

describe('narration player persistence', () => {
  it('does not overwrite a saved position before media metadata is loaded', async () => {
    const fixture = playerFixture({ savedPosition: 55, savedAssetId: 'preview-v1' });
    await fixture.player.setChapter({ bookId: 'book', chapterId: 1 });
    fixture.player.pause();
    await fixture.player.setChapter({ bookId: 'book', chapterId: 2 });
    expect(fixture.writes).toEqual([]);
    expect(fixture.state.narration.positions.book[1].time).toBe(55);
  });

  it('restores only the matching asset and saves after metadata is applied', async () => {
    const fixture = playerFixture({ savedPosition: 55, savedAssetId: 'preview-v1' });
    await fixture.player.setChapter({ bookId: 'book', chapterId: 1 });
    await fixture.player.play();
    fixture.audio.duration = 100;
    fixture.audio.dispatch('loadedmetadata');
    expect(fixture.audio.currentTime).toBe(55);
    fixture.audio.currentTime = 61;
    await fixture.player.setChapter({ bookId: 'book', chapterId: 2 });
    expect(fixture.writes.at(-1)).toMatchObject({ time: 61, assetId: 'preview-v1' });

    const changed = playerFixture({
      savedPosition: 55,
      savedAssetId: 'preview-v1',
      indexAssetId: 'full-v2',
    });
    await changed.player.setChapter({ bookId: 'book', chapterId: 1 });
    await changed.player.play();
    changed.audio.duration = 100;
    changed.audio.dispatch('loadedmetadata');
    expect(changed.audio.currentTime).toBe(0);
  });

  it('keeps a completed chapter at zero across later pause and pagehide saves', async () => {
    const fixture = playerFixture();
    await fixture.player.setChapter({ bookId: 'book', chapterId: 1 });
    await fixture.player.play();
    fixture.audio.duration = 100;
    fixture.audio.dispatch('loadedmetadata');
    fixture.audio.currentTime = 100;
    fixture.audio.ended = true;
    fixture.audio.paused = true;
    fixture.audio.dispatch('ended');
    fixture.player.pause();
    fixture.windowListeners.get('pagehide')();
    expect(fixture.writes.at(-1)).toMatchObject({ time: 0, assetId: 'preview-v1' });
  });

  it('assigns the source and calls load before play in the same action', async () => {
    const fixture = playerFixture();
    await fixture.player.setChapter({ bookId: 'book', chapterId: 1 });
    fixture.log.length = 0;
    await fixture.player.play();
    expect(fixture.log.slice(0, 3)).toEqual(['src', 'load', 'play']);
  });

  it('retries a failed timeline request without reloading the MP3', async () => {
    const fixture = playerFixture({ timelineFailures: 1 });
    await fixture.player.setChapter({ bookId: 'book', chapterId: 1 });
    await fixture.player.play();
    await Promise.resolve();
    await Promise.resolve();
    fixture.player.pause();
    await fixture.player.play();
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.fetches.filter((url) => url === '/one.json')).toHaveLength(2);
    expect(fixture.log.filter((item) => item === 'src')).toHaveLength(1);
  });

  it('automatically retries a transient chapter index failure', async () => {
    const fixture = playerFixture({ indexFailures: 1 });
    await fixture.player.setChapter({ bookId: 'book', chapterId: 1 });
    expect(fixture.root.hidden).toBe(true);
    expect(fixture.runNextTimer()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.fetches.filter((url) => url.endsWith('/index.json'))).toHaveLength(2);
    expect(fixture.root.hidden).toBe(false);
  });
});
