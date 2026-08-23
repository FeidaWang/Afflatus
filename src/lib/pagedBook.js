const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function splitCharacters(value) {
  return Array.from(String(value || ''));
}

export function createPagedBook(options) {
  const {
    stage,
    content,
    measure,
    turnLayer,
    turnFront,
    turnBack,
    pageIndicator,
    previousButton,
    nextButton,
    previousHotspot,
    nextHotspot,
    onBoundary,
    onPageChange,
    isActive = () => true,
  } = options;

  if (!stage || !content || !measure || !turnLayer || !turnFront || !turnBack) {
    throw new Error('Paged book requires a complete reader surface.');
  }

  let sourceHtml = '';
  let pages = [''];
  let pageIndex = 0;
  let hasPreviousChapter = false;
  let hasNextChapter = false;
  let animating = false;
  let animationTimer = 0;
  let resizeTimer = 0;
  let audioContext = null;
  let swipeStart = null;

  function unlockSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      if (!audioContext) audioContext = new AudioContext();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch {
      audioContext = null;
    }
    return audioContext;
  }

  function playPageSound(direction = 1) {
    const context = unlockSound();
    if (!context || context.state === 'closed') return;

    const duration = direction > 0 ? 0.42 : 0.36;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let softened = 0;

    for (let i = 0; i < frameCount; i += 1) {
      const t = i / frameCount;
      const attack = Math.min(1, t / 0.055);
      const release = Math.pow(1 - t, 1.65);
      const flutter = 0.76 + Math.sin(t * Math.PI * 13) * 0.18;
      softened = softened * 0.34 + (Math.random() * 2 - 1) * 0.66;
      channel[i] = softened * attack * release * flutter;
    }

    const source = context.createBufferSource();
    const paperFilter = context.createBiquadFilter();
    const paperGain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = direction > 0 ? 1.04 : 0.94;
    paperFilter.type = 'bandpass';
    paperFilter.Q.value = 0.72;
    paperFilter.frequency.setValueAtTime(direction > 0 ? 760 : 620, context.currentTime);
    paperFilter.frequency.exponentialRampToValueAtTime(
      direction > 0 ? 2300 : 1750,
      context.currentTime + duration * 0.72,
    );
    paperGain.gain.setValueAtTime(0.0001, context.currentTime);
    paperGain.gain.exponentialRampToValueAtTime(0.075, context.currentTime + 0.035);
    paperGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(paperFilter).connect(paperGain).connect(context.destination);

    const thump = context.createOscillator();
    const thumpGain = context.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(direction > 0 ? 92 : 78, context.currentTime);
    thump.frequency.exponentialRampToValueAtTime(48, context.currentTime + 0.085);
    thumpGain.gain.setValueAtTime(0.022, context.currentTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.1);
    thump.connect(thumpGain).connect(context.destination);

    source.start();
    source.stop(context.currentTime + duration);
    thump.start(context.currentTime + 0.015);
    thump.stop(context.currentTime + 0.11);
  }

  function syncMeasureBox() {
    const rect = content.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 120) return false;
    measure.style.width = `${Math.floor(rect.width)}px`;
    measure.style.height = `${Math.floor(rect.height)}px`;
    return true;
  }

  function measureFits() {
    return measure.scrollHeight <= measure.clientHeight + 1;
  }

  function paginate(html) {
    if (!syncMeasureBox()) return [html];

    const template = document.createElement('template');
    template.innerHTML = html;
    const output = [];
    measure.innerHTML = '';

    function flush() {
      if (!measure.childNodes.length) return;
      output.push(measure.innerHTML);
      measure.innerHTML = '';
    }

    function appendParagraphInPieces(node) {
      let remaining = splitCharacters(node.textContent);
      let consumed = Number(node.dataset.readerStart) || 0;
      let continuation = false;

      while (remaining.length) {
        let low = 1;
        let high = remaining.length;
        let best = 0;

        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const probe = node.cloneNode(false);
          if (continuation) probe.classList.add('page-continuation');
          probe.textContent = remaining.slice(0, middle).join('');
          measure.appendChild(probe);
          const fits = measureFits();
          probe.remove();
          if (fits) {
            best = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }

        best = Math.max(1, best);
        const piece = node.cloneNode(false);
        if (continuation) piece.classList.add('page-continuation');
        piece.textContent = remaining.slice(0, best).join('');
        piece.dataset.readerStart = String(consumed);
        piece.dataset.readerEnd = String(consumed + best);
        measure.appendChild(piece);
        remaining = remaining.slice(best);
        consumed += best;
        continuation = true;
        if (remaining.length) flush();
      }
    }

    function appendSystemInPieces(node) {
      const sourceBody = node.querySelector('.sys-body');
      if (!sourceBody) {
        node.classList.add('page-oversize');
        measure.appendChild(node);
        flush();
        return;
      }
      let remaining = splitCharacters(sourceBody.textContent);
      const blockStart = Number(node.dataset.readerStart) || 0;
      const bodyStart = Number(node.dataset.readerBodyStart) || blockStart;
      let consumed = 0;
      let continuation = false;

      while (remaining.length) {
        let low = 1;
        let high = remaining.length;
        let best = 0;

        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const probe = node.cloneNode(true);
          probe.querySelector('.sys-body').textContent = remaining.slice(0, middle).join('');
          if (continuation) probe.classList.add('page-continuation');
          measure.appendChild(probe);
          const fits = measureFits();
          probe.remove();
          if (fits) {
            best = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }

        best = Math.max(1, best);
        const piece = node.cloneNode(true);
        piece.querySelector('.sys-body').textContent = remaining.slice(0, best).join('');
        if (continuation) piece.classList.add('page-continuation');
        piece.dataset.readerStart = String(continuation ? bodyStart + consumed : blockStart);
        piece.dataset.readerEnd = String(bodyStart + consumed + best);
        measure.appendChild(piece);
        remaining = remaining.slice(best);
        consumed += best;
        continuation = true;
        flush();
      }
    }

    for (const sourceNode of Array.from(template.content.children)) {
      const node = sourceNode.cloneNode(true);
      measure.appendChild(node);
      if (measureFits()) continue;
      node.remove();

      if (measure.childNodes.length) flush();
      measure.appendChild(node);
      if (measureFits()) continue;
      node.remove();

      if (node.tagName === 'P') {
        appendParagraphInPieces(node);
      } else if (node.matches('.sys')) {
        appendSystemInPieces(node);
      } else {
        node.classList.add('page-oversize');
        measure.appendChild(node);
        flush();
      }
    }

    flush();
    return output.length ? output : [''];
  }

  function updateControls() {
    const atFirst = pageIndex === 0 && !hasPreviousChapter;
    const atLast = pageIndex === pages.length - 1 && !hasNextChapter;
    for (const button of [previousButton, previousHotspot]) {
      if (button) button.disabled = atFirst;
    }
    for (const button of [nextButton, nextHotspot]) {
      if (button) button.disabled = atLast;
    }
    if (pageIndicator) {
      pageIndicator.textContent = `第 ${pageIndex + 1} / ${pages.length} 页`;
    }
  }

  function notifyPageChange() {
    updateControls();
    if (typeof onPageChange === 'function') {
      onPageChange({
        pageIndex,
        pageCount: pages.length,
      });
    }
  }

  function renderPage() {
    content.innerHTML = pages[pageIndex] || '';
    notifyPageChange();
  }

  function clearAnimation() {
    clearTimeout(animationTimer);
    stage.classList.remove('is-turning-next', 'is-turning-previous');
    turnFront.innerHTML = '';
    turnBack.innerHTML = '';
    animating = false;
  }

  function animate(direction, previousHtml, nextHtml, withSound = true) {
    clearAnimation();
    if (withSound) playPageSound(direction);

    if (matchMedia(REDUCED_MOTION).matches) return;
    animating = true;
    turnFront.innerHTML = previousHtml;
    turnBack.innerHTML = nextHtml;
    void turnLayer.offsetWidth;
    stage.classList.add(direction > 0 ? 'is-turning-next' : 'is-turning-previous');
    const finish = (event) => {
      if (event && event.target !== turnLayer) return;
      turnLayer.removeEventListener('animationend', finish);
      clearAnimation();
    };
    turnLayer.addEventListener('animationend', finish);
    animationTimer = window.setTimeout(finish, 820);
  }

  function setChapterContext(context = {}) {
    hasPreviousChapter = Boolean(context.hasPreviousChapter);
    hasNextChapter = Boolean(context.hasNextChapter);
    updateControls();
  }

  function setContent(html, settings = {}) {
    const previousHtml = content.innerHTML;
    sourceHtml = String(html || '');
    pages = paginate(sourceHtml);
    pageIndex = settings.pageIndex === 'last'
      ? pages.length - 1
      : clamp(Number(settings.pageIndex) || 0, 0, pages.length - 1);
    renderPage();
    if (settings.direction && previousHtml) {
      animate(settings.direction, previousHtml, content.innerHTML, settings.withSound !== false);
    }
    return { pageIndex, pageCount: pages.length };
  }

  function turn(direction) {
    if (animating || !direction) return false;
    unlockSound();
    const target = pageIndex + (direction > 0 ? 1 : -1);
    if (target >= 0 && target < pages.length) {
      const previousHtml = content.innerHTML;
      pageIndex = target;
      renderPage();
      animate(direction, previousHtml, content.innerHTML);
      return true;
    }
    if (typeof onBoundary === 'function') {
      return onBoundary(direction > 0 ? 1 : -1) !== false;
    }
    return false;
  }

  function repaginate() {
    if (!sourceHtml || animating) return;
    const oldCount = pages.length;
    const oldIndex = pageIndex;
    pages = paginate(sourceHtml);
    const ratio = oldCount > 1 ? oldIndex / (oldCount - 1) : 0;
    pageIndex = clamp(Math.round(ratio * Math.max(0, pages.length - 1)), 0, pages.length - 1);
    renderPage();
  }

  function open(title) {
    unlockSound();
    stage.dataset.coverTitle = title ? `《${title}》` : '小说连载';
    stage.classList.remove('is-opening');
    void stage.offsetWidth;
    stage.classList.add('is-opening');
    playPageSound(1);
    window.setTimeout(() => stage.classList.remove('is-opening'), 940);
  }

  function getState() {
    return { pageIndex, pageCount: pages.length };
  }

  function revealMarker(marker, settings = {}) {
    const value = String(marker || '');
    if (!value) return false;
    const sourceOffset = Number(settings.sourceOffset);
    const hasSourceOffset = Number.isFinite(sourceOffset);
    const template = document.createElement('template');
    const target = pages.findIndex((html) => {
      template.innerHTML = html;
      return Array.from(template.content.querySelectorAll('[data-page-marker]'))
        .some((node) => {
          if (node.getAttribute('data-page-marker') !== value) return false;
          if (!hasSourceOffset) return true;
          const start = Number(node.dataset.readerStart);
          const end = Number(node.dataset.readerEnd);
          return Number.isFinite(start) && Number.isFinite(end) &&
            sourceOffset >= start && sourceOffset < end;
        });
    });
    if (target < 0) return false;
    if (target === pageIndex) return true;
    const previousHtml = content.innerHTML;
    const direction = target > pageIndex ? 1 : -1;
    pageIndex = target;
    renderPage();
    if (settings.animate) {
      animate(direction, previousHtml, content.innerHTML, settings.withSound === true);
    }
    return true;
  }

  function onPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button, a')) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 54 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    turn(dx < 0 ? 1 : -1);
  }

  function onKeyDown(event) {
    if (!isActive()) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      turn(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      turn(-1);
    }
  }

  previousButton?.addEventListener('click', () => turn(-1));
  nextButton?.addEventListener('click', () => turn(1));
  previousHotspot?.addEventListener('click', () => turn(-1));
  nextHotspot?.addEventListener('click', () => turn(1));
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', () => { swipeStart = null; });
  document.addEventListener('keydown', onKeyDown);

  const resizeObserver = window.ResizeObserver
    ? new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(repaginate, 120);
    })
    : null;
  resizeObserver?.observe(content);
  document.fonts?.ready?.then(repaginate).catch(() => {});
  updateControls();

  return Object.freeze({
    getState,
    open,
    repaginate,
    revealMarker,
    setChapterContext,
    setContent,
    turn,
    unlockSound,
  });
}
