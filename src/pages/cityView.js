import { generateSandboxCity } from '../city/generate.ts';
import {
  CITY_ASSET_CATEGORIES,
  countVisibleCityAssetCategories,
  createCityAssetVisibility,
  setCityAssetCategoryVisibility,
} from '../city/assetVisibility.ts';
import {
  CITY_CONCEPT_GENERATION_PROFILES,
  normalizePublicCityConceptProfileKey,
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
const seedLabel = seedOutput?.previousElementSibling;
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
const introEyebrow = document.querySelector('.city-intro .city-eyebrow');
const introTitle = document.querySelector('.city-intro h1');
const introBody = document.querySelector('.city-intro > p:last-child');
const status = document.querySelector('[data-city-status]');
const stage = document.querySelector('[data-city-stage]');
const languageButton = document.querySelector('.city-lang');
const locationParams = new URLSearchParams(window.location.search);
const localAnalysisPreviewMode = import.meta.env.DEV && (
  ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(window.location.hostname.toLowerCase())
  && locationParams.get('analysis-preview') === 'melbourne'
);
const localAnalysisFailureMode = localAnalysisPreviewMode
  ? locationParams.get('analysis-failure') || 'none'
  : 'none';
const localAnalysisInitialEnvironment = localAnalysisPreviewMode
  ? locationParams.get('analysis-environment') || 'analysis'
  : 'analysis';
const localAnalysisEnvironmentFailureMode = localAnalysisPreviewMode
  ? locationParams.get('analysis-environment-failure') || 'none'
  : 'none';
const deviceAuditMode = !localAnalysisPreviewMode && locationParams.get('device-audit') === '1';
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
let legacyProfileMigrationNoticePending = false;
let analysisAbortController = null;
let analysisRuntime = null;
let analysisEnvironmentController = null;
let analysisEnvironmentSelect = null;
let analysisEnvironmentLabel = null;
let analysisEnvironmentState = null;
let analysisSelectionContainer = null;
let analysisSelectionLabel = null;
let analysisSelectionValue = null;
let analysisSelectedFeature = null;

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
  if (localAnalysisPreviewMode) {
    document.title = translated(
      'Melbourne Analysis Candidate · Local Engineering · Afflatus',
      '墨尔本 Analysis 候选 · 本地工程审核 · Afflatus',
    );
    return;
  }
  document.title = translated(
    'Cityview — Three-City Construction Observatory · Afflatus',
    '城市推演台 — 三城建造观测台 · Afflatus',
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
  if (localAnalysisPreviewMode) return;
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
  if (localAnalysisPreviewMode) {
    for (const control of rendererOnlyControls) control.disabled = true;
    if (resetButton) resetButton.disabled = !available;
    if (analysisEnvironmentSelect) analysisEnvironmentSelect.disabled = !available;
    return;
  }
  for (const control of rendererOnlyControls) control.disabled = !available;
  if (!available) {
    updatePlayButton(false);
    updateTourButton(false);
    updateViewButton(null);
  }
}

function setPageControllerReady(isReady) {
  for (const control of pageControllerControls) {
    control.disabled = !isReady || (localAnalysisPreviewMode && control !== languageButton);
  }
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

function profileFromLocation({ migrateLegacySandbox = false } = {}) {
  const params = new URLSearchParams(window.location.search);
  const requestedProfile = params.get('profile');
  if (migrateLegacySandbox && requestedProfile?.toLowerCase() === 'sandbox') {
    const url = new URL(window.location.href);
    url.searchParams.set('profile', 'shanghai');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
    legacyProfileMigrationNoticePending = true;
  }
  return normalizePublicCityConceptProfileKey(requestedProfile);
}

function updateProfileUi(profileKey) {
  const profile = CITY_CONCEPT_GENERATION_PROFILES[normalizePublicCityConceptProfileKey(profileKey)];
  if (profileSelect) profileSelect.value = profile.key;
  stage?.setAttribute('data-city-profile-key', profile.key);
  if (localAnalysisPreviewMode) {
    stage?.setAttribute('data-city-truth-class', 'licensed-real-data-candidate');
    if (profileNote) {
      const en = 'Melbourne · verified local candidate—not published';
      const zh = '墨尔本 · 已验证本地候选，尚未发布';
      profileNote.dataset.en = en;
      profileNote.dataset.zh = zh;
      profileNote.textContent = translated(en, zh);
    }
    if (summaryModel) {
      const en = 'This local engineering view uses the licensed Melbourne candidate package derived from City of Melbourne building footprints, Vicmap transport, Vicmap DEM 10m and Survey Control Marks. It is checksum-verified, non-public and not registered for production use.';
      const zh = '此本地工程视图使用由墨尔本市建筑轮廓、Vicmap 交通、Vicmap DEM 10m 与 Survey Control Marks 派生的许可候选数据包。它经过校验和验证、并非公开内容，也未注册用于生产环境。';
      summaryModel.dataset.en = en;
      summaryModel.dataset.zh = zh;
      summaryModel.textContent = translated(en, zh);
    }
    return;
  }
  if (profileNote) {
    const en = `${profile.labels.en} · generated concept—not GIS`;
    const zh = `${profile.labels.zh} · 程序化概念，并非 GIS`;
    profileNote.dataset.en = en;
    profileNote.dataset.zh = zh;
    profileNote.textContent = translated(en, zh);
  }
  if (summaryModel) {
    const summaries = {
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

function analysisEnvironmentName(environment) {
  const names = {
    analysis: { en: 'Analysis', zh: 'Analysis 分析' },
    day: { en: 'Day', zh: '日间' },
    sunset: { en: 'Sunset', zh: '日落' },
    night: { en: 'Night', zh: '夜间' },
  };
  return names[environment] ?? names.analysis;
}

function translateAnalysisEnvironmentControl() {
  if (analysisEnvironmentLabel) {
    analysisEnvironmentLabel.textContent = translated(
      analysisEnvironmentLabel.dataset.en,
      analysisEnvironmentLabel.dataset.zh,
    );
  }
  if (!analysisEnvironmentSelect) return;
  analysisEnvironmentSelect.setAttribute(
    'aria-label',
    translated('Melbourne environment', '墨尔本环境'),
  );
  for (const option of analysisEnvironmentSelect.options) {
    option.textContent = translated(option.dataset.en, option.dataset.zh);
  }
}

function renderAnalysisSelection(feature = analysisSelectedFeature) {
  analysisSelectedFeature = feature ?? null;
  if (!analysisSelectionContainer || !analysisSelectionLabel || !analysisSelectionValue) return;
  if (!analysisSelectedFeature) {
    analysisSelectionContainer.hidden = true;
    analysisSelectionContainer.parentElement?.classList.remove('has-city-analysis-selection');
    delete analysisSelectionContainer.dataset.cityAnalysisEntityId;
    delete analysisSelectionContainer.dataset.cityAnalysisLayerId;
    analysisSelectionValue.textContent = '';
    return;
  }
  const selected = analysisSelectedFeature;
  const provider = selected.provider || 'Provider unavailable';
  const attribution = selected.attribution || 'Attribution unavailable.';
  const position = selected.position
    ? `${selected.position.x.toFixed(1)}, ${selected.position.y.toFixed(1)}, ${selected.position.z.toFixed(1)}`
    : 'unavailable';
  const identity = `${selected.layerId} · ${selected.entityId} · ${selected.tileId}/LOD${selected.lod}`;
  const en = `${identity} · ${provider}. ${attribution} Local ENU/AHD: ${position}.`;
  const zh = `${identity} · 来源：${provider}。${attribution} 本地 ENU/AHD：${position}。`;
  analysisSelectionContainer.dataset.cityAnalysisEntityId = selected.entityId;
  analysisSelectionContainer.dataset.cityAnalysisLayerId = selected.layerId;
  analysisSelectionLabel.textContent = translated(
    analysisSelectionLabel.dataset.en,
    analysisSelectionLabel.dataset.zh,
  );
  analysisSelectionValue.dataset.en = en;
  analysisSelectionValue.dataset.zh = zh;
  analysisSelectionValue.textContent = translated(en, zh);
  analysisSelectionContainer.hidden = false;
  analysisSelectionContainer.parentElement?.classList.add('has-city-analysis-selection');
}

function applyAnalysisEnvironmentState(nextState, { announce = true } = {}) {
  if (!nextState?.snapshot) return;
  analysisEnvironmentState = nextState;
  const snapshot = nextState.snapshot;
  stage?.setAttribute('data-city-environment', snapshot.environment);
  stage?.setAttribute('data-city-environment-request', String(nextState.requestedEnvironment));
  stage?.setAttribute('data-city-environment-status', nextState.status);
  if (
    analysisEnvironmentSelect
    && [...analysisEnvironmentSelect.options].some(({ value }) => value === nextState.requestedEnvironment)
  ) analysisEnvironmentSelect.value = nextState.requestedEnvironment;
  if (!announce) return;
  if (nextState.status === 'fallback') {
    setStatus(
      `Environment failed closed to Analysis (${nextState.reason}). Geometry, camera and verified source truth are unchanged.`,
      `环境已安全回退到 Analysis（${nextState.reason}）。几何、镜头与已验证来源事实均未改变。`,
    );
    return;
  }
  const name = analysisEnvironmentName(snapshot.environment);
  const time = snapshot.localDateTime.replace('T', ' ');
  const lighting = snapshot.simulatedLighting
    ? ' Building glow is a simulated visual layer.'
    : '';
  const lightingZh = snapshot.simulatedLighting
    ? ' 建筑发光为模拟视觉层。'
    : '';
  setStatus(
    `${name.en} environment applied at Melbourne ${time}; geometry, LOD and selection are unchanged.${lighting}`,
    `已应用墨尔本 ${time} 的${name.zh}环境；几何、LOD 与选择均未改变。${lightingZh}`,
  );
}

async function setLocalAnalysisEnvironment(request) {
  if (!localAnalysisPreviewMode || !analysisEnvironmentController || !scene?.available) return null;
  if (analysisEnvironmentSelect) analysisEnvironmentSelect.disabled = true;
  try {
    const nextState = await analysisEnvironmentController.setEnvironment(request);
    if (analysisEnvironmentState !== nextState) applyAnalysisEnvironmentState(nextState);
    return nextState;
  } finally {
    if (analysisEnvironmentSelect) analysisEnvironmentSelect.disabled = !scene?.available;
  }
}

function setReadyStatus() {
  if (localAnalysisPreviewMode) {
    if (analysisEnvironmentState?.status === 'fallback') {
      applyAnalysisEnvironmentState(analysisEnvironmentState);
      return;
    }
    const snapshot = analysisEnvironmentState?.snapshot;
    const name = analysisEnvironmentName(snapshot?.environment);
    const lighting = snapshot?.simulatedLighting
      ? ' Simulated building glow is active.'
      : '';
    const lightingZh = snapshot?.simulatedLighting
      ? ' 已启用模拟建筑发光。'
      : '';
    setStatus(
      `Verified local Melbourne ${name.en} tiles ready. Candidate only—not published.${lighting}`,
      `已验证的本地墨尔本${name.zh}切片已就绪。仅为候选，尚未发布。${lightingZh}`,
    );
    return;
  }
  if (legacyProfileMigrationNoticePending) {
    legacyProfileMigrationNoticePending = false;
    setStatus(
      'The retired Sandbox link now opens the Shanghai concept. Your seed was preserved.',
      '已停用的沙盒链接现已迁移到上海概念样板，并保留原有种子。',
    );
    return;
  }
  const profile = plan?.profile;
  const en = `${profile?.labels.en ?? 'City concept'} ready. Drag the timeline or orbit the city.`;
  const zh = `${profile?.labels.zh ?? '城市概念'}已就绪。可拖动时间轴或环绕城市。`;
  setStatus(en, zh);
}

function configureLocalAnalysisShell() {
  if (!localAnalysisPreviewMode) return;
  const environmentOptions = [
    { value: 'analysis', en: 'Analysis · neutral', zh: 'Analysis · 中性分析' },
    { value: 'day', en: 'Day · fixed Melbourne', zh: '日间 · 固定墨尔本时刻' },
    { value: 'sunset', en: 'Sunset · fixed Melbourne', zh: '日落 · 固定墨尔本时刻' },
    { value: 'night', en: 'Night · simulated lights', zh: '夜间 · 模拟灯光' },
    { value: 'auto-local', en: 'Auto · Melbourne local', zh: '自动 · 墨尔本当地时间' },
  ];
  stage?.setAttribute('data-city-analysis-preview', 'melbourne');
  const introCopy = [
    [introEyebrow, 'Local engineering review', '本地工程审核'],
    [introTitle, 'Verified Melbourne Analysis candidate.', '已验证的墨尔本 Analysis 候选。'],
    [
      introBody,
      'Non-public, checksum-verified CityPackage evidence. It remains outside the production registry and falls back to this source summary if any asset cannot be verified.',
      '非公开、经过校验和验证的 CityPackage 证据。它仍未进入生产注册表；任何资产无法验证时，页面都会回退到此来源摘要。',
    ],
  ];
  for (const [node, en, zh] of introCopy) {
    if (!node) continue;
    node.dataset.en = en;
    node.dataset.zh = zh;
    node.textContent = translated(en, zh);
  }
  if (seedLabel) {
    seedLabel.dataset.en = 'Manifest';
    seedLabel.dataset.zh = '清单';
    seedLabel.textContent = translated('Manifest', '清单');
  }
  const controlsToHide = [
    timeline?.closest('.city-timeline'),
    profileSelect?.closest('.city-profile-picker'),
    playButton,
    tourButton,
    viewButton,
    dataButton,
    layerButton,
    rebuildButton,
  ];
  for (const node of controlsToHide) {
    if (node) node.hidden = true;
  }
  const actions = resetButton?.parentElement;
  if (actions && !analysisEnvironmentSelect) {
    const picker = document.createElement('label');
    picker.className = 'city-profile-picker city-environment-picker';
    analysisEnvironmentLabel = document.createElement('span');
    analysisEnvironmentLabel.dataset.en = 'Environment';
    analysisEnvironmentLabel.dataset.zh = '环境';
    const select = document.createElement('select');
    select.dataset.cityEnvironment = '';
    select.disabled = true;
    select.setAttribute('aria-label', translated('Melbourne environment', '墨尔本环境'));
    for (const definition of environmentOptions) {
      const option = document.createElement('option');
      option.value = definition.value;
      option.dataset.en = definition.en;
      option.dataset.zh = definition.zh;
      select.append(option);
    }
    const requested = environmentOptions.some(({ value }) => (
      value === localAnalysisInitialEnvironment
    )) ? localAnalysisInitialEnvironment : 'analysis';
    select.value = requested;
    select.addEventListener('change', () => {
      void setLocalAnalysisEnvironment(select.value);
    });
    picker.append(analysisEnvironmentLabel, select);
    actions.insertBefore(picker, resetButton);
    analysisEnvironmentSelect = select;
    translateAnalysisEnvironmentControl();
  }
  const runMeta = status?.parentElement;
  if (runMeta && !analysisSelectionContainer) {
    const selection = document.createElement('div');
    selection.className = 'city-analysis-selection';
    selection.dataset.cityAnalysisSelection = '';
    selection.setAttribute('role', 'status');
    selection.setAttribute('aria-live', 'polite');
    selection.hidden = true;
    analysisSelectionLabel = document.createElement('strong');
    analysisSelectionLabel.dataset.en = 'Selected source entity';
    analysisSelectionLabel.dataset.zh = '已选来源实体';
    analysisSelectionValue = document.createElement('span');
    selection.append(analysisSelectionLabel, analysisSelectionValue);
    runMeta.append(selection);
    analysisSelectionContainer = selection;
    renderAnalysisSelection();
  }
  const interactionSummary = summaryModel?.nextElementSibling;
  if (interactionSummary?.tagName === 'UL') interactionSummary.hidden = true;
  dataPanelOpen = false;
  layerPanelOpen = false;
  if (dataPanel) dataPanel.hidden = true;
  if (layerPanel) layerPanel.hidden = true;
}

async function mountLocalAnalysisPreview() {
  analysisAbortController?.abort();
  analysisAbortController = new AbortController();
  analysisEnvironmentController = null;
  const analysisModule = await import('./cityAnalysisShellPreview.js');
  const mounted = await analysisModule.createCityAnalysisShellPreview({
    canvas,
    signal: analysisAbortController.signal,
    failureMode: localAnalysisFailureMode,
    initialEnvironment: localAnalysisInitialEnvironment,
    environmentFailureMode: localAnalysisEnvironmentFailureMode,
    onEnvironmentChange: (nextState) => {
      applyAnalysisEnvironmentState(nextState, { announce: Boolean(scene) });
    },
    onStreamingChange: (streaming) => {
      if (streaming.status === 'loading') {
        setStatus(
          `Loading verified ${streaming.selection.primaryTileId} LOD${streaming.selection.lod}…`,
          `正在加载已验证的 ${streaming.selection.primaryTileId} LOD${streaming.selection.lod}…`,
        );
      } else if (streaming.status === 'ready') {
        setReadyStatus();
      } else if (streaming.status === 'fallback') {
        setStatus(
          `Streaming failed closed; retaining the last verified tile set (${streaming.reason}).`,
          `空间加载已安全回退，并保留上一组已验证切片（${streaming.reason}）。`,
        );
      }
    },
    onPick: (feature) => {
      renderAnalysisSelection(feature);
      if (!feature) {
        setReadyStatus();
        return;
      }
      setStatus(
        `Selected ${feature.layerId} · ${feature.entityId}. ${feature.attribution ?? 'Attribution unavailable.'}`,
        `已选择 ${feature.layerId} · ${feature.entityId}。${feature.attribution ?? '暂无署名信息。'}`,
      );
    },
    onFallback: () => {
      stage?.classList.add('is-poster');
      if (canvas) canvas.dataset.renderer = 'poster';
      setRendererAvailable(false);
      setStatus(
        'WebGL failed closed; verified candidate facts remain available in the page.',
        'WebGL 已安全回退；页面中仍保留已验证的候选数据事实。',
      );
    },
  });
  analysisRuntime = mounted.runtime;
  analysisEnvironmentController = mounted;
  scene?.destroy();
  scene = mounted.scene;
  applyAnalysisEnvironmentState(mounted.environment, { announce: false });
  if (seedOutput) seedOutput.textContent = mounted.runtime.manifestSha256.slice(0, 12);
  stage?.classList.remove('is-poster');
  if (canvas) canvas.dataset.renderer = 'webgl';
  setRendererAvailable(true);
  setReadyStatus();
}

async function mountCity(seed, day = 0, profileKey = profileFromLocation()) {
  if (localAnalysisPreviewMode) {
    setStatus(
      'Verifying frozen candidate manifest and first-frame assets…',
      '正在验证冻结候选清单与首屏资产…',
    );
  } else {
    setStatus('Preparing deterministic city geometry…', '正在准备确定性城市几何…');
  }
  stage?.setAttribute('aria-busy', 'true');
  setRendererAvailable(false);
  // Let the loading state and static poster paint before the optional WebGL
  // scene performs its synchronous setup work.
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  plan = generateSandboxCity(seed, localAnalysisPreviewMode ? 'melbourne' : profileKey);
  assetVisibility = createCityAssetVisibility();
  assetInventory = null;
  renderLayerEditor();
  if (seedOutput) seedOutput.textContent = localAnalysisPreviewMode ? 'verifying…' : seed;
  updateProfileUi(plan.profile.key);
  updateDay(day);
  try {
    if (localAnalysisPreviewMode) {
      await mountLocalAnalysisPreview();
      return;
    }
    sceneModule ??= await import('../scene/cityScene.js');
    assetInventory = sceneModule.createCitySceneAssetInventory(plan);
    renderLayerEditor();
    scene?.destroy();
    scene = sceneModule.createCitySceneRenderer({
      canvas,
      renderPlan: plan,
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
    if (analysisAbortController?.signal.aborted) return;
    console.warn('[cityview] scene initialization failed', error);
    stage?.classList.add('is-poster');
    if (canvas) canvas.dataset.renderer = 'poster';
    setRendererAvailable(false);
    if (localAnalysisPreviewMode) {
      const reason = error?.code ?? 'initialization-failed';
      stage?.setAttribute('data-city-analysis-failure', reason);
      setStatus(
        `Candidate 3D failed closed (${reason}); licensed source facts remain available below.`,
        `候选 3D 已安全回退（${reason}）；下方仍保留许可来源事实。`,
      );
    } else {
      setStatus('The 3D scene could not start; the timeline, data and city summary remain available.', '3D 场景未能启动；时间轴、数据和城市摘要仍可使用。');
    }
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
  if (localAnalysisPreviewMode) {
    setStatus('Camera returned to the verified candidate view.', '镜头已回到已验证的候选视角。');
  } else {
    setStatus('Camera returned to the planning view.', '镜头已回到规划视角。');
  }
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
  const profile = normalizePublicCityConceptProfileKey(profileSelect.value);
  const url = new URL(window.location.href);
  url.searchParams.set('profile', profile);
  setStatus('Switching deterministic concept profile…', '正在切换确定性概念样板…');
  window.location.assign(url);
});

window.addEventListener('afflatus-lang', () => {
  updateDocumentTitle();
  updateDay(
    localAnalysisPreviewMode ? currentDay : (scene?.available ? scene.getDay() : currentDay),
    { forceMetrics: dataPanelOpen },
  );
  updatePlayButton(Boolean(scene?.isPlaying?.()));
  updateTourButton(Boolean(scene?.isTourActive?.()));
  updateViewButton(scene?.getHeroViewState?.() ?? null);
  updateProfileUi(plan?.profile.key ?? profileFromLocation());
  renderLayerEditor();
  translateAnalysisEnvironmentControl();
  renderAnalysisSelection();
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
  analysisAbortController?.abort();
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
      setAnalysisView: (view) => localAnalysisPreviewMode
        ? scene?.setView?.(view) ?? null
        : null,
      resetAnalysisView: () => localAnalysisPreviewMode
        ? scene?.resetCamera?.() ?? null
        : null,
      setAnalysisEnvironment: (environment) => localAnalysisPreviewMode
        ? setLocalAnalysisEnvironment(environment)
        : null,
      getAnalysisEnvironment: () => localAnalysisPreviewMode
        ? analysisEnvironmentState
        : null,
      getAnalysisSelection: () => localAnalysisPreviewMode
        ? analysisSelectedFeature
        : null,
      getPlanSummary: () => plan ? Object.freeze({
        seed: plan.seed,
        profile: plan.profile.key,
        truthClass: localAnalysisPreviewMode
          ? 'licensed-real-data-candidate'
          : plan.profile.truthClass,
        candidatePackageId: analysisRuntime?.manifest.packageId ?? null,
        manifestSha256: analysisRuntime?.manifestSha256 ?? null,
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
configureLocalAnalysisShell();

let initialCityPromise = null;
let initialCityTimer = 0;
const initialProfile = localAnalysisPreviewMode
  ? 'melbourne'
  : profileFromLocation({ migrateLegacySandbox: true });
const mountInitialCity = () => {
  if (!initialCityPromise) {
    if (initialCityTimer) window.clearTimeout(initialCityTimer);
    if (loadButton) loadButton.hidden = true;
    initialCityPromise = mountCity(seedFromLocation(), 0, initialProfile);
  }
  return initialCityPromise;
};
loadButton?.addEventListener('click', () => { void mountInitialCity(); });

// The poster and page copy are complete without WebGL. Constrained devices
// upgrade only from the explicit control; desktop starts after first paint.
const constrainedDevice = !localAnalysisPreviewMode && (
  window.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches
  || (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory < 4)
  || (Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency < 4)
);
if (constrainedDevice) {
  if (loadButton) loadButton.hidden = false;
  stage?.setAttribute('aria-busy', 'false');
  setStatus(
    'Static city ready. Choose Load 3D to start the optional scene.',
    '静态城市已就绪。选择「加载 3D」即可启动可选场景。',
  );
} else {
  stage?.setAttribute('aria-busy', 'true');
  if (localAnalysisPreviewMode) {
    setStatus(
      'Preparing the verified local Melbourne candidate…',
      '正在准备已验证的本地墨尔本候选数据…',
    );
  } else {
    setStatus('Preparing deterministic city geometry…', '正在准备确定性城市几何…');
  }
  initialCityTimer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(mountInitialCity, { timeout: 900 });
    } else {
      void mountInitialCity();
    }
  }, 240);
}
