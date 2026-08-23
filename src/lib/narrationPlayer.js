const DEFAULT_RATES = Object.freeze([0.9, 1, 1.1, 1.25]);
const TRANSIENT_INDEX_FAILURE = Object.freeze({ transient: true });

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatNarrationTime(value) {
  const seconds = Math.max(0, Math.floor(finite(value)));
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function findNarrationCue(cues, currentTime) {
  if (!Array.isArray(cues) || !cues.length) return null;
  const time = finite(currentTime, -1);
  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (finite(cues[middle].start, Infinity) <= time) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (candidate < 0) return null;
  const cue = cues[candidate];
  return time < finite(cue.end, -1) ? cue : null;
}

export function resolveNarrationChapter(index, chapterId) {
  const chapters = index && index.chapters;
  if (!chapters) return null;
  if (Array.isArray(chapters)) {
    return chapters.find((entry) => String(entry && entry.id) === String(chapterId)) || null;
  }
  return chapters[String(chapterId)] || null;
}

function cleanTimeline(payload) {
  const cues = Array.isArray(payload && payload.cues) ? payload.cues : [];
  return cues
    .map((cue) => ({
      ...cue,
      start: finite(cue.start, -1),
      end: finite(cue.end, -1),
    }))
    .filter((cue) => cue.start >= 0 && cue.end > cue.start)
    .sort((left, right) => left.start - right.start);
}

function setPressed(button, pressed) {
  if (button) button.setAttribute('aria-pressed', String(Boolean(pressed)));
}

function supportedRate(value) {
  const candidate = finite(value, 1);
  return DEFAULT_RATES.reduce((nearest, rate) => (
    Math.abs(rate - candidate) < Math.abs(nearest - candidate) ? rate : nearest
  ), DEFAULT_RATES[0]);
}

function validChapterEntry(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.audio !== 'string' || !value.audio.startsWith('/')) return null;
  if (value.timeline && (typeof value.timeline !== 'string' || !value.timeline.startsWith('/'))) return null;
  const assetId = typeof value.assetId === 'string' && value.assetId
    ? value.assetId
    : `${value.audio}|${value.timeline || ''}`;
  return { ...value, assetId };
}

/**
 * Mount the static audiobook controls used by serial.html.
 *
 * Audio is always pre-generated. The browser only downloads an MP3 and its
 * cue timeline; no visitor credential, TTS API, or server-side GPU is needed.
 */
export function createNarrationPlayer(options) {
  const {
    root,
    store,
    fetchImpl = globalThis.fetch,
    audioFactory = () => new Audio(),
    indexUrl = (bookId) => `/audio/novels/${encodeURIComponent(bookId)}/index.json`,
    onCueChange = () => {},
    onPlaybackChange = () => {},
    onRequestAmbientPause = () => {},
  } = options || {};
  if (!root || typeof root.querySelector !== 'function') {
    throw new TypeError('Narration player requires a root element.');
  }

  const playButton = root.querySelector('[data-narration-play]');
  const rewindButton = root.querySelector('[data-narration-rewind]');
  const forwardButton = root.querySelector('[data-narration-forward]');
  const rateButton = root.querySelector('[data-narration-rate]');
  const seek = root.querySelector('[data-narration-seek]');
  const clock = root.querySelector('[data-narration-time]');
  const status = root.querySelector('[data-narration-status]');
  if (!playButton || !rewindButton || !forwardButton || !rateButton || !seek || !clock) {
    throw new Error('Narration player controls are incomplete.');
  }

  const audio = audioFactory();
  const ownerWindow = root.ownerDocument && root.ownerDocument.defaultView;
  audio.preload = 'metadata';
  const indexCache = new Map();
  let context = null;
  let entry = null;
  let cues = [];
  let activeCue = null;
  let requestVersion = 0;
  let lastSavedSecond = -1;
  let pendingRestore = 0;
  let restorePending = false;
  let hasLoadedMetadata = false;
  let mediaLoaded = false;
  let timelineRequested = false;
  let cueFrame = 0;
  let indexRetryTimer = 0;
  let indexRetryAttempts = 0;
  let indexRetryKey = '';
  let destroyed = false;

  const savedNarration = () => (store && store.getState().narration) || { rate: 1, positions: {} };
  const rates = DEFAULT_RATES;
  const nearestRate = supportedRate(savedNarration().rate);
  audio.playbackRate = nearestRate;

  function announce(message) {
    if (status) status.textContent = message;
  }

  function syncRate() {
    rateButton.textContent = `${Number(audio.playbackRate.toFixed(2))}×`;
    rateButton.setAttribute('aria-label', `当前语速 ${rateButton.textContent}；点击切换`);
  }

  function syncClock() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : finite(entry && entry.duration, 0);
    const current = Math.min(finite(audio.currentTime, 0), duration || Infinity);
    clock.textContent = `${formatNarrationTime(current)} / ${duration ? formatNarrationTime(duration) : '--:--'}`;
    seek.max = String(Math.max(1, duration || 1));
    seek.value = String(Math.max(0, current));
    seek.setAttribute('aria-valuetext', `${formatNarrationTime(current)} / ${duration ? formatNarrationTime(duration) : '未知时长'}`);
  }

  function syncPlayback() {
    const playing = !audio.paused && !audio.ended;
    playButton.innerHTML = playing
      ? '❚❚<span class="lbl"> 暂停</span>'
      : '▶<span class="lbl"> 听书</span>';
    playButton.setAttribute('aria-label', playing ? '暂停有声小说' : '播放有声小说');
    setPressed(playButton, playing);
    root.classList.toggle('is-playing', playing);
    onPlaybackChange({ playing, context, entry, audio });
  }

  function savedPosition() {
    if (!context || !entry) return 0;
    const positions = savedNarration().positions || {};
    const saved = positions[context.bookId] && positions[context.bookId][String(context.chapterId)];
    if (!saved || saved.assetId !== entry.assetId) return 0;
    return finite(saved.time, 0);
  }

  function savePosition(force = false) {
    if (!context || !entry || !mediaLoaded || !hasLoadedMetadata || restorePending ||
        !store || typeof store.setNarrationPosition !== 'function') return;
    const currentTime = audio.ended ? 0 : finite(audio.currentTime, 0);
    const second = Math.floor(currentTime);
    if (!force && (second === lastSavedSecond || second % 5 !== 0)) return;
    lastSavedSecond = second;
    store.setNarrationPosition(
      context.bookId,
      context.chapterId,
      currentTime,
      Date.now(),
      entry.assetId,
    );
  }

  function clearActiveCue() {
    if (!activeCue) return;
    activeCue = null;
    onCueChange(null, context);
  }

  function syncCue() {
    const next = findNarrationCue(cues, audio.currentTime);
    if ((next && activeCue && next.id === activeCue.id) || (!next && !activeCue)) return;
    activeCue = next;
    onCueChange(next, context);
  }

  function stopCueTracking() {
    if (!cueFrame) return;
    if (ownerWindow?.cancelAnimationFrame) ownerWindow.cancelAnimationFrame(cueFrame);
    else ownerWindow?.clearTimeout?.(cueFrame);
    cueFrame = 0;
  }

  function startCueTracking() {
    stopCueTracking();
    if (audio.paused || audio.ended) return;
    const tick = () => {
      cueFrame = 0;
      if (audio.paused || audio.ended || destroyed) return;
      syncCue();
      cueFrame = ownerWindow?.requestAnimationFrame
        ? ownerWindow.requestAnimationFrame(tick)
        : ownerWindow?.setTimeout?.(tick, 50) || 0;
    };
    cueFrame = ownerWindow?.requestAnimationFrame
      ? ownerWindow.requestAnimationFrame(tick)
      : ownerWindow?.setTimeout?.(tick, 50) || 0;
  }

  async function fetchIndex(bookId) {
    if (indexCache.has(bookId)) return indexCache.get(bookId);
    const promise = Promise.resolve()
      .then(() => fetchImpl(indexUrl(bookId), { cache: 'no-store' }))
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Narration index returned ${response.status}`);
        return response.json();
      })
      .catch(() => {
        indexCache.delete(bookId);
        return TRANSIENT_INDEX_FAILURE;
      });
    indexCache.set(bookId, promise);
    return promise;
  }

  function clearIndexRetry(resetAttempts = true) {
    if (indexRetryTimer) {
      if (ownerWindow?.clearTimeout) ownerWindow.clearTimeout(indexRetryTimer);
      else globalThis.clearTimeout?.(indexRetryTimer);
    }
    indexRetryTimer = 0;
    if (resetAttempts) indexRetryAttempts = 0;
  }

  function scheduleIndexRetry(snapshot) {
    if (indexRetryAttempts >= 2 || destroyed) return;
    clearIndexRetry(false);
    indexRetryAttempts += 1;
    const retry = () => {
      indexRetryTimer = 0;
      if (destroyed || !context || context.bookId !== snapshot.bookId ||
          String(context.chapterId) !== String(snapshot.chapterId) || entry) return;
      setChapter(snapshot);
    };
    const delay = 1200 * indexRetryAttempts;
    indexRetryTimer = ownerWindow?.setTimeout
      ? ownerWindow.setTimeout(retry, delay)
      : globalThis.setTimeout?.(retry, delay) || 0;
  }

  function unload() {
    stopCueTracking();
    audio.pause();
    audio.removeAttribute?.('src');
    audio.load?.();
    entry = null;
    cues = [];
    pendingRestore = 0;
    restorePending = false;
    hasLoadedMetadata = false;
    mediaLoaded = false;
    timelineRequested = false;
    clearActiveCue();
    root.hidden = true;
    root.removeAttribute('data-kind');
    syncPlayback();
    syncClock();
  }

  async function setChapter(nextContext) {
    const nextRetryKey = `${nextContext.bookId}:${nextContext.chapterId}`;
    if (nextRetryKey !== indexRetryKey) {
      clearIndexRetry();
      indexRetryKey = nextRetryKey;
    }
    const sameChapter = context && context.bookId === nextContext.bookId &&
      String(context.chapterId) === String(nextContext.chapterId);
    if (sameChapter && entry) return true;
    const version = ++requestVersion;
    if (context && !sameChapter) {
      savePosition(true);
      audio.pause();
      audio.removeAttribute?.('src');
      audio.load?.();
      mediaLoaded = false;
      timelineRequested = false;
    }
    context = { ...nextContext };
    entry = null;
    cues = [];
    clearActiveCue();
    root.hidden = true;
    announce('正在检查本章有声版本');

    const index = await fetchIndex(context.bookId);
    if (destroyed || version !== requestVersion) return false;
    if (index === TRANSIENT_INDEX_FAILURE) {
      unload();
      announce('有声索引暂时不可用，正在自动重试');
      scheduleIndexRetry({ ...context });
      return false;
    }
    const nextEntry = validChapterEntry(resolveNarrationChapter(index, context.chapterId));
    if (!nextEntry) {
      unload();
      return false;
    }

    entry = nextEntry;
    clearIndexRetry();
    root.hidden = false;
    root.dataset.kind = entry.kind || 'chapter';
    pendingRestore = savedPosition();
    restorePending = pendingRestore > 0;
    hasLoadedMetadata = false;
    lastSavedSecond = -1;
    audio.playbackRate = supportedRate(savedNarration().rate);
    mediaLoaded = false;
    timelineRequested = false;
    syncRate();
    syncPlayback();
    syncClock();
    announce(entry.kind === 'preview' ? '本章试听已就绪' : '本章有声版已就绪');

    return true;
  }

  function requestTimeline() {
    if (!entry?.timeline || timelineRequested || cues.length) return;
    timelineRequested = true;
    const version = requestVersion;
    Promise.resolve()
      .then(() => fetchImpl(entry.timeline, { cache: 'no-store' }))
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (destroyed || version !== requestVersion) return;
        if (!payload) {
          timelineRequested = false;
          return;
        }
        if (entry.contentSha256 && payload.contentSha256 !== entry.contentSha256) {
          cues = [];
          announce('文字版本已更新，暂不启用段落跟随');
          return;
        }
        cues = cleanTimeline(payload);
      })
      .catch(() => { timelineRequested = false; });
  }

  function ensureMediaLoaded() {
    if (!entry) return;
    if (!mediaLoaded) {
      mediaLoaded = true;
      audio.src = entry.audio;
      audio.playbackRate = supportedRate(savedNarration().rate);
      audio.load?.();
    }
    requestTimeline();
  }

  function play() {
    if (!entry) return Promise.resolve(false);
    /* Keep this synchronous with the click handler for Safari's media
       permission: the MP3 is deliberately not assigned during page load. */
    ensureMediaLoaded();
    onRequestAmbientPause();
    return Promise.resolve(audio.play())
      .then(() => {
        announce(entry.kind === 'preview' ? '正在播放本章试听' : '正在播放本章有声版');
        return true;
      })
      .catch((error) => {
        syncPlayback();
        if (!error || error.name !== 'NotAllowedError') announce('音频暂时无法播放');
        return false;
      });
  }

  function pause() {
    audio.pause();
    savePosition(true);
  }

  function seekBy(seconds) {
    if (!entry) return;
    ensureMediaLoaded();
    const duration = Number.isFinite(audio.duration) ? audio.duration : finite(entry.duration, Infinity);
    audio.currentTime = Math.max(0, Math.min(duration, finite(audio.currentTime, 0) + seconds));
    syncClock();
    syncCue();
  }

  function cycleRate() {
    const currentIndex = rates.findIndex((rate) => Math.abs(rate - audio.playbackRate) < 0.01);
    const rate = rates[(currentIndex + 1 + rates.length) % rates.length];
    audio.playbackRate = rate;
    if (store && typeof store.setNarrationRate === 'function') store.setNarrationRate(rate);
    syncRate();
    announce(`语速已切换为 ${rate} 倍`);
  }

  function onLoadedMetadata() {
    if (pendingRestore > 0 && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(pendingRestore, Math.max(0, audio.duration - 0.25));
    }
    pendingRestore = 0;
    restorePending = false;
    hasLoadedMetadata = true;
    syncClock();
    syncCue();
  }

  function onTimeUpdate() {
    syncClock();
    syncCue();
    savePosition(false);
  }

  function onEnded() {
    if (context && store && typeof store.setNarrationPosition === 'function') {
      store.setNarrationPosition(
        context.bookId,
        context.chapterId,
        0,
        Date.now(),
        entry && entry.assetId || '',
      );
    }
    lastSavedSecond = 0;
    stopCueTracking();
    clearActiveCue();
    syncPlayback();
    announce('本章播放完毕');
  }

  playButton.addEventListener('click', () => { audio.paused ? play() : pause(); });
  rewindButton.addEventListener('click', () => seekBy(-15));
  forwardButton.addEventListener('click', () => seekBy(15));
  rateButton.addEventListener('click', cycleRate);
  seek.addEventListener('input', () => {
    ensureMediaLoaded();
    audio.currentTime = finite(seek.value, 0);
    syncClock();
    syncCue();
  });
  audio.addEventListener('loadedmetadata', onLoadedMetadata);
  audio.addEventListener('durationchange', syncClock);
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('seeked', () => savePosition(true));
  audio.addEventListener('play', () => {
    syncPlayback();
    startCueTracking();
  });
  audio.addEventListener('pause', () => {
    stopCueTracking();
    syncPlayback();
  });
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', () => {
    stopCueTracking();
    audio.pause();
    mediaLoaded = false;
    hasLoadedMetadata = false;
    pendingRestore = savedPosition();
    restorePending = pendingRestore > 0;
    timelineRequested = false;
    audio.removeAttribute?.('src');
    syncPlayback();
    announce('音频载入失败，请稍后重试');
  });
  ownerWindow?.addEventListener('pagehide', () => savePosition(true));

  syncRate();
  syncPlayback();
  syncClock();

  return Object.freeze({
    audio,
    pause,
    play,
    seekBy,
    setChapter,
    destroy() {
      destroyed = true;
      requestVersion += 1;
      clearIndexRetry();
      pause();
      unload();
    },
  });
}
