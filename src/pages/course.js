import { courseStageForProgress } from '../lib/courseNarrative.js';
import { atlasRelations, atlasSceneState } from '../lib/courseAtlas.js';
import { courseNodes } from '../data/courseNodes.js';

(() => {
  'use strict';

  const STORAGE_KEY = 'afflatus:fde-weekly-review:v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lang = () => {
    try { return window.AfflatusI18N?.get() || 'en'; } catch { return 'en'; }
  };
  const T = (en, zh) => lang() === 'zh' ? zh : en;

  /* The page behaves like an archive projector: load the film gate, then
     mechanically reveal each transmission as it reaches the viewport. */
  document.body.classList.add('course-enhanced');
  const filmLoader = $('#filmLoader');
  window.setTimeout(() => {
    document.body.classList.add('course-loaded');
    filmLoader?.setAttribute('hidden', '');
  }, 2100);

  const transmissions = $$('main > section:not(.hero)');
  const revealTransmission = (section) => {
    if (!section) return;
    section.classList.remove('awaiting-transmission');
    section.classList.add('transmitted');
  };
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    transmissions.forEach((section) => section.classList.add('awaiting-transmission'));
    const transmissionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealTransmission(entry.target);
        transmissionObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.02 });
    transmissions.forEach((section) => transmissionObserver.observe(section));

    /* Fail open if a browser throttles or suppresses observer delivery. The
       course content must always win over its entrance effect. */
    window.setTimeout(() => {
      transmissions.forEach((section) => {
        revealTransmission(section);
        transmissionObserver.unobserve(section);
      });
    }, 3200);
  } else {
    transmissions.forEach(revealTransmission);
  }

  const revealHashTarget = ({ align = false } = {}) => {
    if (!window.location.hash) return;
    let target;
    try { target = document.querySelector(window.location.hash); } catch { return; }
    revealTransmission(target?.closest('section'));
    if (align) target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };
  const settleHashTarget = () => {
    revealHashTarget({ align: true });
    /* A newly revealed section is still completing its 720 ms projector
       translation. Align once more after it settles so the fixed header does
       not cover the section title. */
    window.setTimeout(() => revealHashTarget({ align: true }), 780);
  };
  window.addEventListener('hashchange', settleHashTarget);
  revealHashTarget();

  const timecode = $('#signalTimecode');
  const timecodeStart = performance.now();
  function updateTimecode(now = performance.now()) {
    if (!timecode) return;
    const totalFrames = Math.floor((now - timecodeStart) / 40);
    const frames = totalFrames % 25;
    const totalSeconds = Math.floor(totalFrames / 25);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600) % 100;
    timecode.textContent = [hours, minutes, seconds, frames].map((part) => String(part).padStart(2, '0')).join(':');
  }
  updateTimecode();
  window.setInterval(updateTimecode, 200);

  const toastEl = $('#courseToast');
  function toast(message, duration = 1900) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  /* Scroll progress is both navigation feedback and the page's field-stage readout. */
  const progress = $('#courseProgress');
  const stageReadout = $('#courseStageReadout');
  let scrollFrame = 0;
  function updateProgress() {
    scrollFrame = 0;
    const root = document.documentElement;
    const max = Math.max(1, root.scrollHeight - root.clientHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / max));
    if (progress) progress.style.height = `${ratio * 100}%`;
    const stage = courseStageForProgress(ratio);
    document.body.dataset.courseStage = String(stage);
    if (stageReadout) stageReadout.textContent = `STAGE 0${stage} · ${Math.round(ratio * 100).toString().padStart(3, '0')}%`;
  }
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* The atlas is a reversible sticky scene driven by window scroll. It never
     consumes wheel input; deliberate zoomed panning uses pointer drag only. */
  const atlasSection = $('#atlas');
  const atlasViewport = $('#atlasViewport');
  const atlasStage = $('#atlasStage');
  const atlasBoard = $('#atlasBoard');
  const atlasRelationsSvg = $('#atlasRelations');
  const zoomIn = $('#mapZoomIn');
  const zoomOut = $('#mapZoomOut');
  const zoomFit = $('#mapZoomFit');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let mapScale = 1;
  let mapFitScale = 1;
  let mapWasZoomed = false;
  let atlasInView = false;
  let atlasSceneActive = false;
  let atlasSceneFrame = 0;
  let atlasPhysicsFrame = 0;
  let atlasPhysicsLast = 0;
  let atlasPointer = null;

  function sizeAtlas() {
    if (!atlasBoard || !atlasStage || !atlasViewport) return;
    atlasBoard.style.setProperty('--map-scale', String(mapScale));
    const width = Math.ceil(atlasBoard.offsetWidth * mapScale);
    const height = Math.ceil(atlasBoard.offsetHeight * mapScale);
    atlasStage.style.width = `${width}px`;
    atlasStage.style.height = `${height}px`;
    atlasStage.style.marginInline = width < atlasViewport.clientWidth ? 'auto' : '0';
    atlasViewport.classList.toggle('is-zoomed', mapWasZoomed);
    if (zoomOut) zoomOut.disabled = mapScale <= mapFitScale + 0.005;
    if (zoomIn) zoomIn.disabled = mapScale >= 1.25;
  }

  function fitAtlas({ keepFocus = false } = {}) {
    if (!atlasViewport || !atlasBoard) return;
    const horizontalInset = window.innerWidth < 720 ? 20 : 44;
    const verticalInset = 22;
    const availableWidth = Math.max(1, atlasViewport.clientWidth - horizontalInset);
    const availableHeight = Math.max(1, atlasViewport.clientHeight - verticalInset);
    mapFitScale = Math.min(1, availableWidth / atlasBoard.offsetWidth, availableHeight / atlasBoard.offsetHeight);
    mapScale = Math.max(0.16, Math.floor(mapFitScale * 1000) / 1000);
    mapWasZoomed = false;
    sizeAtlas();
    if (!keepFocus) {
      atlasViewport.scrollLeft = 0;
      atlasViewport.scrollTop = 0;
    }
    measureAtlasBodies();
    drawAtlasRelations();
  }

  function setMapScale(next) {
    if (!atlasViewport || !atlasBoard || !atlasStage) return;
    const beforeWidth = atlasBoard.offsetWidth * mapScale;
    const beforeHeight = atlasBoard.offsetHeight * mapScale;
    const focusX = (atlasViewport.scrollLeft + atlasViewport.clientWidth / 2) / Math.max(1, beforeWidth);
    const focusY = (atlasViewport.scrollTop + atlasViewport.clientHeight / 2) / Math.max(1, beforeHeight);
    mapScale = Math.min(1.25, Math.max(mapFitScale, Math.round(next * 100) / 100));
    mapWasZoomed = mapScale > mapFitScale + 0.005;
    sizeAtlas();
    const afterWidth = atlasBoard.offsetWidth * mapScale;
    const afterHeight = atlasBoard.offsetHeight * mapScale;
    atlasViewport.scrollLeft = Math.max(0, focusX * afterWidth - atlasViewport.clientWidth / 2);
    atlasViewport.scrollTop = Math.max(0, focusY * afterHeight - atlasViewport.clientHeight / 2);
  }
  zoomIn?.addEventListener('click', () => setMapScale(mapScale + 0.1));
  zoomOut?.addEventListener('click', () => setMapScale(mapScale - 0.1));
  zoomFit?.addEventListener('click', () => fitAtlas());
  requestAnimationFrame(() => fitAtlas());
  if ('ResizeObserver' in window && atlasBoard) {
    let resizeFrame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (mapWasZoomed) sizeAtlas(); else fitAtlas({ keepFocus: true });
      });
    }).observe(atlasViewport);
  }

  function updateAtlasScene() {
    atlasSceneFrame = 0;
    if (!atlasSection || reducedMotion.matches) return;
    const state = atlasSceneState(
      window.scrollY,
      atlasSection.offsetTop,
      atlasSection.offsetHeight,
      window.innerHeight,
    );
    atlasSection.style.setProperty('--atlas-title-opacity', state.titleOpacity.toFixed(4));
    atlasSection.style.setProperty('--atlas-map-opacity', state.mapOpacity.toFixed(4));
    atlasSection.style.setProperty('--atlas-map-scale', state.mapScale.toFixed(4));
    atlasSection.style.setProperty('--atlas-split', state.splitProgress.toFixed(4));
    atlasSceneActive = state.active;
    atlasSection.classList.toggle('atlas-map-active', state.active);
    if (atlasSceneActive && atlasInView) startAtlasPhysics();
  }

  window.addEventListener('scroll', () => {
    if (!atlasSceneFrame) atlasSceneFrame = requestAnimationFrame(updateAtlasScene);
  }, { passive: true });
  window.addEventListener('resize', updateAtlasScene);
  if ('IntersectionObserver' in window && atlasSection) {
    new IntersectionObserver(([entry]) => {
      atlasInView = entry.isIntersecting;
      if (atlasInView && atlasSceneActive) startAtlasPhysics();
    }, { rootMargin: '18% 0px' }).observe(atlasSection);
  } else {
    atlasInView = true;
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && atlasSceneActive && atlasInView) startAtlasPhysics();
  });

  const atlasBodies = $$('.map-node', atlasBoard || document).map((node, index) => {
    const number = Number(node.dataset.node || index + 1);
    return {
      node,
      id: node.dataset.node,
      baseX: 0,
      baseY: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      phase: number * 2.3999632297,
      speed: 0.42 + (number % 7) * 0.035,
      amplitudeX: 3.2 + (number % 5) * 0.72,
      amplitudeY: 2.6 + (number % 4) * 0.66,
    };
  });
  const atlasBodyById = new Map(atlasBodies.map((body) => [body.id, body]));
  const relationEntries = [];

  if (atlasRelationsSvg) {
    atlasRelations.forEach(([from, to, kind], index) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.dataset.from = from;
      path.dataset.to = to;
      path.dataset.kind = kind;
      path.dataset.bend = index % 2 ? '1' : '-1';
      atlasRelationsSvg.append(path);
      relationEntries.push({ from, to, path });
    });
  }

  function measureAtlasBodies() {
    atlasBodies.forEach((body) => {
      const lane = body.node.closest('.map-lane');
      body.baseX = (lane?.offsetLeft || 0) + body.node.offsetLeft + body.node.offsetWidth / 2;
      body.baseY = (lane?.offsetTop || 0) + body.node.offsetTop + body.node.offsetHeight / 2;
    });
  }

  function drawAtlasRelations() {
    relationEntries.forEach(({ from, to, path }) => {
      const a = atlasBodyById.get(from);
      const b = atlasBodyById.get(to);
      if (!a || !b) return;
      const ax = a.baseX + a.x;
      const ay = a.baseY + a.y;
      const bx = b.baseX + b.x;
      const by = b.baseY + b.y;
      const midX = (ax + bx) / 2;
      const bend = Number(path.dataset.bend) * Math.min(74, 24 + Math.abs(by - ay) * 0.08);
      path.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)} C${midX.toFixed(1)} ${(ay + bend).toFixed(1)} ${midX.toFixed(1)} ${(by - bend).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
    });
  }

  function startAtlasPhysics() {
    if (reducedMotion.matches || atlasPhysicsFrame) return;
    atlasPhysicsLast = 0;
    atlasPhysicsFrame = requestAnimationFrame(stepAtlasPhysics);
  }

  function stepAtlasPhysics(now) {
    if (!atlasSceneActive || !atlasInView || document.hidden) {
      atlasPhysicsFrame = 0;
      return;
    }
    atlasPhysicsFrame = requestAnimationFrame(stepAtlasPhysics);
    if (now - atlasPhysicsLast < 32) return;
    const dt = Math.min(1.8, Math.max(0.6, (now - (atlasPhysicsLast || now - 33)) / 33));
    atlasPhysicsLast = now;
    const time = now / 1000;

    atlasBodies.forEach((body) => {
      let targetX = Math.sin(time * body.speed + body.phase) * body.amplitudeX;
      let targetY = Math.cos(time * (body.speed * 0.83) + body.phase * 1.37) * body.amplitudeY;
      if (atlasPointer) {
        const dx = body.baseX + body.x - atlasPointer.x;
        const dy = body.baseY + body.y - atlasPointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 122) {
          const force = (1 - distance / 122) * 8;
          targetX += (dx / distance) * force;
          targetY += (dy / distance) * force;
        }
      }
      body.vx += (targetX - body.x) * 0.028 * dt;
      body.vy += (targetY - body.y) * 0.028 * dt;
    });

    /* Lightweight pairwise separation. At 36 bodies this is only 630 checks
       per 30 Hz frame and avoids importing a heavy physics engine. */
    for (let i = 0; i < atlasBodies.length; i += 1) {
      const a = atlasBodies[i];
      for (let j = i + 1; j < atlasBodies.length; j += 1) {
        const b = atlasBodies[j];
        const dx = (b.baseX + b.x) - (a.baseX + a.x);
        const dy = (b.baseY + b.y) - (a.baseY + a.y);
        const overlapX = 124 - Math.abs(dx);
        const overlapY = 104 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const impulse = Math.sign(dx || 1) * overlapX * 0.012;
          a.vx -= impulse;
          b.vx += impulse;
        } else {
          const impulse = Math.sign(dy || 1) * overlapY * 0.012;
          a.vy -= impulse;
          b.vy += impulse;
        }
      }
    }

    atlasBodies.forEach((body) => {
      body.vx *= 0.86;
      body.vy *= 0.86;
      body.x = Math.max(-15, Math.min(15, body.x + body.vx * dt));
      body.y = Math.max(-11, Math.min(11, body.y + body.vy * dt));
      const rotation = Math.sin(time * (body.speed * 0.7) + body.phase) * 0.82 + body.vx * 0.08;
      body.node.style.setProperty('--float-x', `${body.x.toFixed(2)}px`);
      body.node.style.setProperty('--float-y', `${body.y.toFixed(2)}px`);
      body.node.style.setProperty('--float-r', `${rotation.toFixed(2)}deg`);
    });
    drawAtlasRelations();
  }

  atlasViewport?.addEventListener('pointermove', (event) => {
    if (!atlasBoard || !atlasSceneActive) return;
    const rect = atlasBoard.getBoundingClientRect();
    atlasPointer = {
      x: (event.clientX - rect.left) / Math.max(0.01, mapScale),
      y: (event.clientY - rect.top) / Math.max(0.01, mapScale),
    };
  }, { passive: true });
  atlasViewport?.addEventListener('pointerleave', () => { atlasPointer = null; });

  let atlasDrag = null;
  atlasViewport?.addEventListener('pointerdown', (event) => {
    if (!mapWasZoomed || event.target.closest('.map-node, button')) return;
    atlasDrag = { x: event.clientX, y: event.clientY, left: atlasViewport.scrollLeft, top: atlasViewport.scrollTop };
    atlasViewport.setPointerCapture?.(event.pointerId);
    atlasViewport.classList.add('is-dragging');
  });
  atlasViewport?.addEventListener('pointermove', (event) => {
    if (!atlasDrag) return;
    atlasViewport.scrollLeft = atlasDrag.left - (event.clientX - atlasDrag.x);
    atlasViewport.scrollTop = atlasDrag.top - (event.clientY - atlasDrag.y);
  });
  const endAtlasDrag = () => {
    atlasDrag = null;
    atlasViewport?.classList.remove('is-dragging');
  };
  atlasViewport?.addEventListener('pointerup', endAtlasDrag);
  atlasViewport?.addEventListener('pointercancel', endAtlasDrag);

  function focusAtlasRelations(node) {
    if (!atlasRelationsSvg || !node) return;
    const id = node.dataset.node;
    atlasRelationsSvg.classList.add('has-focus');
    relationEntries.forEach(({ from, to, path }) => {
      const active = from === id || to === id;
      path.classList.toggle('is-active', active);
      if (!active) return;
      atlasBodyById.get(from)?.node.classList.add('is-related');
      atlasBodyById.get(to)?.node.classList.add('is-related');
    });
  }

  function clearAtlasRelations() {
    atlasRelationsSvg?.classList.remove('has-focus');
    relationEntries.forEach(({ path }) => path.classList.remove('is-active'));
    atlasBodies.forEach(({ node }) => node.classList.remove('is-related'));
  }

  atlasBodies.forEach(({ node }) => {
    node.addEventListener('pointerenter', () => focusAtlasRelations(node));
    node.addEventListener('pointerleave', clearAtlasRelations);
    node.addEventListener('focus', () => focusAtlasRelations(node));
    node.addEventListener('blur', clearAtlasRelations);
  });

  requestAnimationFrame(() => {
    measureAtlasBodies();
    drawAtlasRelations();
    updateAtlasScene();
  });
  if (window.location.hash) {
    requestAnimationFrame(settleHashTarget);
  }

  const nodeDialog = $('#courseNodeDialog');
  const nodeDialogTitle = $('#nodeDialogTitle');
  const nodeDialogMeta = $('#nodeDialogMeta');
  const nodeDialogCode = $('#nodeDialogCode');
  const nodeDialogCover = $('#nodeDialogCover');
  const nodeDialogTheory = $('#nodeDialogTheory');
  const nodeDialogBuild = $('#nodeDialogBuild');
  const nodeDialogBreak = $('#nodeDialogBreak');
  const nodeDialogGate = $('#nodeDialogGate');
  const nodeDialogSource = $('#nodeDialogSource');
  let activeMapNode = null;

  function localized(value) {
    return value?.[lang()] || value?.en || '';
  }

  function renderNodePacket(node) {
    const detail = courseNodes[node?.dataset.node];
    if (!node || !detail || !nodeDialog) return;
    activeMapNode = node;
    const code = $('i', node)?.textContent.trim() || `ARCHIVE / ${node.dataset.node}`;
    const cover = $('b', $('.cover', node))?.innerText.trim() || T('FIELD PACKET', '实战任务包');
    const title = $('strong', node)?.textContent.trim() || T('Course packet', '课程任务包');
    nodeDialog.className = `node-dialog ${[...node.classList].find((name) => name.startsWith('tone-')) || 'tone-ink'}`;
    if (nodeDialogCode) nodeDialogCode.textContent = code;
    if (nodeDialogCover) nodeDialogCover.textContent = cover;
    if (nodeDialogTitle) nodeDialogTitle.textContent = title;
    if (nodeDialogMeta) nodeDialogMeta.textContent = localized(detail.meta);
    if (nodeDialogTheory) nodeDialogTheory.textContent = localized(detail.theory);
    if (nodeDialogBuild) nodeDialogBuild.textContent = localized(detail.build);
    if (nodeDialogBreak) nodeDialogBreak.textContent = localized(detail.failure);
    if (nodeDialogGate) nodeDialogGate.textContent = localized(detail.gate);
    if (nodeDialogSource) {
      const href = node.getAttribute('href') || '#atlas';
      nodeDialogSource.href = href;
      nodeDialogSource.target = href.startsWith('#') ? '_self' : '_blank';
      nodeDialogSource.rel = href.startsWith('#') ? '' : 'noopener';
    }
  }

  $$('.map-node').forEach((node) => {
    node.addEventListener('pointerdown', () => {
      node.classList.add('target-locked');
      window.setTimeout(() => node.classList.remove('target-locked'), 180);
    });
    node.addEventListener('click', (event) => {
      if (!nodeDialog || !courseNodes[node.dataset.node]) return;
      event.preventDefault();
      renderNodePacket(node);
      if (typeof nodeDialog.showModal === 'function') nodeDialog.showModal();
      else nodeDialog.setAttribute('open', '');
    });
  });
  nodeDialog?.addEventListener('click', (event) => {
    if (event.target === nodeDialog) nodeDialog.close();
  });
  nodeDialogSource?.addEventListener('click', () => {
    if (nodeDialogSource.getAttribute('href')?.startsWith('#')) nodeDialog?.close();
  });
  window.addEventListener('afflatus-lang', () => {
    if (activeMapNode && nodeDialog?.open) renderNodePacket(activeMapNode);
  });

  /* Weekly review: intentionally local-only. The score is a weighted index,
     capped when there is no inspectable artifact or decision evidence. */
  const form = $('#fdeReviewForm');
  const fieldScore = $('#fieldScore');
  const fieldAdvice = $('#fieldAdvice');
  const reviewWeek = $('#reviewWeek');
  const reviewPrompt = $('#reviewPrompt');
  const reviewArtifact = $('#reviewArtifact');
  const reviewDecision = $('#reviewDecision');
  const scoreInputs = $$('input[type="range"][data-weight]', form || document);
  const reviewFields = [reviewWeek, reviewPrompt, reviewArtifact, reviewDecision].filter(Boolean);

  const dimensions = {
    scoreEngineering: { en: 'Engineering & reliability', zh: '工程与可靠性' },
    scoreAI: { en: 'AI judgment & evals', zh: 'AI 判断与评测' },
    scoreDiscovery: { en: 'Discovery & domain', zh: '发现与行业理解' },
    scoreDelivery: { en: 'Delivery & adoption', zh: '交付与采用' },
    scoreGovernance: { en: 'Security & governance', zh: '安全与治理' },
    scoreReflection: { en: 'Reflection & communication', zh: '复盘与沟通' },
  };

  function formData() {
    return {
      week: reviewWeek?.value || '',
      prompt: reviewPrompt?.value.trim() || '',
      artifact: reviewArtifact?.value.trim() || '',
      decision: reviewDecision?.value.trim() || '',
      scores: Object.fromEntries(scoreInputs.map((input) => [input.id, Number(input.value)])),
    };
  }
  function saveReview() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(formData())); } catch {}
  }
  function loadReview() {
    let stored;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { stored = null; }
    if (!stored) {
      if (reviewWeek) reviewWeek.value = new Date().toISOString().slice(0, 10);
      return;
    }
    if (reviewWeek) reviewWeek.value = stored.week || new Date().toISOString().slice(0, 10);
    if (reviewPrompt) reviewPrompt.value = stored.prompt || '';
    if (reviewArtifact) reviewArtifact.value = stored.artifact || '';
    if (reviewDecision) reviewDecision.value = stored.decision || '';
    scoreInputs.forEach((input) => {
      if (Number.isFinite(stored.scores?.[input.id])) input.value = String(stored.scores[input.id]);
    });
  }
  function updateScore({ persist = true } = {}) {
    scoreInputs.forEach((input) => {
      const output = form?.querySelector(`output[for="${input.id}"]`);
      if (output) output.textContent = input.value;
    });
    const data = formData();
    const raw = scoreInputs.reduce((sum, input) => sum + (Number(input.value) / 10) * Number(input.dataset.weight), 0);
    const hasEvidence = data.artifact.length >= 8 && data.decision.length >= 8;
    const score = Math.round(hasEvidence ? raw : Math.min(raw, 40));
    if (fieldScore) fieldScore.textContent = String(score);

    const weakest = [...scoreInputs].sort((a, b) => Number(a.value) - Number(b.value))[0];
    const name = weakest ? dimensions[weakest.id] : null;
    if (fieldAdvice) {
      if (!hasEvidence) {
        fieldAdvice.textContent = T('Evidence cap active: add an artifact and a decision record.', '证据上限已启用：请补充作品与决策记录。');
      } else if (score >= 85) {
        fieldAdvice.textContent = T('Field-ready week. Raise the stakes, not the workload.', '本周已达到一线标准。提高问题难度，而不是增加工作量。');
      } else if (name) {
        fieldAdvice.textContent = T(`Next week: put 50% of deliberate practice into ${name.en}.`, `下周：把 50% 的刻意练习投入“${name.zh}”。`);
      }
    }
    if (persist) saveReview();
  }
  loadReview();
  updateScore({ persist: false });
  [...reviewFields, ...scoreInputs].forEach((input) => input.addEventListener('input', () => updateScore()));

  form?.addEventListener('reset', () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setTimeout(() => {
      if (reviewWeek) reviewWeek.value = new Date().toISOString().slice(0, 10);
      updateScore({ persist: false });
      toast(T('This week was reset.', '本周记录已重置。'));
    }, 0);
  });

  $('#copyReview')?.addEventListener('click', async () => {
    const data = formData();
    const score = fieldScore?.textContent || '0';
    const scoreLines = scoreInputs.map((input) => {
      const label = dimensions[input.id];
      return `- ${lang() === 'zh' ? label.zh : label.en}: ${input.value}/10`;
    }).join('\n');
    const prompt = lang() === 'zh'
      ? `你是我的 Forward Deployed Engineer 每周评审官。请只根据下面的证据评分，不要奖励工作量或自我描述。\n\n周截止日期：${data.week || '未填写'}\n本周关键提示词：${data.prompt || '未填写'}\n作品/链接：${data.artifact || '未填写'}\n关键决策与证据：${data.decision || '未填写'}\n当前自评分：${score}/100\n${scoreLines}\n\n请完成：1）核验每个分数是否有证据；2）指出最重要的一个失败模式；3）给出下周 8–10 小时的 50/30/20 计划；4）写出一个更难但范围更小的下一周任务；5）明确哪些判断只是推断。`
      : `Act as my weekly Forward Deployed Engineer reviewer. Score only the evidence below; do not reward effort or self-description.\n\nWeek ending: ${data.week || 'not supplied'}\nKey prompt: ${data.prompt || 'not supplied'}\nArtifact/link: ${data.artifact || 'not supplied'}\nDecision and evidence: ${data.decision || 'not supplied'}\nCurrent self-score: ${score}/100\n${scoreLines}\n\nDo five things: (1) verify whether each score has inspectable evidence; (2) name the single most important failure mode; (3) propose an 8–10 hour 50/30/20 plan for next week; (4) write one harder but narrower next-week assignment; (5) label every inference explicitly.`;
    try {
      await navigator.clipboard.writeText(prompt);
      toast(T('Review prompt copied.', '复盘提示词已复制。'));
    } catch {
      toast(T('Clipboard unavailable — select and copy manually.', '无法访问剪贴板，请手动复制。'), 2600);
    }
  });

  window.addEventListener('afflatus-lang', () => updateScore({ persist: false }));
})();
