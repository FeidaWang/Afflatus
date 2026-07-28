/* ============================================================
   SECTORS STORY GRAPH — scroll-driven Canvas 2D ecosystem view.

   The graph is deliberately fitted as one complete composition. There are no
   zoom buttons and no wheel/pinch zoom handlers: page scroll owns the story,
   while pointer input is limited to hover, click, desktop pan and node drag.
   ============================================================ */
import { smoothDamp, decayVelocity, clampPanTarget } from './graphCamera.js';
import { getRenderBudgetCoordinator } from './renderBudgetCoordinator.js';
import { createLatestWorkerTask } from './latestWorkerTask.js';
import {
  applySectorsGraphPositions,
  createInitialSectorsGraphLayout,
  encodeSectorsGraphPositions,
  prepareSectorsGraphLayout,
  settlePreparedSectorsGraphLayout,
} from './sectorsGraphLayout.js';
import sectorsForceWorkerUrl from '../workers/sectorsForce.worker.js?worker&url';

const KIND_COLOR = {
  model: '#B99CFF',
  initiative: '#E8FF8A',
  cloud: '#68D8FF',
  compute: '#C9F36A',
  silicon: '#FF8BB8',
  memory: '#FFD36A',
  manufacturing: '#A7B5FF',
  platform: '#7CE6C8',
  vendor: '#8FD9FF',
  equity: '#EEF7FB',
};

const EDGE_COLOR = {
  investment: '#FF77B7',
  coalition: '#E8FF8A',
  cloud: '#62D6FF',
  compute: '#C7F464',
  silicon: '#FF9C70',
  memory: '#FFD36A',
  supply: '#7EF0DC',
  manufacturing: '#A7B5FF',
  distribution: '#C7A6FF',
  platform: '#7CE6C8',
  affinity: '#62D6FF',
  pressure: '#FF9C70',
};

const STAGE_REVEAL = {
  models: 0.18,
  initiative: 0.36,
  platform: 0.4,
  cloud: 0.5,
  compute: 0.57,
  silicon: 0.63,
  memory: 0.68,
  manufacturing: 0.75,
};

const COUNTRY_BADGE = {
  US: '🇺🇸 US',
  CN: '🇨🇳 CN',
  KR: '🇰🇷 KR',
  TW: '🇹🇼 TW',
};

// urgent.md Part 3 (RB-P0-01/03): bloc identity is carried by BOTH colour and the
// country badge above, never by colour alone — the badge is what makes the map
// readable for colour-blind users and in forced-colours mode. These hexes mirror
// --rb-blue / --rb-red / --rb-neutral-edge in public/styles/sectors.css.
const BLOC_COLOR = {
  US: '#2F6BFF',
  CN: '#E5484D',
  neutral: '#7EF0DC',
};

const PAN_TAU = 0.1;
const FOCUS_TAU = 0.32;
const MOBILE_NODE_ROWS = [
  ['anthropic', 'openai', 'meta'],
  ['zhipu', 'alibaba', 'moonshot'],
  ['openweights', 'microsoft', 'tencent'],
  ['amazon', 'google', 'apple'],
  ['nvidia', 'huawei', 'broadcom'],
  ['micron', 'skhynix', 'cxmt'],
  ['tsmc'],
];

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function rgba(hex, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return `rgba(238,247,251,${alpha})`;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} sectorsData
 * @param {{
 *   onSelect?:(node:object)=>void,
 *   labelFor?:(node:object)=>string,
 *   lang?:()=>string,
 *   controlHost?:HTMLElement|null,
 *   summaryElement?:HTMLElement|null,
 *   tooltipElement?:HTMLElement|null,
 *   storyHost?:HTMLElement|null,
 *   progressElement?:HTMLElement|null
 * }} [opts]
 */
export function initSectorsGraph(canvas, sectorsData, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { update() {}, destroy() {} };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : () => {};
  const labelFor = typeof opts.labelFor === 'function' ? opts.labelFor : (node) => node.label;
  const getLang = typeof opts.lang === 'function' ? opts.lang : () => 'en';
  const controlHost = opts.controlHost || null;
  const summaryElement = opts.summaryElement || null;
  const tooltipElement = opts.tooltipElement || null;
  const storyHost = opts.storyHost || null;
  const progressElement = opts.progressElement || null;
  const storySteps = storyHost ? Array.from(storyHost.querySelectorAll('[data-graph-step]')) : [];
  const layoutRunner = createLatestWorkerTask(sectorsForceWorkerUrl);

  const renderCoordinator = getRenderBudgetCoordinator();
  let renderPolicy = renderCoordinator.getPolicy({ cost: 'medium', targetFps: 120 });
  let W = 1;
  let H = 1;
  let dpr = 1;
  let sim = null;
  let homeScale = 1;
  let homeX = 0;
  let homeY = 0;
  let maxRadius = 1;
  let storyProgress = storyHost ? 0 : 1;
  let currentChapterId = '';

  const cam = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };
  let camTau = PAN_TAU;
  let focusing = false;
  let sized = false;
  let keyboardIndex = 0;
  let activeNode = null;
  let hoverNode = null;
  let hoverSX = -100;
  let hoverSY = -100;
  let dragNode = null;
  let dragging = false;
  let panning = false;
  let moved = false;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastMoveT = 0;
  let panVelX = 0;
  let panVelY = 0;
  let inertiaActive = false;
  let touchTap = null;

  const logoImages = new Map();
  const ambientDots = Array.from({ length: 44 }, (_, index) => ({
    x: ((index * 37) % 101) / 101,
    y: ((index * 61 + 17) % 103) / 103,
    r: 0.3 + (index % 4) * 0.16,
    phase: index * 0.73,
  }));

  function isMobile() {
    return (canvas.getBoundingClientRect().width || innerWidth) < 640;
  }

  let layoutRevision = 0;
  let pendingSettledLayout = null;

  function applySettledLayout(snapshot, revision) {
    if (revision !== layoutRevision) return;
    if (dragging) {
      pendingSettledLayout = { snapshot, revision };
      return;
    }
    const activeId = activeNode?.id;
    sim = applySectorsGraphPositions(sim, snapshot);
    activeNode = activeId ? sim.nodes.find((node) => node.id === activeId) || null : null;
    pendingSettledLayout = null;
    canvas.dataset.forceRuntime = canvas.dataset.forceRuntime === 'fallback-pending'
      ? 'main-thread-fallback'
      : 'worker';
    preloadLogos();
    renderNodeControls();
    size();
    updateStoryProgress();
    draw(lastTime);
  }

  function buildSim(data) {
    const revision = ++layoutRevision;
    const prepared = prepareSectorsGraphLayout(data, { mobile: isMobile() });
    const initial = createInitialSectorsGraphLayout(prepared);
    canvas.dataset.forceRuntime = 'worker-pending';
    layoutRunner.run('settle', prepared)
      .then((next) => applySettledLayout(next, revision))
      .catch((error) => {
        if (error?.name === 'AbortError' || revision !== layoutRevision) return;
        canvas.dataset.forceRuntime = 'fallback-pending';
        setTimeout(() => {
          if (revision !== layoutRevision) return;
          applySettledLayout(
            encodeSectorsGraphPositions(settlePreparedSectorsGraphLayout(prepared)),
            revision,
          );
        }, 0);
      });
    return initial;
  }

  function hiddenNode(node) {
    return node.kind === 'pole' || node.kind === 'anchor';
  }

  function selectableNodes() {
    return sim.nodes.filter((node) => !hiddenNode(node));
  }

  function preloadLogos() {
    for (const node of selectableNodes()) {
      if (!node.logo || logoImages.has(node.logo)) continue;
      const image = new Image();
      logoImages.set(node.logo, { image, ready: false, failed: false });
      image.onload = () => {
        const entry = logoImages.get(node.logo);
        if (entry) entry.ready = true;
      };
      image.onerror = () => {
        const entry = logoImages.get(node.logo);
        if (entry) entry.failed = true;
      };
      image.src = node.logo;
    }
  }

  function revealFor(item) {
    const start = Number.isFinite(item.reveal)
      ? item.reveal
      : STAGE_REVEAL[item.stage] ?? 0.8;
    if (reduce) return storyProgress >= start ? 1 : 0;
    return smoothstep(start, Math.min(1, start + 0.095), storyProgress);
  }

  function currentChapter() {
    const chapters = sim.chapters || [];
    let chapter = chapters[0] || null;
    for (const candidate of chapters) {
      if (storyProgress + 0.0001 >= (candidate.start || 0)) chapter = candidate;
    }
    return chapter;
  }

  function updateSemanticState(selected = null) {
    const nodes = selectableNodes();
    const relationships = sim.links.filter((link) => link.kind !== 'pole' && link.kind !== 'anchor').length;
    const zh = getLang() === 'zh';
    const chapter = currentChapter();
    if (summaryElement) {
      const base = zh
        ? (chapter?.description_zh || `星图含 ${nodes.length} 个实体与 ${relationships} 条经核验关系。`)
        : (chapter?.description_en || `Map contains ${nodes.length} entities and ${relationships} verified relationships.`);
      summaryElement.textContent = `${base}${selected ? (zh ? ` 当前聚焦：${labelFor(selected)}。` : ` Focus: ${labelFor(selected)}.`) : ''}`;
    }
    canvas.setAttribute(
      'aria-label',
      `${zh ? 'AI 生态滚动叙事星图' : 'Scroll-driven AI ecosystem storyboard'}${selected ? ` · ${labelFor(selected)}` : ''}`,
    );
    controlHost?.querySelectorAll('button[data-node-index]').forEach((button, index) => {
      button.setAttribute('aria-pressed', String(Boolean(selected && nodes[index] === selected)));
    });
  }

  function renderNodeControls() {
    if (!controlHost) return updateSemanticState();
    controlHost.replaceChildren();
    selectableNodes().forEach((node, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.nodeIndex = String(index);
      button.textContent = `${COUNTRY_BADGE[node.country] || node.country || ''} ${labelFor(node)}`.trim();
      button.setAttribute('aria-pressed', 'false');
      controlHost.appendChild(button);
    });
    updateSemanticState();
  }

  function updateStoryProgress() {
    if (!storyHost) return;
    const rect = storyHost.getBoundingClientRect();
    const span = Math.max(1, storyHost.offsetHeight - innerHeight);
    const next = clamp01(-rect.top / span);
    storyProgress = next;
    const chapter = currentChapter();
    const nextChapterId = chapter?.id || '';
    if (nextChapterId !== currentChapterId) {
      currentChapterId = nextChapterId;
      storyHost.dataset.graphChapter = currentChapterId;
      storySteps.forEach((step) => step.classList.toggle('is-active', step.dataset.graphStep === currentChapterId));
      updateSemanticState(activeNode);
    }
    if (progressElement) progressElement.style.transform = `scaleX(${storyProgress})`;
  }

  function size() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    dpr = renderPolicy.computeDpr(W, H, { minDpr: 0.75, maxDpr: 2 });
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const visible = selectableNodes();
    const xs = visible.map((node) => node.x);
    const ys = visible.map((node) => node.y);
    const minX = Math.min(...xs, -1);
    const maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, -1);
    const maxY = Math.max(...ys, 1);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const padX = isMobile() ? 88 : 190;
    const padY = isMobile() ? 180 : 230;
    homeScale = Math.max(34, Math.min((W - padX) / spanX, (H - padY) / spanY));
    homeX = -((minX + maxX) / 2) * homeScale;
    homeY = -((minY + maxY) / 2) * homeScale;
    maxRadius = visible.reduce((max, node) => Math.max(max, Math.hypot(node.x, node.y)), 1);
    if (isMobile() && sim.mode === 'ecosystem') {
      const byId = new Map(visible.map((node) => [node.id, node]));
      MOBILE_NODE_ROWS.forEach((row, rowIndex) => {
        row.forEach((id, columnIndex) => {
          const node = byId.get(id);
          if (!node) return;
          node._mobileX = W * (columnIndex + 1) / (row.length + 1);
          node._mobileY = 92 + rowIndex * Math.max(112, (H - 190) / 6);
        });
      });
    } else {
      visible.forEach((node) => {
        delete node._mobileX;
        delete node._mobileY;
      });
    }
    if (!sized) {
      cam.x = cam.tx = homeX;
      cam.y = cam.ty = homeY;
      sized = true;
    } else {
      cam.tx = homeX;
      cam.ty = homeY;
    }
  }

  function worldToScreen(x, y) {
    return [W / 2 + cam.x + x * homeScale, H / 2 + cam.y + y * homeScale];
  }

  function screenPosition(node, time) {
    if (isMobile() && Number.isFinite(node._mobileX) && Number.isFinite(node._mobileY)) {
      if (reduce) return [node._mobileX, node._mobileY];
      const phase = node._phase ?? (node._phase = Math.random() * Math.PI * 2);
      return [
        node._mobileX + Math.sin(time * 0.52 + phase) * 1.2,
        node._mobileY + Math.cos(time * 0.43 + phase * 1.3) * 1.2,
      ];
    }
    return worldToScreen(...breathe(node, time));
  }

  function screenToWorld(sx, sy) {
    return [(sx - W / 2 - cam.x) / homeScale, (sy - H / 2 - cam.y) / homeScale];
  }

  function nodePlateSize(node) {
    const mobile = isMobile();
    const primary = node.kind === 'model' || node.kind === 'initiative';
    return {
      width: mobile ? (primary ? 66 : 58) : (primary ? 82 : 70),
      height: mobile ? (primary ? 46 : 42) : (primary ? 56 : 48),
    };
  }

  function nodeAt(sx, sy) {
    for (let index = sim.nodes.length - 1; index >= 0; index--) {
      const node = sim.nodes[index];
      if (hiddenNode(node) || revealFor(node) < 0.2) continue;
      const [x, y] = screenPosition(node, 0);
      const plate = nodePlateSize(node);
      if (Math.abs(sx - x) <= plate.width / 2 + 7 && Math.abs(sy - y) <= plate.height / 2 + 12) return node;
    }
    return null;
  }

  function goHome() {
    cam.tx = homeX;
    cam.ty = homeY;
    camTau = FOCUS_TAU;
    focusing = true;
  }

  function activateNode(node) {
    if (!node) return;
    activeNode = node;
    keyboardIndex = Math.max(0, selectableNodes().indexOf(node));
    onSelect(node);
    if (!isMobile()) {
      cam.tx = -node.x * homeScale;
      cam.ty = -node.y * homeScale;
      camTau = FOCUS_TAU;
      focusing = true;
    }
    updateSemanticState(node);
  }

  function breathe(node, time) {
    if (reduce) return [node.x, node.y];
    const phase = node._phase ?? (node._phase = Math.random() * Math.PI * 2);
    const amplitude = node.kind === 'model' ? 0.012 : 0.008;
    return [
      node.x + Math.sin(time * 0.52 + phase) * amplitude,
      node.y + Math.cos(time * 0.43 + phase * 1.3) * amplitude,
    ];
  }

  function nodeColor(node) {
    return node.color || KIND_COLOR[node.kind] || '#EEF7FB';
  }

  /** Bloc tint used for the plate ring and glow. Kind colour still drives the
   *  logo plate itself, so relationship type and geopolitics stay separable. */
  function blocColor(node) {
    return BLOC_COLOR[node.bloc] || BLOC_COLOR.neutral;
  }

  function edgeColor(link) {
    return EDGE_COLOR[link.type] || EDGE_COLOR[link.kind] || '#78D8FF';
  }

  /**
   * Dual-polar stroke for an edge (RB-P0-03). A US-to-China edge is painted as a
   * blue-to-red gradient along its own direction — that is the rivalry line made
   * literal. Edges touching a neutral supplier fade from the bloc colour into the
   * neutral teal instead, and same-bloc edges keep their relationship-type colour
   * so the existing legend still reads correctly.
   *
   * The shipped dataset has 3 cross-bloc edges out of 19, so this allocates at
   * most 3 gradients per frame; caching them per layout revision was rejected
   * because node positions move every frame (breathing plus camera pan), which
   * would make a cached gradient point the wrong way.
   */
  function edgeStroke(link, a, b, ax, ay, bx, by) {
    const flat = rgba(edgeColor(link), 0.82);
    if (!a.bloc || !b.bloc || a.bloc === b.bloc) return flat;
    const gradient = ctx.createLinearGradient(ax, ay, bx, by);
    gradient.addColorStop(0, rgba(blocColor(a), 0.92));
    gradient.addColorStop(0.5, rgba(edgeColor(link), 0.55));
    gradient.addColorStop(1, rgba(blocColor(b), 0.92));
    return gradient;
  }

  /**
   * The meridian: the vertical divide at world x = 0. Drawn on canvas rather than
   * as a CSS overlay so it pans with the graph on desktop; a fixed CSS line would
   * desync from the node columns the moment the user drags. Skipped on mobile,
   * where the hand-placed row grid is used instead of bloc columns and a divide
   * would be meaningless.
   */
  function drawMeridian(amount) {
    if (isMobile() || amount <= 0) return;
    const [x] = worldToScreen(0, 0);
    if (x < -40 || x > W + 40) return;
    const gradient = ctx.createLinearGradient(x, 0, x, H);
    gradient.addColorStop(0, rgba(BLOC_COLOR.US, 0.34 * amount));
    gradient.addColorStop(0.45, `rgba(120,140,180,${0.05 * amount})`);
    gradient.addColorStop(0.55, `rgba(120,140,180,${0.05 * amount})`);
    gradient.addColorStop(1, rgba(BLOC_COLOR.CN, 0.34 * amount));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, H - 8);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.4;
    ctx.setLineDash(reduce ? [] : [6, 9]);
    ctx.stroke();
    ctx.restore();
  }

  function edgeCurve(link, ax, ay, bx, by) {
    const seed = Array.from(String(link.id || `${link.source}:${link.target}`))
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const sign = seed % 2 ? 1 : -1;
    const bend = Math.min(44, Math.hypot(bx - ax, by - ay) * 0.11) * sign;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.max(1, Math.hypot(dx, dy));
    return {
      cx: (ax + bx) / 2 - (dy / length) * bend,
      cy: (ay + by) / 2 + (dx / length) * bend,
    };
  }

  function quadPoint(ax, ay, cx, cy, bx, by, amount) {
    const inverse = 1 - amount;
    return [
      inverse * inverse * ax + 2 * inverse * amount * cx + amount * amount * bx,
      inverse * inverse * ay + 2 * inverse * amount * cy + amount * amount * by,
    ];
  }

  function isConnected(node, focus) {
    if (!focus || node === focus) return true;
    return sim.links.some((link) => {
      if (link.kind === 'anchor' || link.kind === 'pole' || revealFor(link) < 0.2) return false;
      const a = sim.nodes[link.a];
      const b = sim.nodes[link.b];
      return (a === focus && b === node) || (b === focus && a === node);
    });
  }

  function drawFallbackMark(node, x, y, width, height) {
    if (node.mark === 'msft') {
      const size = Math.min(width, height) * 0.23;
      const gap = size * 0.12;
      const startX = x - size - gap / 2;
      const startY = y - size - gap / 2;
      ['#F25022', '#7FBA00', '#00A4EF', '#FFB900'].forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(startX + (index % 2) * (size + gap), startY + Math.floor(index / 2) * (size + gap), size, size);
      });
      return;
    }
    ctx.fillStyle = node.mark === 'aws' ? '#232F3E' : '#11141B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${node.mark === '25×' ? 800 : 750} ${Math.min(20, height * 0.38)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.fillText(node.mark || labelFor(node).slice(0, 3), x, y + 1);
    if (node.mark === 'aws') {
      ctx.beginPath();
      ctx.arc(x + 1, y + 8, 15, 0.18, Math.PI - 0.2);
      ctx.strokeStyle = '#FF9900';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawLogo(node, x, y, width, height) {
    const entry = node.logo ? logoImages.get(node.logo) : null;
    if (!entry?.ready) return drawFallbackMark(node, x, y, width, height);
    const image = entry.image;
    const imageWidth = image.naturalWidth || image.width || 1;
    const imageHeight = image.naturalHeight || image.height || 1;
    const fit = Math.min((width - 16) / imageWidth, (height - 14) / imageHeight);
    const drawWidth = imageWidth * fit;
    const drawHeight = imageHeight * fit;
    ctx.drawImage(image, x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight);
  }

  function drawNode(node, time, focusNode) {
    const amount = revealFor(node);
    if (amount <= 0) return;
    const [x, y] = screenPosition(node, time);
    const plate = nodePlateSize(node);
    const focus = node === focusNode;
    const connected = isConnected(node, focusNode);
    const dim = connected ? 1 : 0.22;
    const scale = reduce ? amount : 0.82 + amount * 0.18;
    const width = plate.width * scale;
    const height = plate.height * scale;

    if (focus) {
      const pulse = reduce ? 1 : 1 + Math.sin(time * 2) * 0.045;
      roundedRect(ctx, x - width * 0.62 * pulse, y - height * 0.72 * pulse, width * 1.24 * pulse, height * 1.44 * pulse, 18);
      ctx.strokeStyle = rgba(blocColor(node), 0.5);
      ctx.lineWidth = 1;
      ctx.globalAlpha = amount;
      ctx.shadowColor = rgba(blocColor(node), 0.8);
      ctx.shadowBlur = 22;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Ring and glow carry the bloc; the plate interior keeps the kind colour.
    const bloc = blocColor(node);
    ctx.save();
    ctx.globalAlpha = amount * dim;
    ctx.shadowColor = rgba(bloc, focus ? 0.7 : 0.4);
    ctx.shadowBlur = focus ? 26 : 16;
    roundedRect(ctx, x - width / 2, y - height / 2, width, height, 13);
    ctx.fillStyle = node.logo_bg || 'rgba(249,250,247,.96)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = focus ? 2.2 : 1.3;
    ctx.strokeStyle = rgba(bloc, focus ? 0.98 : 0.66);
    ctx.stroke();
    roundedRect(ctx, x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4, 11);
    ctx.clip();
    drawLogo(node, x, y, width, height);
    ctx.restore();

    const badge = COUNTRY_BADGE[node.country] || node.country;
    if (badge) {
      ctx.save();
      ctx.globalAlpha = amount * dim;
      ctx.font = '700 8.5px -apple-system,BlinkMacSystemFont,"Apple Color Emoji","Segoe UI Emoji",sans-serif';
      const badgeWidth = Math.ceil(ctx.measureText(badge).width) + 12;
      const badgeX = x + width / 2 - badgeWidth * 0.72;
      const badgeY = y - height / 2 - 8;
      roundedRect(ctx, badgeX, badgeY, badgeWidth, 18, 9);
      ctx.fillStyle = 'rgba(9,11,17,.94)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#F7F8FC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, badgeX + badgeWidth / 2, badgeY + 9.4);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = amount * dim;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${node.kind === 'model' ? 720 : 660} ${isMobile() ? 9.5 : 10.5}px "PP Fraktion Mono","IBM Plex Mono",monospace`;
    ctx.fillStyle = focus ? '#FFFFFF' : 'rgba(241,244,252,.86)';
    ctx.fillText(labelFor(node), x, y + height / 2 + 17);
    ctx.restore();
  }

  function updateTooltip() {
    if (!tooltipElement || !hoverNode || dragging || panning) {
      if (tooltipElement) {
        tooltipElement.hidden = true;
        tooltipElement.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    const products = Array.isArray(hoverNode.products) ? hoverNode.products.slice(0, 2).join(' · ') : '';
    const title = document.createElement('b');
    title.textContent = `${COUNTRY_BADGE[hoverNode.country] || ''} ${labelFor(hoverNode)}`.trim();
    tooltipElement.replaceChildren(title);
    if (products) {
      const line = document.createElement('span');
      line.textContent = products;
      tooltipElement.appendChild(line);
    }
    tooltipElement.style.transform = `translate(${Math.min(W - 225, hoverSX + 16)}px,${Math.max(12, hoverSY - 20)}px)`;
    tooltipElement.hidden = false;
    tooltipElement.setAttribute('aria-hidden', 'false');
  }

  function draw(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const focusNode = dragging ? dragNode : (hoverNode || activeNode);

    for (const dot of ambientDots) {
      const pulse = reduce ? 0.22 : 0.18 + Math.sin(time * 0.28 + dot.phase) * 0.07;
      ctx.beginPath();
      ctx.arc(dot.x * W, dot.y * H, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210,226,255,${pulse})`;
      ctx.fill();
    }

    // The divide is the first thing to appear: act 1 draws it into an empty field
    // before any node ignites, so the geography is established before the actors.
    drawMeridian(sim.mode === 'ecosystem' ? smoothstep(0.02, 0.16, storyProgress) : 0);

    for (const link of sim.links) {
      if (link.kind === 'pole' || link.kind === 'anchor') continue;
      const amount = revealFor(link);
      if (amount <= 0) continue;
      const a = sim.nodes[link.a];
      const b = sim.nodes[link.b];
      const nodeAmount = Math.min(revealFor(a), revealFor(b));
      if (nodeAmount <= 0) continue;
      const [ax, ay] = screenPosition(a, time);
      const [bx, by] = screenPosition(b, time);
      const { cx, cy } = edgeCurve(link, ax, ay, bx, by);
      const connected = !focusNode || a === focusNode || b === focusNode;
      const dim = connected ? 1 : 0.14;
      const color = edgeColor(link);
      ctx.save();
      ctx.globalAlpha = amount * nodeAmount * dim;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.strokeStyle = edgeStroke(link, a, b, ax, ay, bx, by);
      ctx.lineWidth = (connected && focusNode ? 1.9 : 0.85) + (link.weight || 0.5) * 0.95;
      ctx.shadowColor = rgba(color, connected ? 0.58 : 0.18);
      ctx.shadowBlur = connected ? 10 : 3;
      ctx.stroke();

      if (!reduce && amount > 0.7) {
        const packetCount = renderPolicy.qualityTier === 'low' ? 1 : 2;
        for (let packet = 0; packet < packetCount; packet++) {
          const progress = (time * (0.1 + (link.weight || 0.5) * 0.04) + packet / packetCount + link.a * 0.13) % 1;
          const [px, py] = quadPoint(ax, ay, cx, cy, bx, by, progress);
          ctx.beginPath();
          ctx.arc(px, py, connected && focusNode ? 2.3 : 1.45, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = amount * dim * (0.48 + 0.52 * Math.sin(progress * Math.PI));
          ctx.shadowBlur = 12;
          ctx.fill();
        }
      }
      ctx.restore();
    }

    for (const node of sim.nodes) {
      if (!hiddenNode(node)) drawNode(node, time, focusNode);
    }
    updateTooltip();
  }

  function pointerDown(sx, sy) {
    downX = sx;
    downY = sy;
    lastX = sx;
    lastY = sy;
    moved = false;
    lastMoveT = performance.now();
    panVelX = 0;
    panVelY = 0;
    inertiaActive = false;
    const node = nodeAt(sx, sy);
    if (node) {
      dragNode = node;
      dragNode.fx = dragNode.x;
      dragNode.fy = dragNode.y;
      dragging = true;
    } else {
      panning = true;
      focusing = false;
      camTau = PAN_TAU;
    }
  }

  function pointerMove(sx, sy) {
    hoverSX = sx;
    hoverSY = sy;
    if (Math.hypot(sx - downX, sy - downY) > 4) moved = true;
    if (dragging && dragNode) {
      const [wx, wy] = screenToWorld(sx, sy);
      dragNode.fx = wx;
      dragNode.fy = wy;
    } else if (panning) {
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT) / 1000;
      const dx = sx - lastX;
      const dy = sy - lastY;
      cam.tx += dx;
      cam.ty += dy;
      panVelX = dx / dt;
      panVelY = dy / dt;
      lastMoveT = now;
    } else {
      hoverNode = nodeAt(sx, sy);
      canvas.style.cursor = hoverNode ? 'pointer' : 'grab';
    }
    lastX = sx;
    lastY = sy;
  }

  function pointerUp(sx, sy) {
    if (dragNode) {
      delete dragNode.fx;
      delete dragNode.fy;
      dragNode = null;
    }
    if (!moved) {
      const node = nodeAt(sx, sy);
      if (node) activateNode(node);
      else if (panning) {
        activeNode = null;
        goHome();
        updateSemanticState();
      }
    } else if (panning && !reduce && (Math.abs(panVelX) > 2 || Math.abs(panVelY) > 2)) {
      inertiaActive = true;
    }
    dragging = false;
    panning = false;
    if (pendingSettledLayout) {
      const pending = pendingSettledLayout;
      applySettledLayout(pending.snapshot, pending.revision);
    }
  }

  function relXY(event) {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  const onPointerDown = (event) => {
    const [x, y] = relXY(event);
    if (event.pointerType === 'touch') {
      touchTap = { id: event.pointerId, x, y };
      return;
    }
    if (event.button !== 0) return;
    canvas.setPointerCapture?.(event.pointerId);
    pointerDown(x, y);
  };

  const onPointerMove = (event) => {
    const [x, y] = relXY(event);
    if (event.pointerType === 'touch') {
      if (touchTap && Math.hypot(x - touchTap.x, y - touchTap.y) > 8) touchTap = null;
      return;
    }
    pointerMove(x, y);
  };

  const onPointerUp = (event) => {
    const [x, y] = relXY(event);
    if (event.pointerType === 'touch') {
      if (touchTap?.id === event.pointerId && Math.hypot(x - touchTap.x, y - touchTap.y) <= 8) {
        const node = nodeAt(x, y);
        if (node) activateNode(node);
      }
      touchTap = null;
      return;
    }
    pointerUp(x, y);
  };

  const onPointerCancel = (event) => {
    if (event.pointerType === 'touch') touchTap = null;
    if (dragNode) {
      delete dragNode.fx;
      delete dragNode.fy;
    }
    dragNode = null;
    dragging = false;
    panning = false;
  };

  const onPointerLeave = (event) => {
    if (event.pointerType !== 'touch' && !dragging && !panning) {
      hoverNode = null;
      canvas.style.cursor = 'grab';
      updateTooltip();
    }
  };

  const onKeyDown = (event) => {
    if (event.target !== canvas) return;
    const nodes = selectableNodes();
    if (!nodes.length) return;
    if (event.key === 'Escape' || event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      activeNode = null;
      goHome();
      updateSemanticState();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      keyboardIndex = (keyboardIndex + 1) % nodes.length;
      activateNode(nodes[keyboardIndex]);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      keyboardIndex = (keyboardIndex - 1 + nodes.length) % nodes.length;
      activateNode(nodes[keyboardIndex]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      activateNode(nodes[keyboardIndex]);
    }
  };

  const onControlClick = (event) => {
    const button = event.target.closest?.('button[data-node-index]');
    if (!button || !controlHost?.contains(button)) return;
    activateNode(selectableNodes()[Number(button.dataset.nodeIndex)]);
  };

  let scrollTicking = false;
  const onScroll = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      updateStoryProgress();
      if (!running) draw(lastTime);
    });
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('keydown', onKeyDown);
  controlHost?.addEventListener('click', onControlClick);
  addEventListener('scroll', onScroll, { passive: true });

  let running = false;
  let raf = 0;
  let lastFrame = 0;
  let lastTime = 0;
  let renderSurface = null;

  function loop(timestamp) {
    const frameMs = lastFrame ? timestamp - lastFrame : 0;
    const dt = lastFrame ? Math.min(0.05, frameMs / 1000) : 1 / 60;
    lastFrame = timestamp;
    lastTime = timestamp * 0.001;

    if (inertiaActive) {
      cam.tx += panVelX * dt;
      cam.ty += panVelY * dt;
      panVelX = decayVelocity(panVelX, dt);
      panVelY = decayVelocity(panVelY, dt);
      const clamped = clampPanTarget(cam.tx, cam.ty, homeScale, maxRadius, W, H);
      cam.tx = clamped.tx;
      cam.ty = clamped.ty;
      if (panVelX === 0 && panVelY === 0) inertiaActive = false;
    }

    const x = smoothDamp(cam.x, cam.tx, cam.vx, camTau, dt);
    const y = smoothDamp(cam.y, cam.ty, cam.vy, camTau, dt);
    cam.x = x.value;
    cam.vx = x.velocity;
    cam.y = y.value;
    cam.vy = y.velocity;
    if (focusing && Math.abs(cam.tx - cam.x) < 0.5 && Math.abs(cam.ty - cam.y) < 0.5) {
      focusing = false;
      camTau = PAN_TAU;
    }

    draw(lastTime);
    renderSurface?.reportFrame(frameMs);
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    lastFrame = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  sim = buildSim(sectorsData || {});
  preloadLogos();
  renderNodeControls();
  updateStoryProgress();
  size();
  draw(0);

  renderSurface = renderCoordinator.register({
    id: 'sectors:story-graph',
    element: canvas,
    cost: 'medium',
    targetFps: 120,
    onResume: start,
    onPause: stop,
    onResize() {
      size();
      updateStoryProgress();
      draw(lastTime);
    },
    onQualityChange(nextPolicy) {
      renderPolicy = nextPolicy;
    },
  });

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        if (Math.abs(rect.width - W) > 0.5 || Math.abs(rect.height - H) > 0.5) {
          size();
          updateStoryProgress();
          draw(lastTime);
        }
      })
    : null;
  resizeObserver?.observe(canvas);

  return {
    update(data) {
      sim = buildSim(data || {});
      keyboardIndex = 0;
      activeNode = null;
      preloadLogos();
      renderNodeControls();
      size();
      updateStoryProgress();
      draw(lastTime);
    },
    refreshLanguage() {
      renderNodeControls();
      updateSemanticState(activeNode);
      draw(lastTime);
    },
    destroy() {
      layoutRevision += 1;
      layoutRunner.destroy();
      renderSurface?.unregister();
      resizeObserver?.disconnect();
      stop();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('keydown', onKeyDown);
      controlHost?.removeEventListener('click', onControlClick);
      removeEventListener('scroll', onScroll);
      controlHost?.replaceChildren();
    },
  };
}
