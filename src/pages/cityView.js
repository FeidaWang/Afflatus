import { generateSandboxCity } from '../city/generate.ts';
import cityPackageRegistry from '../../data/city/city-package-registry.json';
import {
  CITY_ASSET_CATEGORIES,
  countVisibleCityAssetCategories,
  createCityAssetVisibility,
  setCityAssetCategoryVisibility,
} from '../city/assetVisibility.ts';
import {
  CITY_TRUTH_MODES,
  evaluateCityRealityAvailability,
  mayMountGeneratedSandbox,
  normalizeCityTruthMode,
  resolveCityTruthRequest,
} from '../city/truthMode.ts';
import {
  cityMetricPolylinePoints,
  createCityMetricChartSnapshot,
} from '../city/metricCharts.ts';
import { cityMetricSnapshotAt } from '../city/schedule.ts';

const canvas = document.querySelector('[data-city-canvas]');
const timeline = document.querySelector('[data-city-timeline]');
const dayOutput = document.querySelector('[data-city-day]');
const seedOutput = document.querySelector('[data-city-seed]');
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
const truthModeSelect = document.querySelector('[data-city-truth-mode]');
const productionEnvironmentPicker = document.querySelector('[data-city-environment-picker]');
const productionEnvironmentSelect = document.querySelector('[data-city-production-environment]');
const productionViewPicker = document.querySelector('[data-city-production-view-picker]');
const productionViewSelect = document.querySelector('[data-city-production-view]');
const profileNote = document.querySelector('[data-city-profile-note]');
const summaryModel = document.querySelector('[data-city-summary-model]');
const summaryGuidance = document.querySelector('[data-city-summary-guidance]');
const productionProvenance = document.querySelector('[data-city-production-provenance]');
const productionProvenanceList = document.querySelector('[data-city-production-provenance-list]');
const introEyebrow = document.querySelector('.city-intro .city-eyebrow');
const introTitle = document.querySelector('.city-intro h1');
const introBody = document.querySelector('.city-intro > p:last-child');
const status = document.querySelector('[data-city-status]');
const stage = document.querySelector('[data-city-stage]');
const languageButton = document.querySelector('.city-lang');
const locationParams = new URLSearchParams(window.location.search);
const initialTruthRequest = resolveCityTruthRequest({
  mode: locationParams.get('mode'),
  profile: locationParams.get('profile'),
});
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
const deviceAuditMode = !localAnalysisPreviewMode
  && initialTruthRequest.mode === 'sandbox'
  && locationParams.get('device-audit') === '1';
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
let currentTruthRequest = initialTruthRequest;
let currentRealityAvailability = null;
let activeCitySurface = 'loading';
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
let productionRuntimeState = null;
let analysisEnvironmentController = null;
let analysisEnvironmentSelect = null;
let analysisEnvironmentLabel = null;
let analysisEnvironmentState = null;
let analysisSelectionContainer = null;
let analysisSelectionLabel = null;
let analysisSelectionValue = null;
let analysisSelectedFeature = null;

function productionPackageReference(profile) {
  const fixture = window.__AFFLATUS_E2E__ ? window.__AFFLATUS_CITY_PACKAGE_FIXTURE__ : null;
  if (fixture?.cityId === profile && fixture.packageReference) return fixture.packageReference;
  return cityPackageRegistry.productionPackages[profile];
}

const rendererOnlyControls = Object.freeze([
  playButton,
  tourButton,
  viewButton,
  resetButton,
].filter(Boolean));
const pageControllerControls = Object.freeze([
  timeline,
  profileSelect,
  truthModeSelect,
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
  if (currentTruthRequest.mode === 'sandbox') {
    document.title = translated(
      'Cityview Sandbox — Synthetic Construction · Afflatus',
      '城市推演台沙盒 — 合成建造 · Afflatus',
    );
    return;
  }
  document.title = translated(
    'Cityview — Reality-Gated Urban Observatory · Afflatus',
    '城市推演台 — 真实数据门控城市观测台 · Afflatus',
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
  const ready = Boolean(isReady);
  if (languageButton) languageButton.disabled = !ready;
  if (localAnalysisPreviewMode) {
    for (const control of pageControllerControls) {
      if (control !== languageButton) control.disabled = true;
    }
    return;
  }
  if (truthModeSelect) truthModeSelect.disabled = !ready;
  if (profileSelect) profileSelect.disabled = !ready || currentTruthRequest.mode === 'sandbox';
  if (productionEnvironmentSelect) {
    productionEnvironmentSelect.disabled = !(ready && activeCitySurface === 'production');
  }
  if (productionViewSelect) {
    productionViewSelect.disabled = !(ready && activeCitySurface === 'production');
  }
  const sandboxReady = ready && activeCitySurface === 'sandbox';
  for (const control of [timeline, dataButton, layerButton, rebuildButton]) {
    if (control) control.disabled = !sandboxReady;
  }
}

function configureCitySurface(surface) {
  activeCitySurface = surface;
  stage?.setAttribute('data-city-surface', surface);
  const sandbox = surface === 'sandbox';
  const production = surface === 'production';
  if (timeline?.closest('.city-timeline')) timeline.closest('.city-timeline').hidden = !sandbox;
  if (productionEnvironmentPicker) productionEnvironmentPicker.hidden = !production;
  if (productionViewPicker) productionViewPicker.hidden = !production;
  if (productionProvenance) productionProvenance.hidden = !production;
  for (const control of [playButton, tourButton, dataButton, layerButton, rebuildButton, resetButton]) {
    if (control) control.hidden = !sandbox;
  }
  if (viewButton) viewButton.hidden = !sandbox || !plan?.heroLandmarks?.length;
  if (summaryGuidance) summaryGuidance.hidden = !sandbox;
  if (!sandbox) {
    setDataPanelOpen(false, { announce: false });
    setLayerPanelOpen(false, { announce: false });
  }
}

function translateProductionViewOptions() {
  if (!productionViewSelect) return;
  for (const option of productionViewSelect.options) {
    option.textContent = translated(option.dataset.en, option.dataset.zh);
  }
}

function syncProductionView(view) {
  if (!view) return;
  if (productionViewSelect) productionViewSelect.value = view.id;
  stage?.setAttribute('data-city-canonical-view', view.id);
}

function renderProductionViews(views, selectedView) {
  if (!productionViewSelect) return;
  productionViewSelect.replaceChildren();
  for (const view of views ?? []) {
    const option = document.createElement('option');
    option.value = view.id;
    option.dataset.en = view.labels.en;
    option.dataset.zh = view.labels.zh;
    productionViewSelect.append(option);
  }
  translateProductionViewOptions();
  syncProductionView(selectedView);
}

function renderProductionProvenance(manifest) {
  if (!productionProvenanceList) return;
  productionProvenanceList.replaceChildren();
  for (const source of manifest?.sourceLayers ?? []) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = source.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${source.provider} · ${source.datasetId} · ${source.datasetVersion}`;
    const detail = document.createElement('span');
    detail.textContent = ` — ${source.attribution} ${source.sourceCrs.identifier ?? 'CRS under review'} / ${source.verticalDatum.name ?? 'no vertical datum'}`;
    item.append(link, detail);
    productionProvenanceList.append(item);
  }
}

function updateProductionUi() {
  const manifest = analysisRuntime?.manifest;
  if (activeCitySurface !== 'production' || !manifest) return false;
  setTranslatedCopy(
    profileNote,
    `${manifest.precinct.labels.en} · verified Reality package`,
    `${manifest.precinct.labels.zh} · 已验证现实数据包`,
  );
  setTranslatedCopy(
    summaryModel,
    `A checksummed production CityPackage is active for ${manifest.precinct.labels.en}. Geometry and source identity are fixed by the approved manifest; no Sandbox geometry is present.`,
    `${manifest.precinct.labels.zh}的生产 CityPackage 已启用并通过校验和验证。几何与来源身份由获批清单固定；页面没有沙盒几何。`,
  );
  return true;
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

function truthRequestFromLocation({ migrateLegacySandbox = false } = {}) {
  const params = new URLSearchParams(window.location.search);
  const request = resolveCityTruthRequest({
    mode: params.get('mode'),
    profile: params.get('profile'),
  });
  if (migrateLegacySandbox && request.migratedLegacySandbox) {
    const url = new URL(window.location.href);
    url.searchParams.set('profile', request.profile);
    url.searchParams.set('mode', 'sandbox');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
    legacyProfileMigrationNoticePending = true;
  }
  return request;
}

function setTranslatedCopy(node, en, zh) {
  if (!node) return;
  node.dataset.en = en;
  node.dataset.zh = zh;
  node.textContent = translated(en, zh);
}

function updateProfileUi(request = currentTruthRequest) {
  if (profileSelect) profileSelect.value = request.profile;
  if (truthModeSelect) truthModeSelect.value = request.mode;
  stage?.setAttribute('data-city-truth-mode-value', request.mode);
  if (updateProductionUi()) return;
  if (localAnalysisPreviewMode) {
    stage?.setAttribute('data-city-profile-key', 'melbourne');
    stage?.setAttribute('data-city-truth-class', 'licensed-real-data-candidate');
    setTranslatedCopy(profileNote, 'Melbourne · verified local candidate—not published', '墨尔本 · 已验证本地候选，尚未发布');
    setTranslatedCopy(
      summaryModel,
      'This local engineering view uses the licensed Melbourne candidate package derived from City of Melbourne building footprints, Vicmap transport, Vicmap DEM 10m and Survey Control Marks. It is checksum-verified, non-public and not registered for production use.',
      '此本地工程视图使用由墨尔本市建筑轮廓、Vicmap 交通、Vicmap DEM 10m 与 Survey Control Marks 派生的许可候选数据包。它经过校验和验证、并非公开内容，也未注册用于生产环境。',
    );
    return;
  }

  if (request.mode === 'sandbox') {
    stage?.setAttribute('data-city-profile-key', 'sandbox');
    stage?.setAttribute('data-city-truth-class', 'generated-sandbox');
    stage?.setAttribute('data-city-availability', 'available');
    setTranslatedCopy(seedLabel, 'Seed', '种子');
    setTranslatedCopy(profileNote, 'Sandbox · generated synthetic fixture—not a real city', '沙盒 · 程序化合成基准，并非真实城市');
    setTranslatedCopy(
      summaryModel,
      'Sandbox is a deterministic synthetic 0–210 day construction model. Its roads, blocks, water, buildings and seed are invented test geometry; it is never labelled Shanghai, Melbourne or Hong Kong.',
      '沙盒是一个确定性的合成 0–210 天建造模型。其道路、街区、水体、建筑与种子均为虚构测试几何，绝不会标记为上海、墨尔本或香港。',
    );
    return;
  }

  const availability = currentRealityAvailability
    ?? evaluateCityRealityAvailability(request.profile, productionPackageReference(request.profile));
  const modeLabels = CITY_TRUTH_MODES[request.mode].labels;
  stage?.setAttribute('data-city-profile-key', request.profile);
  stage?.setAttribute('data-city-truth-class', 'real-city-unavailable');
  stage?.setAttribute(
    'data-city-availability',
    availability.available ? 'runtime-pending' : 'unavailable',
  );
  setTranslatedCopy(seedLabel, 'Package', '数据包');
  setTranslatedCopy(
    profileNote,
    `${availability.profile.labels.en} · ${modeLabels.en} package unavailable`,
    `${availability.profile.labels.zh} · ${modeLabels.zh}数据包尚不可用`,
  );
  const summaries = {
    shanghai: {
      en: 'Shanghai Reality requires an approved package with the true Huangpu River, Suzhou Creek mouth, Waibaidu Bridge, all 52 Bund massing assets, landmark-grade Bund façades, Oriental Pearl, Shanghai Tower, Jin Mao and SWFC. No approved production package is registered, so no geometry is fabricated.',
      zh: '上海现实城市必须使用已批准数据包，包含真实黄浦江、苏州河口、外白渡桥、外滩 52 幢连续体量与重点立面，以及东方明珠、上海中心、金茂和环球金融中心。当前没有已批准的生产数据包，因此不会伪造几何。',
    },
    melbourne: {
      en: 'Melbourne Reality requires an approved package joining Hoddle Grid, the Yarra and Princes Bridge to Flinders Street, Federation Square, Arts Centre, Eureka, Australia 108, Rialto and the wider skyline. The verified local engineering slice is not yet approved for production.',
      zh: '墨尔本现实城市必须使用已批准数据包，把霍德尔方格、亚拉河与王子桥，同弗林德斯街车站、联邦广场、艺术中心、Eureka、Australia 108、Rialto 及更广天际线正确连接。已验证的本地工程片区尚未获准用于生产。',
    },
    'hong-kong': {
      en: 'Hong Kong Reality requires an approved package with Victoria Harbour, both shorelines, Victoria Peak terrain, Central and Kowloon skyline assets including Bank of China Tower, HSBC, Two IFC, ICC, Central Plaza, HKCEC and the Tsim Sha Tsui waterfront group. No approved production package is registered.',
      zh: '香港现实城市必须使用已批准数据包，包含维多利亚港两岸、太平山地形，以及中银大厦、汇丰总行、国际金融中心二期、环球贸易广场、中环广场、会展中心和尖沙咀海滨组团。当前没有已批准的生产数据包。',
    },
  };
  const copy = summaries[request.profile];
  setTranslatedCopy(summaryModel, copy.en, copy.zh);
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
      'The legacy profile=sandbox link now opens the explicit synthetic Sandbox. Your seed was preserved.',
      '旧版 profile=sandbox 链接现已迁移到明确标识的合成沙盒，并保留原有种子。',
    );
    return;
  }
  if (activeCitySurface === 'production') {
    const manifest = analysisRuntime?.manifest;
    setStatus(
      `${manifest?.precinct?.labels?.en ?? 'Real city'} Reality tiles are verified and streaming from the approved CityPackage.`,
      `${manifest?.precinct?.labels?.zh ?? '现实城市'}现实切片已通过验证，并正从获批 CityPackage 流送。`,
    );
    return;
  }
  if (activeCitySurface === 'unavailable') {
    const availability = currentRealityAvailability;
    const profile = availability?.profile;
    const mode = CITY_TRUTH_MODES[currentTruthRequest.mode].labels;
    if (availability?.available) {
      setStatus(
        `${profile?.labels.en ?? 'Real city'} ${mode.en} package session is verified. Scene streaming is not enabled until the production renderer gate passes; no generated fallback was loaded.`,
        `${profile?.labels.zh ?? '现实城市'}${mode.zh}数据包会话已通过验证。生产渲染器通过门禁前不会启用场景流送；页面没有加载程序化替代模型。`,
      );
      return;
    }
    setStatus(
      `${profile?.labels.en ?? 'Real city'} ${mode.en} is unavailable: source/licence approval and a production CityPackage are still required. No generated fallback was loaded.`,
      `${profile?.labels.zh ?? '现实城市'}${mode.zh}尚不可用：仍需完成来源与许可审批并注册生产 CityPackage。页面没有加载程序化替代模型。`,
    );
    return;
  }
  const profile = plan?.profile;
  const en = `${profile?.labels.en ?? 'Synthetic Sandbox'} ready. Drag the timeline or orbit the invented test city.`;
  const zh = `${profile?.labels.zh ?? '合成沙盒'}已就绪。可拖动时间轴或环绕这座虚构测试城市。`;
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
    truthModeSelect?.closest('.city-profile-picker'),
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

async function prepareRegisteredProductionPackage() {
  const packageReference = currentRealityAvailability?.packageReference;
  if (!packageReference) return null;
  analysisAbortController?.abort();
  analysisAbortController = new AbortController();
  const { createCityProductionShell } = await import('./cityProductionShell.js');
  const result = await createCityProductionShell({
    canvas,
    cityId: currentTruthRequest.profile,
    packageReference,
    signal: analysisAbortController.signal,
    readBytes: async (url, signal) => {
      const response = await fetch(url, {
        signal,
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`CityPackage request failed (${response.status}).`);
      return response.arrayBuffer();
    },
    onStreamingChange: (streaming) => {
      if (streaming.status === 'loading') {
        setStatus(
          `Streaming verified ${streaming.selection.primaryTileId} LOD${streaming.selection.lod}…`,
          `正在流送已验证的 ${streaming.selection.primaryTileId} LOD${streaming.selection.lod}…`,
        );
      } else if (streaming.status === 'fallback') {
        setStatus(
          `Production streaming failed closed (${streaming.reason}); retaining the last verified tile set.`,
          `生产流送安全回退（${streaming.reason}）；继续保留上一组已验证切片。`,
        );
      }
    },
    onEnvironmentChange: (snapshot) => {
      if (activeCitySurface === 'production') updateProductionEnvironmentStatus(snapshot);
    },
    onEnvironmentRefreshError: ({ reason }) => {
      setStatus(
        `Auto-local refresh failed closed (${reason}); the last verified lighting state remains active.`,
        `自动本地时间刷新安全回退（${reason}）；继续保留上一项已验证光照状态。`,
      );
    },
    onViewChange: syncProductionView,
    onFallback: () => {
      stage?.classList.add('is-poster');
      if (canvas) canvas.dataset.renderer = 'poster';
      setRendererAvailable(false);
    },
  });
  productionRuntimeState = result;
  stage?.setAttribute('data-city-package-session', result.status);
  if (result.status === 'fallback') {
    stage?.setAttribute('data-city-package-failure', result.reason);
  } else {
    stage?.removeAttribute('data-city-package-failure');
  }
  if (result.status === 'ready') {
    analysisRuntime = result.runtime;
    scene = result.scene;
    configureCitySurface('production');
    stage?.setAttribute('data-city-truth-class', 'licensed-real-data');
    stage?.setAttribute('data-city-availability', 'available');
    stage?.classList.remove('is-poster');
    if (canvas) canvas.dataset.renderer = 'webgl';
    if (seedOutput) seedOutput.textContent = result.runtime.manifest.packageId;
    setRendererAvailable(true);
    renderProductionProvenance(result.runtime.manifest);
    renderProductionViews(result.canonicalViews, result.getCanonicalView());
    updateProductionUi();
  }
  return result;
}

function destroyProductionRuntime() {
  const runtime = productionRuntimeState;
  if (!runtime) return;
  productionRuntimeState = null;
  runtime.destroy?.();
  if (scene === runtime.scene) scene = null;
  productionViewSelect?.replaceChildren();
  stage?.removeAttribute('data-city-canonical-view');
}

async function mountCity(seed, day = 0, request = truthRequestFromLocation()) {
  destroyProductionRuntime();
  if (!localAnalysisPreviewMode) {
    analysisAbortController?.abort();
    analysisAbortController = null;
    analysisRuntime = null;
  }
  currentTruthRequest = localAnalysisPreviewMode
    ? resolveCityTruthRequest({ mode: 'reality', profile: 'melbourne' })
    : request;
  currentRealityAvailability = currentTruthRequest.mode === 'sandbox'
    ? null
    : evaluateCityRealityAvailability(
      currentTruthRequest.profile,
      productionPackageReference(currentTruthRequest.profile),
    );
  productionRuntimeState = null;
  stage?.removeAttribute('data-city-package-session');
  stage?.removeAttribute('data-city-package-failure');
  const generatedSandbox = !localAnalysisPreviewMode && mayMountGeneratedSandbox(currentTruthRequest);
  plan = localAnalysisPreviewMode
    ? generateSandboxCity(seed, 'melbourne')
    : generatedSandbox
      ? generateSandboxCity(seed, 'sandbox')
      : null;
  configureCitySurface(localAnalysisPreviewMode ? 'analysis' : generatedSandbox ? 'sandbox' : 'unavailable');
  assetVisibility = createCityAssetVisibility();
  assetInventory = null;
  renderLayerEditor();
  if (seedOutput) {
    seedOutput.textContent = localAnalysisPreviewMode
      ? 'verifying…'
      : generatedSandbox
        ? seed
        : currentRealityAvailability?.packageReference?.packageId ?? 'not loaded';
  }
  updateProfileUi(currentTruthRequest);
  updateDocumentTitle();
  updateDay(day);
  if (localAnalysisPreviewMode) {
    setStatus(
      'Verifying frozen candidate manifest and first-frame assets…',
      '正在验证冻结候选清单与首屏资产…',
    );
  } else if (generatedSandbox) {
    setStatus('Preparing deterministic Sandbox geometry…', '正在准备确定性的沙盒几何…');
  } else {
    setStatus('Checking real-city approval and production package registration…', '正在检查现实城市审批与生产数据包注册状态…');
  }
  stage?.setAttribute('aria-busy', 'true');
  setRendererAvailable(false);

  try {
    if (localAnalysisPreviewMode) {
      await mountLocalAnalysisPreview();
      return;
    }
    if (!generatedSandbox) {
      scene?.destroy();
      scene = null;
      stage?.classList.add('is-poster');
      if (canvas) canvas.dataset.renderer = 'poster';
      if (currentRealityAvailability?.available) {
        const runtime = await prepareRegisteredProductionPackage();
        if (runtime?.status === 'cancelled') return;
        if (runtime?.status === 'fallback') {
          setStatus(
            `Registered CityPackage failed closed (${runtime.reason}); no generated fallback was loaded.`,
            `已注册 CityPackage 安全回退（${runtime.reason}）；页面没有加载程序化替代模型。`,
          );
          return;
        }
      }
      setReadyStatus();
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
    } else if (generatedSandbox) {
      setStatus('The synthetic Sandbox could not start; its timeline, data and truth summary remain available.', '合成沙盒未能启动；其时间轴、数据和真实性摘要仍可使用。');
    } else {
      setStatus(
        'The registered CityPackage runtime failed closed; no generated fallback was loaded.',
        '已注册 CityPackage 运行时安全回退；页面没有加载程序化替代模型。',
      );
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
  if (currentTruthRequest.mode !== 'sandbox') return;
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
  const request = resolveCityTruthRequest({
    mode: currentTruthRequest.mode,
    profile: profileSelect.value,
  });
  const url = new URL(window.location.href);
  url.searchParams.set('profile', request.profile);
  url.searchParams.set('mode', request.mode);
  setStatus('Checking the selected real-city package…', '正在检查所选现实城市数据包…');
  window.location.assign(url);
});

truthModeSelect?.addEventListener('change', () => {
  const mode = normalizeCityTruthMode(truthModeSelect.value);
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('profile', currentTruthRequest.profile);
  setStatus(
    mode === 'sandbox' ? 'Opening the explicit synthetic Sandbox…' : 'Checking the selected real-city truth mode…',
    mode === 'sandbox' ? '正在打开明确标识的合成沙盒…' : '正在检查所选现实城市真实性模式…',
  );
  window.location.assign(url);
});

function updateProductionEnvironmentStatus(snapshot) {
  setStatus(
    `${analysisRuntime?.manifest?.precinct?.labels?.en ?? 'Real city'} environment: ${snapshot.environment} · ${snapshot.localDateTime}. Geometry and feature IDs are unchanged.`,
    `${analysisRuntime?.manifest?.precinct?.labels?.zh ?? '现实城市'}环境：${snapshot.environment} · ${snapshot.localDateTime}。几何与要素 ID 保持不变。`,
  );
}

productionEnvironmentSelect?.addEventListener('change', () => {
  if (activeCitySurface !== 'production') return;
  try {
    const request = productionEnvironmentSelect.value;
    const snapshot = productionRuntimeState?.setEnvironment?.(
      request,
      request === 'auto-local' ? new Date() : undefined,
    );
    if (!snapshot) return;
  } catch (error) {
    setStatus(
      `Environment switch failed closed (${error?.message ?? 'unknown'}); the last verified state remains active.`,
      `环境切换安全回退（${error?.message ?? '未知'}）；继续保留上一项已验证状态。`,
    );
  }
});

productionViewSelect?.addEventListener('change', async () => {
  if (activeCitySurface !== 'production' || productionRuntimeState?.status !== 'ready') return;
  productionViewSelect.disabled = true;
  try {
    const view = await productionRuntimeState.setCanonicalView(productionViewSelect.value);
    if (!view) {
      syncProductionView(productionRuntimeState.getCanonicalView());
      setStatus(
        'Classic-view switch failed closed; the previous verified camera and tile set remain active.',
        '经典机位切换已安全回退；继续保留上一项已验证镜头与切片。',
      );
      return;
    }
    setStatus(
      `Classic view: ${view.labels.en}. Geometry, feature IDs and environment are unchanged.`,
      `经典机位：${view.labels.zh}。几何、要素 ID 与环境保持不变。`,
    );
  } catch (error) {
    syncProductionView(productionRuntimeState.getCanonicalView());
    setStatus(
      `Classic-view switch failed closed (${error?.message ?? 'unknown'}); the previous verified state remains active.`,
      `经典机位切换已安全回退（${error?.message ?? '未知'}）；继续保留上一项已验证状态。`,
    );
  } finally {
    productionViewSelect.disabled = false;
  }
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
  updateProfileUi(currentTruthRequest);
  renderLayerEditor();
  translateAnalysisEnvironmentControl();
  translateProductionViewOptions();
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
  destroyProductionRuntime();
  scene?.destroy();
});

function getPublicPlanSummary() {
  if (!plan) {
    const productionReady = activeCitySurface === 'production' && productionRuntimeState?.status === 'ready';
    const firstFrameTiles = productionReady
      ? productionRuntimeState.firstFrame.tileLoad.tiles
      : [];
    return Object.freeze({
      seed: null,
      profile: currentTruthRequest.profile,
      truthMode: currentTruthRequest.mode,
      truthClass: productionReady ? 'licensed-real-data' : 'real-city-unavailable',
      availability: productionReady
        ? 'available'
        : currentRealityAvailability?.available ? 'runtime-pending' : 'unavailable',
      blockers: currentRealityAvailability?.blockers ?? Object.freeze([]),
      candidatePackageId: currentRealityAvailability?.packageReference?.packageId ?? null,
      manifestSha256: currentRealityAvailability?.packageReference?.manifestSha256 ?? null,
      blocks: 0,
      roads: 0,
      buildings: 0,
      waterChannels: 0,
      heroLandmarks: 0,
      firstFrameTiles: firstFrameTiles.length,
      firstFrameBytes: firstFrameTiles.reduce((total, tile) => total + tile.bytes.byteLength, 0),
      firstFrameDrawCalls: firstFrameTiles.reduce((total, tile) => total + tile.statistics.drawCalls, 0),
      firstFrameTriangles: firstFrameTiles.reduce((total, tile) => total + tile.statistics.triangles, 0),
    });
  }
  return Object.freeze({
    seed: plan.seed,
    profile: localAnalysisPreviewMode ? 'melbourne' : 'sandbox',
    truthMode: localAnalysisPreviewMode ? 'reality' : currentTruthRequest.mode,
    truthClass: localAnalysisPreviewMode
      ? 'licensed-real-data-candidate'
      : 'generated-sandbox',
    availability: 'available',
    blockers: Object.freeze([]),
    candidatePackageId: analysisRuntime?.manifest.packageId ?? null,
    manifestSha256: analysisRuntime?.manifestSha256 ?? null,
    blocks: plan.blocks.length,
    roads: plan.roads.length,
    buildings: plan.buildings.length,
    waterChannels: plan.water.length,
    heroLandmarks: plan.heroLandmarks.length,
  });
}

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
      setProductionEnvironment: (environment, instant = '2026-06-21T04:00:00.000Z') => (
        activeCitySurface === 'production'
          ? productionRuntimeState?.setEnvironment?.(environment, instant) ?? null
          : null
      ),
      setProductionView: (viewId) => (
        activeCitySurface === 'production'
          ? productionRuntimeState?.setCanonicalView?.(viewId) ?? null
          : null
      ),
      getProductionView: () => productionRuntimeState?.getCanonicalView?.() ?? null,
      getProductionAutoLocalState: () => productionRuntimeState?.getAutoLocalState?.() ?? null,
      getAnalysisSelection: () => localAnalysisPreviewMode
        ? analysisSelectedFeature
        : null,
      getPlanSummary: getPublicPlanSummary,
      getTruthState: () => Object.freeze({
        mode: currentTruthRequest.mode,
        profile: currentTruthRequest.profile,
        surface: activeCitySurface,
        available: currentRealityAvailability?.available ?? currentTruthRequest.mode === 'sandbox',
        blockers: currentRealityAvailability?.blockers ?? Object.freeze([]),
        packageSessionStatus: productionRuntimeState?.status ?? null,
        packageFailureReason: productionRuntimeState?.reason ?? null,
      }),
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
      getPlanSummary: getPublicPlanSummary,
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
stage?.setAttribute('aria-busy', 'true');
const initialRequest = localAnalysisPreviewMode
  ? resolveCityTruthRequest({ mode: 'reality', profile: 'melbourne' })
  : truthRequestFromLocation({ migrateLegacySandbox: true });
currentTruthRequest = initialRequest;
if (localAnalysisPreviewMode) {
  setStatus(
    'Preparing the verified local Melbourne candidate…',
    '正在准备已验证的本地墨尔本候选数据…',
  );
} else if (initialRequest.mode === 'sandbox') {
  setStatus('Preparing the explicit synthetic Sandbox…', '正在准备明确标识的合成沙盒…');
} else {
  setStatus('Checking real-city approval and production package registration…', '正在检查现实城市审批与生产数据包注册状态…');
}
const mountInitialCity = () => mountCity(seedFromLocation(), 0, initialRequest);
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(mountInitialCity, { timeout: 600 });
} else {
  window.setTimeout(mountInitialCity, 0);
}
