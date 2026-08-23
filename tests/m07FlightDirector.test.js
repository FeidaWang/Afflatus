import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BASELINE_FLIGHT, createFlightDirector } from '../src/showcase/experience/FlightDirector.js';
import { createSceneStateStore, SCENE_STATUS } from '../src/showcase/experience/sceneState.js';
import {
  buildChapterRanges,
  CHAPTER_IDS,
  createScrollTimeline,
  normalizeScrollProgress,
  resolveChapter,
  smoothScrollProgress,
} from '../src/showcase/experience/scrollTimeline.js';

const sceneSource = readFileSync('src/showcase/experience/SignatureScene.jsx', 'utf8');
const timelineSource = readFileSync('src/showcase/experience/scrollTimeline.js', 'utf8');
const directorSource = readFileSync('src/showcase/experience/FlightDirector.js', 'utf8');

function createTimelineEnvironment() {
  const listeners = new Map();
  const tops = new Map(CHAPTER_IDS.map((id, index) => [id, index * 1000]));
  const windowScope = {
    innerHeight: 1000,
    performance: { now: () => 0 },
    scrollY: 0,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    clearTimeout: vi.fn(),
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
  };
  const documentScope = {
    body: { scrollHeight: 6000 },
    documentElement: { scrollHeight: 6000 },
    querySelector(selector) {
      const id = selector.match(/data-chapter="([^"]+)"/)?.[1];
      const top = tops.get(id);
      if (top === undefined) return null;
      return {
        offsetHeight: 1000,
        getBoundingClientRect: () => ({ height: 1000, top: top - windowScope.scrollY }),
      };
    },
  };
  return {
    dispatch(type) {
      listeners.get(type)?.forEach((listener) => listener({ type }));
    },
    documentScope,
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
    windowScope,
  };
}

describe('M07 normalized ScrollTimeline', () => {
  it('clamps document scroll to a finite zero-to-one range', () => {
    expect(normalizeScrollProgress({ scrollY: 0, scrollHeight: 6000, viewportHeight: 1000 })).toBe(0);
    expect(normalizeScrollProgress({ scrollY: 2500, scrollHeight: 6000, viewportHeight: 1000 })).toBe(0.5);
    expect(normalizeScrollProgress({ scrollY: 9000, scrollHeight: 6000, viewportHeight: 1000 })).toBe(1);
    expect(normalizeScrollProgress({ scrollY: Number.NaN })).toBe(0);
  });

  it('derives all six contiguous chapter bounds without scene pixel constants', () => {
    const ranges = buildChapterRanges(
      CHAPTER_IDS.map((id, index) => ({ id, height: 1000, top: index * 1000 })),
      { scrollHeight: 6000, viewportAnchor: 0, viewportHeight: 1000 },
    );
    expect(ranges).toHaveLength(6);
    expect(ranges.map(({ start }) => start)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(ranges.at(-1).end).toBe(1);
    expect(resolveChapter(0.199, ranges).id).toBe(CHAPTER_IDS[0]);
    expect(resolveChapter(0.2, ranges).id).toBe(CHAPTER_IDS[1]);
    expect(resolveChapter(1, ranges).id).toBe(CHAPTER_IDS[5]);
  });

  it('smooths forward and backward progress without overshoot or NaN', () => {
    const forward = smoothScrollProgress(0, 1, 1 / 60);
    const backward = smoothScrollProgress(1, 0, 1 / 60);
    expect(forward).toBeGreaterThan(0);
    expect(forward).toBeLessThan(1);
    expect(backward).toBeGreaterThan(0);
    expect(backward).toBeLessThan(1);
    expect(smoothScrollProgress(Number.NaN, Number.POSITIVE_INFINITY, 1 / 60)).toBe(0);
  });

  it('handles rapid scroll, anchor/history restoration, and removes every listener', () => {
    const environment = createTimelineEnvironment();
    const chapterChanges = [];
    const timeline = createScrollTimeline({
      ...environment,
      onChapterChange: (frame) => chapterChanges.push(frame.chapterId),
    });

    expect(environment.listenerCount()).toBe(5);
    expect(timeline.getSnapshot().chapterId).toBe(CHAPTER_IDS[0]);
    environment.windowScope.scrollY = 5000;
    environment.dispatch('scroll');
    expect(timeline.getSnapshot()).toMatchObject({ chapterId: CHAPTER_IDS[5], direction: 1, targetProgress: 1 });
    timeline.sample(0);
    const movingForward = timeline.sample(100);
    expect(movingForward.progress).toBeGreaterThan(0);
    expect(Number.isFinite(movingForward.progress)).toBe(true);

    environment.windowScope.scrollY = 1000;
    environment.dispatch('hashchange');
    expect(timeline.getSnapshot()).toMatchObject({ chapterId: CHAPTER_IDS[1], progress: 0.2 });
    environment.windowScope.scrollY = 0;
    environment.dispatch('popstate');
    expect(timeline.getSnapshot()).toMatchObject({ chapterId: CHAPTER_IDS[0], direction: -1, progress: 0 });
    expect(chapterChanges).toEqual([CHAPTER_IDS[0], CHAPTER_IDS[5], CHAPTER_IDS[1], CHAPTER_IDS[0]]);

    timeline.destroy();
    expect(environment.listenerCount()).toBe(0);
    expect(timeline.getDiagnostics()).toEqual({ destroyed: true, listenerCount: 0 });
    environment.windowScope.scrollY = 5000;
    environment.dispatch('scroll');
    expect(timeline.getSnapshot().chapterId).toBe(CHAPTER_IDS[0]);
  });
});

describe('M07 FlightDirector and readonly SceneState', () => {
  it('preserves the finite camera contract as later modules supply the route', () => {
    const director = createFlightDirector();
    const frame = director.update({
      chapterId: CHAPTER_IDS[4],
      direction: 1,
      progress: 0.78,
      targetProgress: 0.8,
    });
    expect(frame).toMatchObject({
      activeSystem: 'field-record',
      chapterCue: CHAPTER_IDS[4],
      direction: 1,
      progress: 0.78,
    });
    expect([...frame.cameraPosition, ...frame.lookAt, frame.fov, frame.exposure, frame.roll].every(Number.isFinite)).toBe(true);
    expect(frame.fov).toBeGreaterThanOrEqual(28);
    expect(frame.fov).toBeLessThanOrEqual(40);
    expect(Math.abs(frame.roll)).toBeLessThanOrEqual(0.8);
    expect(BASELINE_FLIGHT.roll).toBeLessThanOrEqual(0.8);
    expect(directorSource).toContain('sampleFlightPath');
  });

  it('publishes only changed, frozen scene snapshots', () => {
    const store = createSceneStateStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const initial = store.getSnapshot();
    expect(Object.isFrozen(initial)).toBe(true);
    store.update({ loadingState: SCENE_STATUS.POSTER });
    expect(listener).not.toHaveBeenCalled();
    store.update({ chapterId: CHAPTER_IDS[2], activeSystem: 'capital-software-intelligence' });
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toEqual({
      activeSystem: 'capital-software-intelligence',
      chapterId: CHAPTER_IDS[2],
      loadingState: SCENE_STATUS.POSTER,
    });
    unsubscribe();
    store.update({ loadingState: SCENE_STATUS.READY });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('keeps DOM reads in Timeline and React state outside the main frame', () => {
    expect(timelineSource).toContain("addEventListener?.('scroll', onScroll, { passive: true })");
    expect(timelineSource).not.toContain('requestAnimationFrame');
    expect(sceneSource).toContain('timeline.sample(now)');
    expect(sceneSource).toContain('director.update(timelineFrame)');
    expect(sceneSource).not.toMatch(/scrollY|querySelector|addEventListener\(['"]scroll/);
    const renderBody = sceneSource.slice(sceneSource.indexOf('const render ='), sceneSource.indexOf('const start ='));
    expect(renderBody).not.toMatch(/set[A-Z][A-Za-z]+\(/);
  });
});
