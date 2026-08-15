import {
  CITY_DEVICE_AUDIT_TARGET_MS,
  cityDeviceOrientation,
  pickCityDeviceAuditTelemetry,
  summarizeCityDeviceAudit,
} from '../city/deviceAudit.ts';

const SAMPLE_INTERVAL_MS = 1_000;

function currentLanguage() {
  return document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function translated(en, zh) {
  return currentLanguage() === 'zh' ? zh : en;
}

function sorted(values) {
  return [...values].sort();
}

function performanceHeapBytes() {
  const memory = performance.memory;
  return Number.isFinite(memory?.usedJSHeapSize) ? memory.usedJSHeapSize : null;
}

function environmentSnapshot() {
  return Object.freeze({
    userAgent: navigator.userAgent,
    platform: navigator.userAgentData?.platform ?? navigator.platform ?? 'unknown',
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : null,
    deviceMemoryGiB: Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null,
    maxTouchPoints: Number.isFinite(navigator.maxTouchPoints) ? navigator.maxTouchPoints : 0,
    screen: Object.freeze({ width: screen.width, height: screen.height }),
    initialViewport: Object.freeze({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown',
    robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
  });
}

function safeFilenamePart(value) {
  return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'unknown';
}

export function mountCityDeviceAudit({
  getPlanSummary,
  getTelemetry,
  targetDurationMs = CITY_DEVICE_AUDIT_TARGET_MS,
}) {
  const panel = document.querySelector('[data-city-device-audit]');
  const stage = document.querySelector('[data-city-stage]');
  const canvas = document.querySelector('[data-city-canvas]');
  const timeline = document.querySelector('[data-city-timeline]');
  const playButton = document.querySelector('[data-city-play]');
  const tourButton = document.querySelector('[data-city-tour]');
  const labelInput = document.querySelector('[data-city-device-label]');
  const startButton = document.querySelector('[data-city-device-start]');
  const finishButton = document.querySelector('[data-city-device-finish]');
  const elapsedOutput = document.querySelector('[data-city-device-elapsed]');
  const sampleOutput = document.querySelector('[data-city-device-samples]');
  const status = document.querySelector('[data-city-device-status]');
  if (!panel || !labelInput || !startButton || !finishButton) return null;

  let audit = null;
  let latestReport = null;
  let sampleTimer = 0;
  const touchPointerIds = new Set();
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  panel.hidden = false;
  stage?.setAttribute('data-city-device-audit-mode', 'true');
  startButton.disabled = false;

  function setAuditStatus(en, zh) {
    if (!status) return;
    status.dataset.en = en;
    status.dataset.zh = zh;
    status.textContent = translated(en, zh);
  }

  function elapsedMs() {
    return audit ? Math.max(0, performance.now() - audit.startedAtMonotonic) : 0;
  }

  function renderProgress() {
    const elapsed = elapsedMs();
    const minutes = Math.floor(elapsed / 60_000);
    const seconds = Math.floor((elapsed % 60_000) / 1_000);
    if (elapsedOutput) elapsedOutput.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (sampleOutput) sampleOutput.textContent = String(audit?.samples.length ?? 0);
  }

  function rememberCurrentModes() {
    if (!audit) return;
    audit.languages.add(currentLanguage());
    audit.orientations.add(cityDeviceOrientation(window.innerWidth, window.innerHeight));
    audit.reducedMotionModes.add(reducedMotionQuery.matches ? 'reduce' : 'no-preference');
    audit.visibilityStates.add(document.hidden ? 'hidden' : 'visible');
    audit.maxScrollY = Math.max(audit.maxScrollY, window.scrollY);
  }

  function captureSample(reason = 'interval') {
    if (!audit) return null;
    rememberCurrentModes();
    const telemetry = pickCityDeviceAuditTelemetry(getTelemetry?.());
    const sample = Object.freeze({
      elapsedMs: Math.round(elapsedMs()),
      heapBytes: performanceHeapBytes(),
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      language: currentLanguage(),
      orientation: cityDeviceOrientation(window.innerWidth, window.innerHeight),
      reducedMotion: reducedMotionQuery.matches,
      telemetry,
      viewport: Object.freeze({ width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }),
      visibility: document.hidden ? 'hidden' : 'visible',
    });
    audit.samples.push(sample);
    if (reason !== 'interval') {
      audit.events.push(Object.freeze({ elapsedMs: sample.elapsedMs, type: 'sample', reason }));
    }
    renderProgress();
    return sample;
  }

  function recordEvent(type, value = null) {
    if (!audit) return;
    audit.events.push(Object.freeze({ elapsedMs: Math.round(elapsedMs()), type, value }));
  }

  function start(deviceLabel = labelInput.value) {
    if (audit) return false;
    labelInput.value = deviceLabel.trim();
    if (!labelInput.value) {
      labelInput.setCustomValidity(translated('Enter the physical device, OS and browser.', '请输入实体设备、系统与浏览器。'));
      labelInput.reportValidity();
      return false;
    }
    labelInput.setCustomValidity('');
    latestReport = null;
    audit = {
      startedAtIso: new Date().toISOString(),
      startedAtMonotonic: performance.now(),
      environment: environmentSnapshot(),
      events: [],
      samples: [],
      backgroundTransitions: 0,
      buildActions: 0,
      canvasTouchStarts: 0,
      languages: new Set(),
      maxConcurrentTouchPointers: 0,
      maxScrollY: 0,
      orientations: new Set(),
      reducedMotionModes: new Set(),
      timelineScrubs: 0,
      tourActions: 0,
      visibilityStates: new Set(),
    };
    labelInput.disabled = true;
    startButton.disabled = true;
    finishButton.disabled = false;
    captureSample('start');
    sampleTimer = window.setInterval(captureSample, SAMPLE_INTERVAL_MS);
    setAuditStatus(
      'Recording locally. Exercise both orientations, touch orbit, pinch, timeline, Build, Tour, EN/中文, reduced motion and background recovery.',
      '正在本地记录。请测试横竖屏、触摸环绕、双指缩放、时间轴、建设、巡游、中英文、减少动态与前后台恢复。',
    );
    return true;
  }

  function finish() {
    if (!audit) return latestReport;
    window.clearInterval(sampleTimer);
    sampleTimer = 0;
    captureSample('finish');
    const plan = getPlanSummary?.() ?? {};
    latestReport = summarizeCityDeviceAudit({
      deviceLabel: labelInput.value,
      endedAt: new Date().toISOString(),
      environment: audit.environment,
      events: audit.events,
      interactions: {
        backgroundTransitions: audit.backgroundTransitions,
        buildActions: audit.buildActions,
        canvasTouchStarts: audit.canvasTouchStarts,
        languages: sorted(audit.languages),
        maxConcurrentTouchPointers: audit.maxConcurrentTouchPointers,
        maxScrollY: audit.maxScrollY,
        orientations: sorted(audit.orientations),
        reducedMotionModes: sorted(audit.reducedMotionModes),
        timelineScrubs: audit.timelineScrubs,
        tourActions: audit.tourActions,
        visibilityStates: sorted(audit.visibilityStates),
      },
      measuredDurationMs: elapsedMs(),
      profile: plan.profile ?? 'unknown',
      samples: audit.samples,
      seed: plan.seed ?? 'unknown',
      startedAt: audit.startedAtIso,
      targetDurationMs,
    });
    audit = null;
    labelInput.disabled = false;
    startButton.disabled = false;
    finishButton.disabled = true;
    setAuditStatus(
      latestReport.readyForReview
        ? 'Report is complete and ready for engineering review. Nothing was uploaded.'
        : 'Report saved with incomplete checks. Review the JSON checklist and repeat before sign-off.',
      latestReport.readyForReview
        ? '报告已完成，可进入工程审查。没有上传任何数据。'
        : '报告已保存，但仍有未完成检查。请查看 JSON 清单并在签署前重测。',
    );
    return latestReport;
  }

  async function shareOrDownload(report = latestReport ?? finish()) {
    if (!report) return false;
    const json = `${JSON.stringify(report, null, 2)}\n`;
    const filename = `cityview-device-${safeFilenamePart(report.profile)}-${safeFilenamePart(report.deviceLabel)}.json`;
    const file = new File([json], filename, { type: 'application/json' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Cityview physical-device audit' });
      return true;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return true;
  }

  function onCanvasPointerDown(event) {
    if (!audit || event.pointerType !== 'touch') return;
    touchPointerIds.add(event.pointerId);
    audit.canvasTouchStarts += 1;
    audit.maxConcurrentTouchPointers = Math.max(audit.maxConcurrentTouchPointers, touchPointerIds.size);
    recordEvent('canvas-touch-start', touchPointerIds.size);
  }

  function onCanvasPointerEnd(event) {
    touchPointerIds.delete(event.pointerId);
  }

  function onTimelineInput() {
    if (!audit) return;
    audit.timelineScrubs += 1;
    recordEvent('timeline-scrub', Number(timeline?.value));
  }

  function onBuildAction() {
    if (!audit) return;
    audit.buildActions += 1;
    recordEvent('build-action');
  }

  function onTourAction() {
    if (!audit) return;
    audit.tourActions += 1;
    recordEvent('tour-action');
  }

  function onLanguageChange() {
    if (!audit) return;
    rememberCurrentModes();
    recordEvent('language', currentLanguage());
    renderProgress();
  }

  function onReducedMotionChange() {
    if (!audit) return;
    rememberCurrentModes();
    recordEvent('reduced-motion', reducedMotionQuery.matches);
    captureSample('reduced-motion-change');
  }

  function onVisibilityChange() {
    if (!audit) return;
    audit.backgroundTransitions += 1;
    rememberCurrentModes();
    recordEvent('visibility', document.hidden ? 'hidden' : 'visible');
    captureSample('visibility-change');
  }

  function onViewportChange() {
    if (!audit) return;
    rememberCurrentModes();
    recordEvent('viewport', `${window.innerWidth}x${window.innerHeight}`);
    captureSample('viewport-change');
  }

  function onScroll() {
    if (!audit) return;
    audit.maxScrollY = Math.max(audit.maxScrollY, window.scrollY);
  }

  startButton.addEventListener('click', () => start());
  finishButton.addEventListener('click', () => {
    void shareOrDownload().catch(() => {
      setAuditStatus(
        'Sharing was cancelled. The completed report remains available until this page closes.',
        '分享已取消。完成的报告会保留到本页面关闭为止。',
      );
    });
  });
  canvas?.addEventListener('pointerdown', onCanvasPointerDown);
  window.addEventListener('pointerup', onCanvasPointerEnd);
  window.addEventListener('pointercancel', onCanvasPointerEnd);
  timeline?.addEventListener('input', onTimelineInput);
  playButton?.addEventListener('click', onBuildAction);
  tourButton?.addEventListener('click', onTourAction);
  window.addEventListener('afflatus-lang', onLanguageChange);
  reducedMotionQuery.addEventListener('change', onReducedMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onScroll, { passive: true });
  setAuditStatus('Not recording. Enter the physical device, OS and browser.', '尚未记录。请输入实体设备、系统与浏览器。');
  renderProgress();

  const controller = Object.freeze({
    captureSample,
    finish,
    getReport: () => latestReport,
    getState: () => Object.freeze({ active: Boolean(audit), samples: audit?.samples.length ?? latestReport?.samples.length ?? 0 }),
    shareOrDownload,
    start,
    destroy() {
      window.clearInterval(sampleTimer);
      sampleTimer = 0;
      canvas?.removeEventListener('pointerdown', onCanvasPointerDown);
      window.removeEventListener('pointerup', onCanvasPointerEnd);
      window.removeEventListener('pointercancel', onCanvasPointerEnd);
      timeline?.removeEventListener('input', onTimelineInput);
      playButton?.removeEventListener('click', onBuildAction);
      tourButton?.removeEventListener('click', onTourAction);
      window.removeEventListener('afflatus-lang', onLanguageChange);
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onScroll);
    },
  });
  Object.defineProperty(window, '__AFFLATUS_CITY_DEVICE_AUDIT__', {
    configurable: true,
    value: controller,
  });
  return controller;
}
