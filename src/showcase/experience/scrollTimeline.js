export const CHAPTER_IDS = Object.freeze([
  '01-cold-void',
  '02-the-approach',
  '03-parallel-drift',
  '04-bridge-aperture',
  '05-the-wake',
  '06-departure',
]);

const DEFAULT_RESPONSE = 10;
const DEFAULT_VIEWPORT_ANCHOR = 0.45;
const PROGRESS_EPSILON = 0.00001;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampProgress(value) {
  return Math.min(1, Math.max(0, finiteNumber(value)));
}

export function normalizeScrollProgress({ scrollY = 0, scrollHeight = 0, viewportHeight = 0 } = {}) {
  const rawScrollableDistance = finiteNumber(scrollHeight) - finiteNumber(viewportHeight);
  if (rawScrollableDistance <= 0) return 0;
  const scrollableDistance = Math.max(1, rawScrollableDistance);
  const safeScrollY = Math.max(0, finiteNumber(scrollY));
  if (safeScrollY > 0 && scrollableDistance - safeScrollY <= 1) return 1;
  return clampProgress(safeScrollY / scrollableDistance);
}

export function smoothScrollProgress(current, target, deltaSeconds, response = DEFAULT_RESPONSE) {
  const safeCurrent = clampProgress(current);
  const safeTarget = clampProgress(target);
  const delta = Math.min(0.1, Math.max(0, finiteNumber(deltaSeconds)));
  const rate = Math.max(0, finiteNumber(response, DEFAULT_RESPONSE));
  if (Math.abs(safeTarget - safeCurrent) <= PROGRESS_EPSILON || delta === 0 || rate === 0) {
    return delta === 0 || rate === 0 ? safeCurrent : safeTarget;
  }
  const alpha = 1 - Math.exp(-rate * delta);
  return clampProgress(safeCurrent + (safeTarget - safeCurrent) * alpha);
}

export function buildChapterRanges(
  measurements,
  { scrollHeight = 0, viewportHeight = 0, viewportAnchor = DEFAULT_VIEWPORT_ANCHOR } = {},
) {
  const measuredById = new Map(
    (Array.isArray(measurements) ? measurements : []).map((measurement) => [measurement.id, measurement]),
  );
  const scrollableDistance = Math.max(1, finiteNumber(scrollHeight) - finiteNumber(viewportHeight));
  const anchorOffset = Math.max(0, finiteNumber(viewportHeight)) * clampProgress(viewportAnchor);
  const starts = CHAPTER_IDS.map((id, index) => {
    const measurement = measuredById.get(id);
    if (!measurement) return index / CHAPTER_IDS.length;
    return clampProgress((finiteNumber(measurement.top) - anchorOffset) / scrollableDistance);
  });

  starts[0] = 0;
  for (let index = 1; index < starts.length; index += 1) {
    starts[index] = Math.max(starts[index - 1], starts[index]);
  }

  return Object.freeze(CHAPTER_IDS.map((id, index) => Object.freeze({
    id,
    index,
    start: starts[index],
    end: index === CHAPTER_IDS.length - 1 ? 1 : starts[index + 1],
  })));
}

export function resolveChapter(progress, ranges) {
  const safeProgress = clampProgress(progress);
  const safeRanges = Array.isArray(ranges) && ranges.length
    ? ranges
    : buildChapterRanges([]);
  let range = safeRanges[0];
  for (let index = safeRanges.length - 1; index >= 0; index -= 1) {
    if (safeProgress + PROGRESS_EPSILON >= safeRanges[index].start) {
      range = safeRanges[index];
      break;
    }
  }
  const span = Math.max(PROGRESS_EPSILON, range.end - range.start);
  return Object.freeze({
    id: range.id,
    index: range.index,
    localProgress: clampProgress((safeProgress - range.start) / span),
  });
}

function readDocumentHeight(documentScope) {
  return Math.max(
    finiteNumber(documentScope?.documentElement?.scrollHeight),
    finiteNumber(documentScope?.body?.scrollHeight),
  );
}

export function measureChapterRanges(documentScope = document, windowScope = window) {
  const scrollY = finiteNumber(windowScope?.scrollY);
  const measurements = CHAPTER_IDS.flatMap((id) => {
    const element = documentScope?.querySelector?.(`[data-chapter="${id}"]`);
    if (!element) return [];
    const rect = element.getBoundingClientRect();
    return [{
      id,
      top: finiteNumber(rect.top) + scrollY,
      height: finiteNumber(rect.height, element.offsetHeight),
    }];
  });
  return buildChapterRanges(measurements, {
    scrollHeight: readDocumentHeight(documentScope),
    viewportHeight: finiteNumber(windowScope?.innerHeight),
  });
}

function createFrame(progress, targetProgress, ranges, direction) {
  const targetChapter = resolveChapter(targetProgress, ranges);
  const journeyChapter = resolveChapter(progress, ranges);
  return {
    progress: clampProgress(progress),
    targetProgress: clampProgress(targetProgress),
    direction,
    chapterId: targetChapter.id,
    chapterIndex: targetChapter.index,
    chapterProgress: targetChapter.localProgress,
    journeyChapterId: journeyChapter.id,
    journeyChapterProgress: journeyChapter.localProgress,
  };
}

export function createScrollTimeline({
  documentScope = document,
  onChapterChange,
  response = DEFAULT_RESPONSE,
  windowScope = window,
} = {}) {
  let destroyed = false;
  let deferredSync = 0;
  let lastSampleTime = null;
  let ranges = measureChapterRanges(documentScope, windowScope);
  let targetProgress = normalizeScrollProgress({
    scrollY: windowScope.scrollY,
    scrollHeight: readDocumentHeight(documentScope),
    viewportHeight: windowScope.innerHeight,
  });
  let progress = targetProgress;
  let direction = 0;
  let lastAnnouncedChapter = null;
  let frame = createFrame(progress, targetProgress, ranges, direction);

  const announceChapter = () => {
    if (frame.chapterId === lastAnnouncedChapter) return;
    lastAnnouncedChapter = frame.chapterId;
    onChapterChange?.(Object.freeze({ ...frame }));
  };

  const syncTarget = ({ snap = false } = {}) => {
    if (destroyed) return;
    const nextTarget = normalizeScrollProgress({
      scrollY: windowScope.scrollY,
      scrollHeight: readDocumentHeight(documentScope),
      viewportHeight: windowScope.innerHeight,
    });
    if (nextTarget > targetProgress + PROGRESS_EPSILON) direction = 1;
    else if (nextTarget < targetProgress - PROGRESS_EPSILON) direction = -1;
    targetProgress = nextTarget;
    if (snap) progress = targetProgress;
    frame = createFrame(progress, targetProgress, ranges, direction);
    announceChapter();
  };

  const refresh = ({ snap = false } = {}) => {
    if (destroyed) return;
    ranges = measureChapterRanges(documentScope, windowScope);
    syncTarget({ snap });
  };

  const deferSync = () => {
    windowScope.clearTimeout?.(deferredSync);
    deferredSync = windowScope.setTimeout?.(() => refresh({ snap: true }), 0) || 0;
  };

  const onScroll = () => syncTarget();
  const onResize = () => refresh();
  windowScope.addEventListener?.('scroll', onScroll, { passive: true });
  windowScope.addEventListener?.('resize', onResize, { passive: true });
  windowScope.addEventListener?.('hashchange', deferSync);
  windowScope.addEventListener?.('popstate', deferSync);
  windowScope.addEventListener?.('pageshow', deferSync);
  announceChapter();

  return Object.freeze({
    destroy() {
      if (destroyed) return;
      destroyed = true;
      windowScope.clearTimeout?.(deferredSync);
      windowScope.removeEventListener?.('scroll', onScroll);
      windowScope.removeEventListener?.('resize', onResize);
      windowScope.removeEventListener?.('hashchange', deferSync);
      windowScope.removeEventListener?.('popstate', deferSync);
      windowScope.removeEventListener?.('pageshow', deferSync);
    },
    getDiagnostics() {
      return Object.freeze({ destroyed, listenerCount: destroyed ? 0 : 5 });
    },
    getRanges() {
      return ranges;
    },
    getSnapshot() {
      return Object.freeze({ ...frame });
    },
    refresh,
    sample(now = windowScope.performance?.now?.() ?? 0) {
      if (destroyed) return frame;
      const timestamp = finiteNumber(now);
      const deltaSeconds = lastSampleTime === null
        ? 0
        : Math.max(0, (timestamp - lastSampleTime) / 1000);
      lastSampleTime = timestamp;
      progress = smoothScrollProgress(progress, targetProgress, deltaSeconds, response);
      if (Math.abs(targetProgress - progress) <= PROGRESS_EPSILON) {
        progress = targetProgress;
        direction = 0;
      }
      frame = createFrame(progress, targetProgress, ranges, direction);
      return frame;
    },
    syncTarget,
  });
}
