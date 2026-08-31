import { generateSandboxCity } from '../city/generate.ts';
import {
  CITY_ASSET_CATEGORIES,
  countVisibleCityAssetCategories,
  createCityAssetVisibility,
  setCityAssetCategoryVisibility,
} from '../city/assetVisibility.ts';
import {
  CITY_CONCEPT_GENERATION_PROFILES,
  normalizeCityConceptProfileKey,
} from '../city/profiles.ts';
import {
  cityMetricPolylinePoints,
  createCityMetricChartSnapshot,
} from '../city/metricCharts.ts';
import { cityMetricSnapshotAt } from '../city/schedule.ts';

const canvas = document.querySelector('[data-city-canvas]');
const timeline = document.querySelector('[data-city-timeline]');
const dayOutput = document.querySelector('[data-city-day]');
const seedOutput = document.querySelector('[data-city-seed]');
const loadButton = document.querySelector('[data-city-load]');
const playButton = document.querySelector('[data-city-play]');
const tourButton = document.querySelector('[data-city-tour]');
const viewButton = document.querySelector('[data-city-view]');
const dataButton = document.querySelector('[data-city-data]');
const dataPanel = document.querySelector('[data-city-data-panel]');
const layerButton = document.querySelector('[data-city-layers]');
const layerPanel = document.querySelector('[data-city-layer-panel]');
const assetResetButton = document.querySelector('[data-city-assets-reset]');
const rebuildButton = document.querySelector('[data-city-rebuild]');
const resetButton = document.querySelector('[data-city-reset]');
const profileSelect = document.querySelector('[data-city-profile]');
const profileNote = document.querySelector('[data-city-profile-note]');
const summaryModel = document.querySelector('[data-city-summary-model]');
const status = document.querySelector('[data-city-status]');
const stage = document.querySelector('[data-city-stage]');
const languageButton = document.querySelector('.city-lang');
const locationParams = new URLSearchParams(window.location.search);
const deviceAuditMode = locationParams.get('device-audit') === '1';
if (deviceAuditMode) document.documentElement.dataset.afflatusLocale = 'inline';

const metricNodes = Object.freeze({
  completion: document.querySelector('[data-city-metric="completion"]'),
  residents: document.querySelector('[data-city-metric="residents"]'),
  jobs: document.querySelector('[data-city-metric="jobs"]'),
  energy: document.querySelector('[data-city-metric="energy"]'),
  traffic: document.querySelector('[data-city-metric="traffic"]'),
});
const metricCauseNodes = Object.freeze({
  completion: document.querySelector('[data-city-metric-cause="completion"]'),
  residents: document.querySelector('[data-city-metric-cause="residents"]'),
  jobs: document.querySelector('[data-city-metric-cause="jobs"]'),
  energy: document.querySelector('[data-city-metric-cause="energy"]'),
  traffic: document.querySelector('[data-city-metric-cause="traffic"]'),
});
const completionRing = document.querySelector('[data-city-chart-ring]');
const residentChartColumns = [...document.querySelectorAll('[data-city-chart-column]')];
const metricChartFillNodes = Object.freeze({
  jobs: document.querySelector('[data-city-chart-fill="jobs"]'),
  traffic: document.querySelector('[data-city-chart-fill="traffic"]'),
});
const energyChartLine = document.querySelector('[data-city-chart-line]');
const assetToggleNodes = [...document.querySelectorAll('[data-city-asset-toggle]')];
const assetCountNodes = Object.freeze(Object.fromEntries(CITY_ASSET_CATEGORIES.map(({ key }) => [
  key,
  document.querySelector(`[data-city-asset-count="${key}"]`),
])));
const layerSummary = document.querySelector('[data-city-layer-summary]');

const METRIC_REFRESH_INTERVAL_MS = 500;

let scene = null;
let plan = null;
let sceneModule = null;
let dataPanelOpen = false;
let layerPanelOpen = false;
let assetVisibility = createCityAssetVisibility();
let assetInventory = null;
let latestMetricSnapshot = null;
let latestMetricChartSnapshot = null;
let lastMetricRenderAt = Number.NEGATIVE_INFINITY;
let metricRenderCount = 0;
let metricChartRenderCount = 0;
let forceNextMetricRender = false;
let currentDay = 0;
let preTourPanelState = null;
let deviceAuditController = null;

const rendererOnlyControls = Object.freeze([
  playButton,
  tourButton,
  viewButton,
  resetButton,
].filter(Boolean));
const pageControllerControls = Object.freeze([
  timeline,
  profileSelect,
  dataButton,
  layerButton,
  rebuildButton,
  languageButton,
].filter(Boolean));

const readLanguage = () => document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';

function translated(en, zh) {
  return readLanguage() === 'zh' ? zh : en;
}

function updateDocumentTitle() {
  document.title = translated(
    'Cityview — Urban Construction Sandbox · Afflatus',
    '城市推演台 — 城市建造沙盒 · Afflatus',
  );
}

function setStatus(en, zh) {
  if (!status) return;
  status.dataset.en = en;
  status.dataset.zh = zh;
  status.textContent = translated(en, zh);
}

function formatInteger(value) {
  return new Intl.NumberFormat(readLanguage() === 'zh' ? 'zh-CN' : 'en-AU', {
    maximumFractionDigits: 0,
  }).format(value);
}

function renderMetricCharts(day) {
  if (!plan) return;
  latestMetricChartSnapshot = createCityMetricChartSnapshot(plan, day);
  const chart = latestMetricChartSnapshot;
  completionRing?.setAttribute(
    'stroke-dashoffset',
    String(Math.round((1 - chart.completion) * 1000) / 10),
  );
  residentChartColumns.forEach((column, index) => {
    const value = chart.residents[index] ?? 0;
    column.style.setProperty('--city-chart-value', `${Math.round(value * 1000) / 10}%`);
  });
  for (const [key, node] of Object.entries(metricChartFillNodes)) {
    const value = chart[key] ?? 0;
    node?.style.setProperty('--city-chart-value', `${Math.round(value * 1000) / 10}%`);
  }
  energyChartLine?.setAttribute('points', cityMetricPolylinePoints(chart.energy));
  metricChartRenderCount += 1;
}

function renderMetricSnapshot(snapshot, now = performance.now()) {
  const { metrics, readings } = snapshot;
  if (metricNodes.completion) metricNodes.completion.textContent = `${Math.round(metrics.completion * 100)}%`;
  if (metricNodes.residents) metricNodes.residents.textContent = formatInteger(metrics.residents);
  if (metricNodes.jobs) metricNodes.jobs.textContent = formatInteger(metrics.jobs);
  if (metricNodes.energy) metricNodes.energy.textContent = `${metrics.energy}`;
  if (metricNodes.traffic) metricNodes.traffic.textContent = `${metrics.traffic}`;

  for (const [key, node] of Object.entries(metricCauseNodes)) {
    const cause = readings[key]?.cause;
    if (!node || !cause) continue;
    node.dataset.en = cause.en;
    node.dataset.zh = cause.zh;
    node.textContent = translated(cause.en, cause.zh);
  }

  renderMetricCharts(snapshot.day);

  lastMetricRenderAt = now;
  metricRenderCount += 1;
}

function updateMetrics(day, { force = false } = {}) {
  if (!plan) return;
  latestMetricSnapshot = cityMetricSnapshotAt(plan, day);
  stage?.style.setProperty('--city-progress', `${Math.round(latestMetricSnapshot.metrics.completion * 100)}%`);
  if (!dataPanelOpen) return;

  const now = performance.now();
  const isBoundaryDay = latestMetricSnapshot.day === 0
    || latestMetricSnapshot.day === plan.profile.totalDays;
  if (!force && !isBoundaryDay && now - lastMetricRenderAt < METRIC_REFRESH_INTERVAL_MS) return;
  renderMetricSnapshot(latestMetricSnapshot, now);
}

function updateDay(day, { forceMetrics = false } = {}) {
  const rounded = Math.round(day);
  currentDay = day;
  if (timeline) timeline.value = String(rounded);
  if (dayOutput) dayOutput.textContent = String(rounded).padStart(3, '0');
  updateMetrics(day, { force: forceMetrics || forceNextMetricRender });
  forceNextMetricRender = false;
}

function setRendererAvailable(isAvailable) {
  const available = Boolean(isAvailable);
  stage?.setAttribute('data-city-renderer-available', String(available));
  for (const control of rendererOnlyControls) control.disabled = !available;
  if (!available) {
    updatePlayButton(false);
    updateTourButton(false);
    updateViewButton(null);
  }
}

function setPageControllerReady(isReady) {
  for (const control of pageControllerControls) control.disabled = !isReady;
}

function setDataPanelOpen(nextOpen, { announce = true } = {}) {
  if (nextOpen && layerPanelOpen) setLayerPanelOpen(false, { announce: false });
  dataPanelOpen = Boolean(nextOpen);
  if (dataPanel) dataPanel.hidden = !dataPanelOpen;
  dataButton?.setAttribute('aria-expanded', String(dataPanelOpen));
  stage?.setAttribute('data-city-data-open', String(dataPanelOpen));

  if (dataPanelOpen && latestMetricSnapshot) renderMetricSnapshot(latestMetricSnapshot);
  if (!announce) return;
  if (dataPanelOpen) {
    setStatus(
      'Causal data is open. Every value is simulated from construction state.',
      '因果数据已打开。每项数值都由施工状态模拟得出。',
    );
  } else {
    setStatus(
      'Data panel closed; metric DOM updates are paused.',
      '数据面板已关闭；指标 DOM 更新已暂停。',
    );
  }
}

function renderLayerEditor() {
  const visibleCount = countVisibleCityAssetCategories(assetVisibility);
  const total = CITY_ASSET_CATEGORIES.length;
  if (layerSummary) {
    const en = `${visibleCount}/${total} visible`;
    const zh = `显示 ${visibleCount}/${total}`;
    layerSummary.dataset.en = en;
    layerSummary.dataset.zh = zh;
    layerSummary.textContent = translated(en, zh);
  }
  for (const input of assetToggleNodes) {
    input.checked = assetVisibility[input.dataset.cityAssetToggle] !== false;
  }
  for (const { key } of CITY_ASSET_CATEGORIES) {
    if (assetCountNodes[key]) assetCountNodes[key].textContent = formatInteger(assetInventory?.[key] ?? 0);
  }
  if (assetResetButton) assetResetButton.disabled = visibleCount === total;
}

function setLayerPanelOpen(nextOpen, { announce = true, focus = true } = {}) {
  if (nextOpen && dataPanelOpen) setDataPanelOpen(false, { announce: false });
  layerPanelOpen = Boolean(nextOpen);
  if (layerPanel) layerPanel.hidden = !layerPanelOpen;
  layerButton?.setAttribute('aria-expanded', String(layerPanelOpen));
  stage?.setAttribute('data-city-layers-open', String(layerPanelOpen));
  if (layerPanelOpen) {
    renderLayerEditor();
    if (focus) assetToggleNodes[0]?.focus();
  }

  if (!announce) return;
  if (layerPanelOpen) {
    setStatus(
      'Scene layers are open. Visibility changes do not alter simulation truth.',
      '场景图层已打开。显隐变化不会改变模拟真相。',
    );
  } else {
    setStatus('Scene layers closed.', '场景图层已关闭。');
  }
}

function updatePlayButton(isPlaying) {
  if (!playButton) return;
  playButton.dataset.playing = String(isPlaying);
  playButton.setAttribute('aria-pressed', String(isPlaying));
  const label = playButton.querySelector('[data-city-play-label]');
  if (label) {
    label.dataset.en = isPlaying ? 'Pause' : 'Build';
    label.dataset.zh = isPlaying ? '暂停' : '建设';
    label.textContent = translated(label.dataset.en, label.dataset.zh);
  }
}

function updateTourButton(isTouring) {
  if (!tourButton) return;
  tourButton.dataset.touring = String(isTouring);
  tourButton.setAttribute('aria-pressed', String(isTouring));
  const label = tourButton.querySelector('[data-city-tour-label]');
  if (!label) return;
  label.dataset.en = isTouring ? 'Exit tour' : 'Tour';
  label.dataset.zh = isTouring ? '退出巡游' : '巡游';
  label.textContent = translated(label.dataset.en, label.dataset.zh);
}

function updateViewButton(viewState) {
  if (!viewButton) return;
  const label = viewButton.querySelector('[data-city-view-label]');
  const en = viewState ? `View ${viewState.index + 1}/${viewState.total}` : 'Hero view';
  const zh = viewState ? `视角 ${viewState.index + 1}/${viewState.total}` : '英雄视角';
  if (label) {
    label.dataset.en = en;
    label.dataset.zh = zh;
    label.textContent = translated(en, zh);
  }
  if (viewState) {
    viewButton.setAttribute(
      'aria-label',
      translated(`Next hero view. Current: ${viewState.labels.en}`, `下一个英雄视角。当前：${viewState.labels.zh}`),
    );
  } else {
    viewButton.setAttribute('aria-label', translated('Show next hero view', '显示下一个英雄视角'));
  }
}

function seedFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get('seed') || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return requested || 'afflatus-city-001';
}

function profileFromLocation() {
  return normalizeCityConceptProfileKey(new URLSearchParams(window.location.search).get('profile'));
}

function updateProfileUi(profileKey) {
  const profile = CITY_CONCEPT_GENERATION_PROFILES[normalizeCityConceptProfileKey(profileKey)];
  if (profileSelect) profileSelect.value = profile.key;
  stage?.setAttribute('data-city-profile-key', profile.key);
  if (profileNote) {
    const en = `${profile.labels.en} · generated concept—not GIS`;
    const zh = `${profile.labels.zh} · 程序化概念，并非 GIS`;
    profileNote.dataset.en = en;
    profileNote.dataset.zh = zh;
    profileNote.textContent = translated(en, zh);
  }
  if (summaryModel) {
    const summaries = {
      sandbox: {
        en: 'The sandbox contains 64 blocks and 18 road segments. Buildings grow through skeleton, slab, shell and roof phases; all visible metrics are computed from that state.',
        zh: '沙盒包含 64 个街区与 18 条道路。建筑依次经历骨架、楼板、外壳与屋顶阶段；所有可见指标都由这些状态计算得出。',
      },
      shanghai: {
        en: 'This generated Shanghai concept reserves a vertical waterfront and three hero blocks: a pearl mast, a stepped crown and a corn-cob curve tower. These are planning silhouettes, not surveyed buildings or GIS.',
        zh: '上海程序化概念样板预留纵向水岸与三个英雄街区：明珠塔体、阶梯冠顶和玉米形曲线塔。这些是规划轮廓，不是测绘建筑或 GIS。',
      },
      melbourne: {
        en: 'This generated Melbourne concept reserves a horizontal waterfront and three hero blocks: a long station hall, civic shards and an arts spire. These are planning silhouettes, not surveyed buildings or GIS.',
        zh: '墨尔本程序化概念样板预留横向水岸与三个英雄街区：长站房、城市折面建筑群和艺术尖塔。这些是规划轮廓，不是测绘建筑或 GIS。',
      },
      'hong-kong': {
        en: 'This generated Hong Kong concept places a dense left-driving waterfront core between Victoria Harbour and a low-poly mountain ridge. Its financial fins, stepped crown and cultural podium are planning silhouettes—not surveyed buildings or GIS.',
        zh: '香港程序化概念样板把左侧通行的高密滨水核心置于维港与低多边形山脊之间；金融折面塔、阶梯冠顶塔和文化裙楼都只是规划轮廓，并非测绘建筑或 GIS。',
      },
    };
    const copy = summaries[profile.key];
    summaryModel.dataset.en = copy.en;
    summaryModel.dataset.zh = copy.zh;
    summaryModel.textContent = translated(copy.en, copy.zh);
  }
}

function nextSeed() {
  return `city-${Date.now().toString(36)}`;
}

function setReadyStatus() {
  const profile = plan?.profile;
  const en = profile?.key === 'sandbox'
    ? 'Sandbox ready. Drag the timeline or orbit the city.'
    : `${profile?.labels.en ?? 'City concept'} ready. Drag the timeline or orbit the city.`;
  const zh = profile?.key === 'sandbox'
    ? '沙盒已就绪。可拖动时间轴或环绕城市。'
    : `${profile?.labels.zh ?? '城市概念'}已就绪。可拖动时间轴或环绕城市。`;
  setStatus(en, zh);
}

async function mountCity(seed, day = 0, profileKey = profileFromLocation()) {
  setStatus('Preparing deterministic city geometry…', '正在准备确定性城市几何…');
  stage?.setAttribute('aria-busy', 'true');
  setRendererAvailable(false);
  // Let the loading state and static poster paint before the optional WebGL
  // scene performs its synchronous setup work.
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  plan = generateSandboxCity(seed, profileKey);
  assetVisibility = createCityAssetVisibility();
  assetInventory = null;
  renderLayerEditor();
  if (seedOutput) seedOutput.textContent = seed;
  updateProfileUi(plan.profile.key);
  updateDay(day);
  try {
    sceneModule ??= await import('../scene/citySandbox.js');
    assetInventory = sceneModule.createCitySceneAssetInventory(plan);
    renderLayerEditor();
    scene?.destroy();
    scene = sceneModule.createCitySandbox({
      canvas,
      plan,
      initialDay: day,
      initialAssetVisibility: assetVisibility,
      onDayChange: updateDay,
      onPlaybackChange: updatePlayButton,
      onTourChange: (state) => {
        updateTourButton(state === true);
        stage?.setAttribute('data-city-touring', String(state === true));
        if (state === true) {
          preTourPanelState = Object.freeze({ data: dataPanelOpen, layers: layerPanelOpen });
          setDataPanelOpen(false, { announce: false });
          setLayerPanelOpen(false, { announce: false });
        }
        if (state === false && preTourPanelState) {
          const restore = preTourPanelState;
          preTourPanelState = null;
          if (restore.data) setDataPanelOpen(true, { announce: false });
          if (restore.layers) setLayerPanelOpen(true, { announce: false, focus: false });
        }
        if (state) updateViewButton(null);
        if (state === 'reduced') {
          setStatus('Reduced motion is on; switched to the completed overview.', '已开启减少动态效果；现在显示竣工总览。');
        } else if (state) {
          setStatus('Drone tour and construction timeline are synchronized.', '无人机巡游已与建设时间轴同步。');
        } else if (scene?.isPlaying?.()) {
          setStatus('Tour exited; construction playback continues.', '已退出巡游；建造时间轴继续播放。');
        } else {
          setReadyStatus();
        }
      },
      onFallback: () => {
        stage?.classList.add('is-poster');
        if (canvas) canvas.dataset.renderer = 'poster';
        setRendererAvailable(false);
        setStatus('Interactive WebGL is unavailable; the timeline, data and city summary remain available.', 'WebGL 互动不可用；时间轴、数据和城市摘要仍可使用。');
      },
    });
    if (scene.available) {
      stage?.classList.remove('is-poster');
      setRendererAvailable(true);
      setReadyStatus();
    } else {
      setRendererAvailable(false);
    }
  } catch (error) {
    console.warn('[cityview] scene initialization failed', error);
    stage?.classList.add('is-poster');
    if (canvas) canvas.dataset.renderer = 'poster';
    setRendererAvailable(false);
    setStatus('The 3D scene could not start; the timeline, data and city summary remain available.', '3D 场景未能启动；时间轴、数据和城市摘要仍可使用。');
  } finally {
    stage?.setAttribute('aria-busy', 'false');
    setPageControllerReady(true);
  }
}

timeline?.addEventListener('focus', () => {
  if (!scene?.isPlaying?.()) return;
  scene.setPlaying(false);
  setStatus(
    'Construction paused for timeline editing.',
    '建造已暂停，可编辑时间轴。',
  );
});

timeline?.addEventListener('input', () => {
  scene?.setPlaying(false);
  updatePlayButton(false);
  forceNextMetricRender = true;
  const nextDay = Number(timeline.value);
  updateDay(nextDay);
  scene?.setDay(nextDay);
});

playButton?.addEventListener('click', () => {
  if (!scene?.available) return;
  scene.cancelTour();
  const nextPlaying = !scene.isPlaying();
  scene.setPlaying(nextPlaying);
  if (nextPlaying && !scene.isPlaying() && scene.getDay() >= plan.profile.totalDays) {
    setStatus(
      'Reduced motion is on; construction moved directly to the completed state.',
      '已开启减少动态效果；建造已直接切换到竣工状态。',
    );
  }
});

tourButton?.addEventListener('click', () => {
  if (!scene?.available) return;
  if (scene.isTourActive()) {
    scene.cancelTour();
    tourButton.focus();
    return;
  }
  scene.startTour();
});

viewButton?.addEventListener('click', () => {
  if (!scene?.available) return;
  const view = scene.focusNextHero();
  if (!view) {
    setStatus('No hero view is available for this profile.', '当前样板没有可用的英雄视角。');
    return;
  }
  updateViewButton(view);
  setStatus(
    `Hero view ${view.index + 1}/${view.total}: ${view.labels.en}. Construction day unchanged.`,
    `英雄视角 ${view.index + 1}/${view.total}：${view.labels.zh}。建造日保持不变。`,
  );
});

dataButton?.addEventListener('click', () => {
  setDataPanelOpen(!dataPanelOpen);
});

layerButton?.addEventListener('click', () => {
  setLayerPanelOpen(!layerPanelOpen);
});

for (const input of assetToggleNodes) {
  input.addEventListener('change', () => {
    const category = CITY_ASSET_CATEGORIES.find(({ key }) => key === input.dataset.cityAssetToggle);
    if (!category) return;
    assetVisibility = setCityAssetCategoryVisibility(assetVisibility, category.key, input.checked);
    scene?.setAssetVisibility?.(assetVisibility);
    renderLayerEditor();
    setStatus(
      `${category.labels.en} layer ${input.checked ? 'shown' : 'hidden'}; construction and metrics are unchanged.`,
      `${category.labels.zh}图层已${input.checked ? '显示' : '隐藏'}；施工状态与指标保持不变。`,
    );
  });
}

assetResetButton?.addEventListener('click', () => {
  assetVisibility = createCityAssetVisibility();
  scene?.setAssetVisibility?.(assetVisibility);
  renderLayerEditor();
  setStatus('All scene layers are visible.', '所有场景图层均已显示。');
});

resetButton?.addEventListener('click', () => {
  if (!scene?.available) return;
  scene?.resetCamera();
  updateViewButton(null);
  setStatus('Camera returned to the planning view.', '镜头已回到规划视角。');
});

rebuildButton?.addEventListener('click', () => {
  const seed = nextSeed();
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  setStatus('Rebuilding from a new deterministic seed…', '正在使用新的确定性种子重建…');
  // A document navigation gives the old Three renderer a clean context-loss
  // boundary. Recreating a renderer immediately on the same canvas races the
  // previous renderer's forceContextLoss() teardown in several browsers.
  window.location.assign(url);
});

profileSelect?.addEventListener('change', () => {
  const profile = normalizeCityConceptProfileKey(profileSelect.value);
  const url = new URL(window.location.href);
  if (profile === 'sandbox') url.searchParams.delete('profile');
  else url.searchParams.set('profile', profile);
  setStatus('Switching deterministic concept profile…', '正在切换确定性概念样板…');
  window.location.assign(url);
});

window.addEventListener('afflatus-lang', () => {
  updateDocumentTitle();
  updateDay(scene?.available ? scene.getDay() : currentDay, { forceMetrics: dataPanelOpen });
  updatePlayButton(Boolean(scene?.isPlaying?.()));
  updateTourButton(Boolean(scene?.isTourActive?.()));
  updateViewButton(scene?.getHeroViewState?.() ?? null);
  updateProfileUi(plan?.profile.key ?? profileFromLocation());
  renderLayerEditor();
  if (status?.dataset.en && status?.dataset.zh) {
    status.textContent = translated(status.dataset.en, status.dataset.zh);
  }
});

function onDocumentKeydown(event) {
  if (event.key !== 'Escape') return;
  if (dataPanelOpen) {
    event.preventDefault();
    setDataPanelOpen(false);
    dataButton?.focus();
    return;
  }
  if (layerPanelOpen) {
    event.preventDefault();
    setLayerPanelOpen(false);
    layerButton?.focus();
    return;
  }
  if (!scene?.isTourActive?.()) return;
  event.preventDefault();
  scene.cancelTour();
  tourButton?.focus();
}

document.addEventListener('keydown', onDocumentKeydown);

window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  document.removeEventListener('keydown', onDocumentKeydown);
  deviceAuditController?.destroy?.();
  scene?.destroy();
});

updatePlayButton(false);
updateTourButton(false);
updateViewButton(null);
setPageControllerReady(false);
setRendererAvailable(false);
updateDocumentTitle();

if (window.__AFFLATUS_E2E__ || new URLSearchParams(window.location.search).has('debug')) {
  Object.defineProperty(window, '__AFFLATUS_CITYVIEW__', {
    configurable: true,
    value: Object.freeze({
      getTelemetry: () => scene?.getTelemetry?.() ?? null,
      getPlanSummary: () => plan ? Object.freeze({
        seed: plan.seed,
        profile: plan.profile.key,
        truthClass: plan.profile.truthClass,
        blocks: plan.blocks.length,
        roads: plan.roads.length,
        buildings: plan.buildings.length,
        waterChannels: plan.water.length,
        heroLandmarks: plan.heroLandmarks.length,
      }) : null,
      getDataPanelState: () => Object.freeze({
        open: dataPanelOpen,
        renderCount: metricRenderCount,
        chartRenderCount: metricChartRenderCount,
        snapshotDay: latestMetricSnapshot?.day ?? null,
        chartDay: latestMetricChartSnapshot?.day ?? null,
        truthClass: latestMetricSnapshot?.truthClass ?? null,
        chartTruthClass: latestMetricChartSnapshot?.truthClass ?? null,
        chartSnapshot: latestMetricChartSnapshot,
      }),
      getLayerEditorState: () => Object.freeze({
        open: layerPanelOpen,
        visibleCount: countVisibleCityAssetCategories(assetVisibility),
        visibility: assetVisibility,
        inventory: assetInventory,
      }),
    }),
  });
}

if (deviceAuditMode) {
  import('./cityDeviceAudit.js').then(({ mountCityDeviceAudit }) => {
    deviceAuditController = mountCityDeviceAudit({
      getTelemetry: () => scene?.getTelemetry?.() ?? null,
      getPlanSummary: () => plan ? Object.freeze({
        seed: plan.seed,
        profile: plan.profile.key,
      }) : null,
      targetDurationMs: window.__AFFLATUS_E2E__ ? 250 : undefined,
    });
  }).catch((error) => {
    console.warn('[cityview] physical-device audit could not start', error);
    const panel = document.querySelector('[data-city-device-audit]');
    const auditStatus = document.querySelector('[data-city-device-status]');
    if (panel) panel.hidden = false;
    if (auditStatus) {
      auditStatus.dataset.en = 'Device audit could not start. Reload before collecting evidence.';
      auditStatus.dataset.zh = '真机审核未能启动。请重新加载后再采集证据。';
      auditStatus.textContent = translated(auditStatus.dataset.en, auditStatus.dataset.zh);
    }
  });
}

setDataPanelOpen(false, { announce: false });
setLayerPanelOpen(false, { announce: false });
let initialCityPromise = null;
let initialCityTimer = 0;
const mountInitialCity = () => {
  if (!initialCityPromise) {
    if (initialCityTimer) window.clearTimeout(initialCityTimer);
    if (loadButton) loadButton.hidden = true;
    initialCityPromise = mountCity(seedFromLocation(), 0, profileFromLocation());
  }
  return initialCityPromise;
};
loadButton?.addEventListener('click', () => { void mountInitialCity(); });

// The poster and page copy are complete without WebGL. Constrained devices
// upgrade only from the explicit control; desktop starts after first paint.
const constrainedDevice = window.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches
  || (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory < 4)
  || (Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency < 4);
if (constrainedDevice) {
  if (loadButton) loadButton.hidden = false;
  stage?.setAttribute('aria-busy', 'false');
  setStatus(
    'Static city ready. Choose Load 3D to start the optional scene.',
    '静态城市已就绪。选择「加载 3D」即可启动可选场景。',
  );
} else {
  stage?.setAttribute('aria-busy', 'true');
  setStatus('Preparing deterministic city geometry…', '正在准备确定性城市几何…');
  initialCityTimer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(mountInitialCity, { timeout: 900 });
    } else {
      void mountInitialCity();
    }
  }, 240);
}
