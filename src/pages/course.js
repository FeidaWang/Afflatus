import { courseStageForProgress } from '../lib/courseNarrative.js';

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
  window.addEventListener('hashchange', () => revealHashTarget({ align: true }));
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

  /* The editorial atlas is one connected canvas. Scaling its wrapper keeps
     the transformed board's scroll bounds honest in every browser. */
  const atlasViewport = $('#atlasViewport');
  const atlasStage = $('#atlasStage');
  const atlasBoard = $('#atlasBoard');
  const zoomIn = $('#mapZoomIn');
  const zoomOut = $('#mapZoomOut');
  let mapScale = window.innerWidth < 720 ? 0.82 : 1;

  function sizeAtlas() {
    if (!atlasBoard || !atlasStage) return;
    atlasBoard.style.setProperty('--map-scale', String(mapScale));
    atlasStage.style.width = `${Math.ceil(atlasBoard.offsetWidth * mapScale)}px`;
    atlasStage.style.height = `${Math.ceil(atlasBoard.offsetHeight * mapScale)}px`;
    if (zoomOut) zoomOut.disabled = mapScale <= 0.68;
    if (zoomIn) zoomIn.disabled = mapScale >= 1.2;
  }
  function setMapScale(next) {
    if (!atlasViewport || !atlasBoard) return;
    const before = atlasBoard.offsetWidth * mapScale;
    const focus = (atlasViewport.scrollLeft + atlasViewport.clientWidth / 2) / Math.max(1, before);
    mapScale = Math.min(1.2, Math.max(0.68, Math.round(next * 100) / 100));
    sizeAtlas();
    const after = atlasBoard.offsetWidth * mapScale;
    atlasViewport.scrollLeft = Math.max(0, focus * after - atlasViewport.clientWidth / 2);
  }
  zoomIn?.addEventListener('click', () => setMapScale(mapScale + 0.1));
  zoomOut?.addEventListener('click', () => setMapScale(mapScale - 0.1));
  atlasViewport?.addEventListener('wheel', (event) => {
    if (!event.shiftKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    atlasViewport.scrollLeft += event.deltaY;
  }, { passive: false });
  sizeAtlas();
  if ('ResizeObserver' in window && atlasBoard) new ResizeObserver(sizeAtlas).observe(atlasBoard);
  if (window.location.hash) {
    requestAnimationFrame(() => revealHashTarget({ align: true }));
    window.setTimeout(() => revealHashTarget({ align: true }), 260);
  }

  $$('.map-node').forEach((node) => {
    node.addEventListener('pointerdown', () => {
      node.classList.add('target-locked');
      window.setTimeout(() => node.classList.remove('target-locked'), 180);
    });
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
