const DURATION_MS = 5200;
const IMPACT_START_MS = 3400;
const IMPACT_END_MS = 4800;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (from, to, value) => {
  const t = clamp((value - from) / Math.max(1, to - from));
  return t * t * (3 - 2 * t);
};

export const HOME_FLAGSHIP_NARRATIVE_DURATION_MS = DURATION_MS;

export function sampleHomeFlagshipNarrative(elapsedMs, { terminal = false } = {}) {
  const elapsed = terminal ? DURATION_MS : clamp(Number(elapsedMs) || 0, 0, DURATION_MS);
  const reveal = smoothstep(180, 1850, elapsed);
  const ignition = smoothstep(1650, 2550, elapsed);
  const engineSettle = smoothstep(2550, 3300, elapsed);
  const impactProgress = clamp((elapsed - IMPACT_START_MS) / (IMPACT_END_MS - IMPACT_START_MS));
  const impactActive = elapsed >= IMPACT_START_MS && elapsed < IMPACT_END_MS;
  const shieldPulse = impactActive
    ? (impactProgress < 0.16
      ? smoothstep(0, 0.16, impactProgress)
      : 1 - smoothstep(0.16, 1, impactProgress))
    : 0;

  return Object.freeze({
    phase: elapsed < 1650 ? 'emergence'
      : elapsed < IMPACT_START_MS ? 'ignition'
        : elapsed < IMPACT_END_MS ? 'impact' : 'settled',
    elapsed,
    reveal,
    travel: smoothstep(520, 3200, elapsed),
    lensEnergy: reveal * (1 - smoothstep(900, 2550, elapsed)),
    enginePower: ignition * lerp(1, 0.64, engineSettle),
    shieldPulse,
    rippleProgress: impactActive ? smoothstep(0, 0.88, impactProgress) : 0,
    impactFlash: impactActive ? 1 - smoothstep(0, 0.24, impactProgress) : 0,
  });
}

function hexagon(ctx, x, y, radius) {
  ctx.beginPath();
  for (let side = 0; side < 6; side += 1) {
    const angle = Math.PI / 3 * side;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (!side) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawLensWake(ctx, x, y, width, energy) {
  if (energy <= 0.002) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1;
  for (let ring = 0; ring < 3; ring += 1) {
    const radius = width * (0.08 + ring * 0.045 + (1 - energy) * 0.08);
    ctx.strokeStyle = `rgba(${ring === 1 ? '244,188,126' : '144,224,255'},${energy * (0.24 - ring * 0.045)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.54, -0.14, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawThrusters(ctx, power, now) {
  if (power <= 0.002) return;
  const flicker = 0.92 + Math.sin(now * 0.047) * 0.05 + Math.sin(now * 0.013) * 0.03;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const y of [-42, 0, 42]) {
    const length = (145 + (y ? 0 : 32)) * power * flicker;
    const plume = ctx.createLinearGradient(-382, y, -382 - length, y);
    plume.addColorStop(0, `rgba(226,253,255,${0.78 * power})`);
    plume.addColorStop(0.24, `rgba(104,218,255,${0.48 * power})`);
    plume.addColorStop(1, 'rgba(63,137,255,0)');
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(-376, y - 12);
    ctx.quadraticCurveTo(-420 - length * 0.56, y - 5, -382 - length, y);
    ctx.quadraticCurveTo(-420 - length * 0.56, y + 5, -376, y + 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawFlagshipHull(ctx, alpha, now, enginePower) {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawThrusters(ctx, enginePower, now);

  const hullGradient = ctx.createLinearGradient(0, -105, 0, 100);
  hullGradient.addColorStop(0, '#91a1af');
  hullGradient.addColorStop(0.12, '#586877');
  hullGradient.addColorStop(0.55, '#263440');
  hullGradient.addColorStop(1, '#0a1119');
  ctx.fillStyle = hullGradient;
  ctx.beginPath();
  ctx.moveTo(-392, -58);
  ctx.lineTo(-318, -86);
  ctx.lineTo(82, -96);
  ctx.lineTo(276, -70);
  ctx.lineTo(430, -18);
  ctx.lineTo(448, 0);
  ctx.lineTo(414, 22);
  ctx.lineTo(270, 72);
  ctx.lineTo(36, 96);
  ctx.lineTo(-318, 86);
  ctx.lineTo(-392, 55);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.clip();
  const deckLight = ctx.createLinearGradient(-300, 0, 420, 0);
  deckLight.addColorStop(0, 'rgba(116,202,238,.03)');
  deckLight.addColorStop(0.58, 'rgba(171,222,242,.2)');
  deckLight.addColorStop(1, 'rgba(232,179,128,.12)');
  ctx.fillStyle = deckLight;
  ctx.fillRect(-420, -96, 880, 54);
  ctx.strokeStyle = 'rgba(5,10,16,.62)';
  ctx.lineWidth = 1.2;
  for (const y of [-53, -25, 8, 37, 64]) {
    ctx.beginPath(); ctx.moveTo(-365, y); ctx.lineTo(390, y * 0.72); ctx.stroke();
  }
  for (const x of [-300, -215, -128, -42, 48, 142, 232, 318]) {
    ctx.beginPath(); ctx.moveTo(x, -88); ctx.lineTo(x - 17, 82); ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#344552';
  ctx.beginPath();
  ctx.moveTo(-250, -84); ctx.lineTo(-84, -124); ctx.lineTo(76, -111); ctx.lineTo(142, -84); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#405361';
  ctx.beginPath();
  ctx.moveTo(-174, -113); ctx.lineTo(-72, -151); ctx.lineTo(15, -143); ctx.lineTo(58, -112); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(179,220,239,.46)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-390, -58); ctx.lineTo(-318, -86); ctx.lineTo(82, -96); ctx.lineTo(276, -70); ctx.lineTo(430, -18); ctx.stroke();

  ctx.fillStyle = 'rgba(172,237,255,.76)';
  for (const x of [-145, -112, -79, -46, -13]) ctx.fillRect(x, -132, 16, 2.4);
  ctx.fillStyle = 'rgba(255,210,146,.68)';
  for (const x of [-270, -210, -148, -86, 12, 84, 158, 234]) ctx.fillRect(x, 24 + (x % 3) * 4, 8, 2);

  for (const y of [-42, 0, 42]) {
    const bell = ctx.createRadialGradient(-388, y, 0, -388, y, 18);
    bell.addColorStop(0, enginePower > 0.02 ? 'rgba(236,255,255,.96)' : 'rgba(32,59,75,.7)');
    bell.addColorStop(0.45, enginePower > 0.02 ? 'rgba(112,220,255,.76)' : 'rgba(13,27,39,.9)');
    bell.addColorStop(1, 'rgba(4,8,13,1)');
    ctx.fillStyle = bell;
    ctx.beginPath(); ctx.ellipse(-388, y, 9, 17, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawShieldImpact(ctx, cx, cy, rx, ry, state) {
  if (state.shieldPulse <= 0.002) return;
  const pulse = state.shieldPulse;
  const hitX = cx + rx * 0.66;
  const hitY = cy - ry * 0.28;
  const rippleRadius = lerp(5, ry * 1.58, state.rippleProgress);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = 'rgba(112,222,255,.72)';
  ctx.shadowBlur = 12 * pulse;
  ctx.strokeStyle = `rgba(120,226,255,${0.22 + pulse * 0.46})`;
  ctx.lineWidth = 1.2 + pulse * 1.3;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.03, 0, Math.PI * 2); ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.03, 0, Math.PI * 2); ctx.clip();
  const cellRadius = Math.max(5, ry * 0.12);
  ctx.lineWidth = Math.max(0.55, cellRadius * 0.065);
  for (let row = -3; row <= 3; row += 1) {
    for (let col = -4; col <= 2; col += 1) {
      const x = hitX + (col + (row & 1) * 0.5) * cellRadius * 1.72;
      const y = hitY + row * cellRadius * 1.48;
      const distance = Math.hypot(x - hitX, (y - hitY) * 1.68);
      const ringEnergy = 1 - clamp(Math.abs(distance - rippleRadius) / (cellRadius * 2.4));
      if (ringEnergy <= 0.02) continue;
      ctx.strokeStyle = `rgba(121,226,255,${pulse * ringEnergy * 0.38})`;
      hexagon(ctx, x, y, cellRadius);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = `rgba(220,251,255,${pulse * 0.92})`;
  ctx.lineWidth = 1.5 + pulse * 1.8;
  ctx.beginPath();
  ctx.ellipse(hitX, hitY, rippleRadius, rippleRadius * 0.58, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const coreRadius = 8 + state.impactFlash * 34;
  const impact = ctx.createRadialGradient(hitX, hitY, 0, hitX, hitY, coreRadius);
  impact.addColorStop(0, `rgba(255,255,255,${state.impactFlash})`);
  impact.addColorStop(0.3, `rgba(139,234,255,${state.impactFlash * 0.72})`);
  impact.addColorStop(1, 'rgba(91,188,255,0)');
  ctx.fillStyle = impact;
  ctx.beginPath(); ctx.arc(hitX, hitY, coreRadius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawNarrativeFrame(ctx, width, height, now, state) {
  const compact = width < 860;
  const lensX = width * (compact ? 0.75 : 0.70);
  const lensY = height * (compact ? 0.46 : 0.40);
  const finalX = width * (compact ? 0.71 : 0.75);
  const finalY = height * (compact ? 0.73 : 0.61);
  const targetWidth = Math.min(width * (compact ? 0.82 : 0.48), height * (compact ? 0.82 : 1.02));
  const revealScale = lerp(0.12, 1, 1 - Math.pow(1 - state.reveal, 3));
  const scale = targetWidth / 900 * revealScale;
  const cx = lerp(lensX, finalX, state.travel);
  const cy = lerp(lensY, finalY, state.travel);

  drawLensWake(ctx, lensX, lensY, targetWidth, state.lensEnergy);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  drawFlagshipHull(ctx, state.reveal * 0.92, now, state.enginePower);
  ctx.restore();
  drawShieldImpact(ctx, cx, cy, 466 * scale, 148 * scale, state);
}

function prefersReducedMotion() {
  try { return Boolean(matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch (error) { return false; }
}

function savesData() {
  try { return Boolean(navigator.connection?.saveData); }
  catch (error) { return false; }
}

export function homeFlagshipPlaybackAllowed({
  qualityTier = 'low',
  reducedMotion = false,
  saveData = false,
  force3D = false,
} = {}) {
  return Boolean(force3D || (
    qualityTier === 'high'
    && !reducedMotion
    && !saveData
  ));
}

export function homeFlagshipLayerVisible({
  commandMode = false,
  playbackState = 'standby',
  force3D = false,
  flagshipExperiment = false,
} = {}) {
  const playbackInFlight = playbackState === 'requested'
    || playbackState === 'loading'
    || playbackState === 'active';
  const posterRestored = playbackState === 'settled'
    || playbackState === 'unavailable';
  return Boolean(
    (commandMode && (playbackInFlight || posterRestored))
    || (force3D && (playbackInFlight || posterRestored))
    || (flagshipExperiment && !commandMode)
  );
}

export function createHomeFlagshipNarrative({
  container,
  observeElement,
  renderCoordinator,
  reducedMotion = prefersReducedMotion(),
  saveData = savesData(),
  force3D = false,
} = {}) {
  if (!container || !observeElement || !renderCoordinator) return null;
  const canvas = container.ownerDocument.createElement('canvas');
  canvas.className = 'home-flagship-narrative';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { canvas.remove(); return null; }
  const poster = container.querySelector('.home-flagship-poster');

  let renderPolicy = renderCoordinator.getPolicy({ cost: 'medium', targetFps: 30 });
  const playbackAllowed = () => homeFlagshipPlaybackAllowed({
    qualityTier: renderPolicy.qualityTier,
    reducedMotion,
    saveData,
    force3D,
  });
  let terminalMode = !playbackAllowed();
  let elapsed = 0;
  let width = 1, height = 1, dpr = 1;
  let running = false, visible = false, raf = 0, visibilityRaf = 0;
  let lastAt = 0, lastDrawAt = 0, lastPhase = '';
  let surface = null, viewportObserver = null, removeVisibilityFallback = null;
  let gpuNarrative = null, gpuNarrativePromise = null, destroyed = false;
  let playbackState = force3D ? 'requested' : 'standby';
  let playbackConsumed = force3D;
  let playbackGeneration = 0;
  let budgetActive = !container.ownerDocument.hidden;
  let inViewport = false;
  let enabled = true;
  const flagshipExperiment = Boolean(
    container.ownerDocument.body?.classList.contains('flagship-upgrade-enabled'),
  );
  container.classList.toggle('home-flagship-force-3d', force3D);

  function posterAvailable() {
    return Boolean(poster && poster.dataset.failed !== 'true');
  }

  function playbackInFlight() {
    return playbackState === 'requested'
      || playbackState === 'loading'
      || playbackState === 'active';
  }

  function posterRestored() {
    return playbackConsumed
      && (playbackState === 'settled' || playbackState === 'unavailable');
  }

  function shouldShowSurface() {
    return homeFlagshipLayerVisible({
      commandMode: !enabled,
      playbackState,
      force3D,
      flagshipExperiment,
    })
      && budgetActive
      && inViewport;
  }

  function setPlaybackState(nextState, reason = '') {
    playbackState = nextState;
    canvas.dataset.playback = nextState;
    if (reason) canvas.dataset.playbackReason = reason;
    else delete canvas.dataset.playbackReason;
    container.classList.toggle('home-flagship-playback-active', playbackInFlight());
    container.classList.toggle('home-flagship-poster-restored', posterRestored());
  }

  canvas.dataset.model = posterAvailable() ? 'static-venator-poster' : 'static-fallback';
  setPlaybackState(playbackState, force3D ? 'query-override' : '');

  function size() {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width || innerWidth);
    height = Math.max(1, rect.height || innerHeight);
    dpr = renderPolicy.computeDpr(width, height, { minDpr: 0.7, maxDpr: 1.25 });
    // The model-derived poster is the cheap Command/experiment fallback. Do
    // not retain another full-viewport 2D backing store unless it fails.
    canvas.width = posterAvailable() ? 1 : Math.round(width * dpr);
    canvas.height = posterAvailable() ? 1 : Math.round(height * dpr);
    gpuNarrative?.resize(width, height, dpr);
  }

  function releaseGpuNarrative() {
    const staleNarrative = gpuNarrative;
    gpuNarrative = null;
    staleNarrative?.setVisible(false);
    staleNarrative?.destroy();
  }

  function finishPlayback(reason, { unavailable = false, cancelled = false } = {}) {
    if (destroyed) return;
    playbackGeneration += 1;
    stop();
    elapsed = DURATION_MS;
    releaseGpuNarrative();
    gpuNarrativePromise = null;
    setPlaybackState(cancelled ? 'cancelled' : unavailable ? 'unavailable' : 'settled', reason);
    visible = shouldShowSurface();
    if (visible) draw(performance.now());
    else {
      canvas.hidden = true;
      if (poster) poster.hidden = true;
    }
  }

  function ensureGpuNarrative() {
    if (!playbackInFlight() || !playbackAllowed() || gpuNarrativePromise || destroyed) {
      return gpuNarrativePromise;
    }
    const generation = playbackGeneration;
    setPlaybackState('loading', canvas.dataset.playbackReason || 'user-intent');
    if (visible) draw(performance.now());
    const pending = import('./homeFlagshipWebGPU.js')
      .then(({ createHomeFlagshipWebGPU }) => {
        if (destroyed || generation !== playbackGeneration || !playbackAllowed()) return null;
        return createHomeFlagshipWebGPU({
          container,
          onModelStatus() {
            requestAnimationFrame((now) => {
              if (!destroyed && visible) draw(now);
            });
          },
          onUnavailable(reason) {
            queueMicrotask(() => {
              if (!destroyed && generation === playbackGeneration) {
                finishPlayback(reason || 'gpu-unavailable', { unavailable: true });
              }
            });
          },
        });
      })
      .then(async (narrative) => {
        if (destroyed || generation !== playbackGeneration || !playbackAllowed()) {
          narrative?.destroy();
          return null;
        }
        if (!narrative) {
          finishPlayback('gpu-unavailable', { unavailable: true });
          return null;
        }
        gpuNarrative = narrative;
        gpuNarrative.resize(width, height, dpr);
        gpuNarrative.setVisible(false);
        const ready = await narrative.ready;
        if (destroyed || generation !== playbackGeneration || !playbackAllowed()) {
          if (gpuNarrative === narrative) gpuNarrative = null;
          narrative.destroy();
          return null;
        }
        if (!ready || narrative.modelStatus !== 'venator-ready') {
          if (gpuNarrative === narrative) gpuNarrative = null;
          narrative.destroy();
          finishPlayback('model-unavailable', { unavailable: true });
          return null;
        }
        elapsed = 0;
        lastAt = 0;
        lastDrawAt = 0;
        lastPhase = '';
        setPlaybackState('active', canvas.dataset.playbackReason || 'user-intent');
        narrative.setVisible(visible);
        if (visible) {
          draw(performance.now());
          start();
        }
        return narrative;
      })
      .catch(() => {
        if (!destroyed && generation === playbackGeneration) {
          releaseGpuNarrative();
          finishPlayback('gpu-create-failed', { unavailable: true });
        }
        return null;
      });
    gpuNarrativePromise = pending;
    void pending.finally(() => {
      if (gpuNarrativePromise === pending) gpuNarrativePromise = null;
    });
    return pending;
  }

  function draw(now) {
    const timelineActive = playbackState === 'active';
    const state = sampleHomeFlagshipNarrative(elapsed, { terminal: !timelineActive });
    const gpuRendered = timelineActive && (gpuNarrative?.render(now, state) || false);
    const usePoster = !gpuRendered && posterAvailable();
    gpuNarrative?.setVisible(gpuRendered && visible);
    if (poster) poster.hidden = !visible || !usePoster;
    canvas.dataset.model = gpuRendered
      ? gpuNarrative?.modelStatus || 'venator-ready'
      : usePoster ? 'static-venator-poster' : 'static-fallback';
    canvas.hidden = gpuRendered || usePoster;
    if (!gpuRendered && !usePoster) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawNarrativeFrame(ctx, width, height, now, state);
    }
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      canvas.dataset.phase = state.phase;
    }
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastAt = 0; lastDrawAt = 0;
  }

  function loop(now) {
    if (!running || playbackState !== 'active') return;
    const frameMs = lastAt ? Math.min(80, Math.max(0, now - lastAt)) : 0;
    lastAt = now;
    elapsed = Math.min(DURATION_MS, elapsed + frameMs);
    if (!lastDrawAt || now - lastDrawAt >= 1000 / 30) {
      lastDrawAt = now;
      const drawStartedAt = performance.now();
      draw(now);
      surface?.reportFrame(Math.max(0, performance.now() - drawStartedAt));
    }
    if (elapsed >= DURATION_MS) {
      finishPlayback('complete');
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running || playbackState !== 'active' || elapsed >= DURATION_MS) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function requestPlayback(reason = 'user-intent') {
    if (destroyed || playbackConsumed || !playbackAllowed()) return false;
    playbackConsumed = true;
    terminalMode = false;
    elapsed = 0;
    setPlaybackState('requested', reason);
    surface?.resume();
    reconcileVisibility();
    return true;
  }

  function reconcileVisibility() {
    const shouldShow = shouldShowSurface();
    if (!shouldShow) {
      visible = false;
      stop();
      canvas.hidden = true;
      if (poster) poster.hidden = true;
      gpuNarrative?.setVisible(false);
      return;
    }
    if (!visible) visible = true;
    if (playbackState === 'requested') void ensureGpuNarrative();
    if (playbackState === 'active') start();
    draw(performance.now());
  }

  function sampleViewport() {
    visibilityRaf = 0;
    const rect = observeElement.getBoundingClientRect();
    inViewport = rect.bottom > 0
      && rect.top < (container.ownerDocument.defaultView?.innerHeight || rect.bottom);
    reconcileVisibility();
  }

  surface = renderCoordinator.register({
    id: 'home:flagship-narrative',
    element: container,
    observe: false,
    cost: 'medium',
    targetFps: 30,
    onResume() {
      budgetActive = true;
      reconcileVisibility();
    },
    onPause() {
      budgetActive = false;
      reconcileVisibility();
    },
    onResize() {
      size();
      if (!viewportObserver) sampleViewport();
      if (visible) draw(performance.now());
    },
    onQualityChange(nextPolicy) {
      renderPolicy = nextPolicy;
      terminalMode = !playbackAllowed();
      if (!force3D && nextPolicy.qualityTier !== 'high') {
        if (playbackInFlight()) finishPlayback('quality-downgrade');
        canvas.dataset.model = posterAvailable() ? 'static-venator-poster' : 'static-fallback';
        if (visible) draw(performance.now());
      }
    },
    onDispose() {
      destroyed = true;
      stop();
      if (visibilityRaf) cancelAnimationFrame(visibilityRaf);
      viewportObserver?.disconnect();
      removeVisibilityFallback?.();
      playbackGeneration += 1;
      releaseGpuNarrative();
      gpuNarrativePromise = null;
      container.classList.remove('home-flagship-playback-active');
      container.classList.remove('home-flagship-poster-restored');
      container.classList.remove('home-flagship-force-3d');
      poster?.removeEventListener('error', handlePosterError);
      canvas.remove();
    },
  });

  const ViewportObserver = container.ownerDocument.defaultView?.IntersectionObserver;
  if (ViewportObserver) {
    viewportObserver = new ViewportObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === observeElement);
      if (!entry) return;
      inViewport = Boolean(entry.isIntersecting);
      reconcileVisibility();
    }, { threshold: [0, 0.01] });
    viewportObserver.observe(observeElement);
  } else {
    const view = container.ownerDocument.defaultView;
    const queueViewportSample = () => {
      if (!visibilityRaf) visibilityRaf = requestAnimationFrame(sampleViewport);
    };
    view?.addEventListener('scroll', queueViewportSample, { passive: true });
    removeVisibilityFallback = () => view?.removeEventListener('scroll', queueViewportSample);
  }
  sampleViewport();
  visibilityRaf = requestAnimationFrame(sampleViewport);

  function handlePosterError() {
    size();
    if (visible) draw(performance.now());
  }
  poster?.addEventListener('error', handlePosterError);

  return Object.freeze({
    getDiagnostics() {
      return Object.freeze({
        phase: lastPhase,
        terminalMode,
        playbackState,
        playbackConsumed,
        modelStatus: gpuNarrative?.modelStatus
          || (posterAvailable() ? 'static-venator-poster' : 'static-fallback'),
        gpu: gpuNarrative?.getDiagnostics?.() || null,
      });
    },
    requestPlayback,
    dismissSettledPoster(reason = 'command-feed-ready') {
      if (destroyed || enabled || !posterRestored()) return false;
      setPlaybackState('dismissed', reason);
      visible = false;
      canvas.hidden = true;
      if (poster) poster.hidden = true;
      surface.pause();
      return true;
    },
    setEnabled(nextEnabled) {
      enabled = Boolean(nextEnabled);
      if (enabled && playbackInFlight() && !force3D) {
        finishPlayback('cruise-return', { cancelled: true });
      } else if (!enabled && (force3D || flagshipExperiment)) {
        // Default Command goes straight to the CIC and decodes Venator once.
        // The full 5.2s WebGPU narrative remains available as an explicit
        // visual experiment instead of serially loading the same 11MB model
        // into two independent GPU contexts on every first engagement.
        requestPlayback('command-intent');
      }
      if (shouldShowSurface()) {
        surface.resume();
      } else {
        reconcileVisibility();
        surface.pause();
      }
    },
    destroy() { surface.dispose(); },
  });
}
