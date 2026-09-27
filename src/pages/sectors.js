import { mountTaskStory } from '../sectors/frontier/task-story.js';
import { renderAtlas } from '../sectors/atlas.js';
import { fetchJson } from '../lib/fetchJson.js';
import { mountFrontier } from '../sectors/frontier/frontier-view.mjs';
import { renderRelationshipReader } from '../sectors/relationshipReader.js';
import '../lib/readingNavigation.ts';
import './sectorsLibs.js';
import { currentLanguage } from '../sectors/content.js';
import { createSectorsDataController } from '../sectors/dataController.js';
import { initSectorsPageChrome } from '../sectors/pageChromeController.js';
import { initSectorsRivalryController } from '../sectors/rivalryController.js';
import { initSectorsStoryController } from '../sectors/storyController.js';
import { mountStage } from '../sectors/stage/stage.js';
import { mountEditorialBoard } from '../sectors/editorialBoard.js';
import { mountSourceWall } from '../sectors/sourceWall.js';
import { mountCompanyGlobe } from '../sectors/industry/globe-view.js';
import { mountIndustryGraph } from '../sectors/industry/graph-view.js';
import { mountHeadToHead } from '../sectors/industry/head-to-head-view.js';
import { mountUsChina } from '../sectors/industry/rivalry-view.js';
import { mountIpo } from '../sectors/industry/ipo-view.js';
import { mountIndustrySources } from '../sectors/industry/sources-view.js';

let sectorsData = null;
let destroyed = false;
let frontier = null;
let editorialBoard = null;
let sourceWall = null;
let destroyStage = () => {};
let destroyGlobe = () => {};
let globeData = null;
let destroyGraph = () => {};
let destroyLeaders = () => {};
let destroyUsChina = () => {};
let destroyIpo = () => {};
let destroySources = () => {};
let chapterData = null;
const frontierAbort = new AbortController();

const byId = (id) => document.getElementById(id);
// Each module mounts on its own: one failing view must not leave the others empty.
const mountSafely = (name, mount) => {
  try { return mount() ?? (() => {}); } catch (error) { console.error(`sectors: ${name} failed to render`, error); return () => {}; }
};

// The dot stage needs both the frontier snapshot and the industry dataset; until then its
// cards render as static text (no data-mode), and on failure they simply stay that way.
// The company globe reuses the same industry fetch, plus the logo manifest.
if (byId('sectorsStage') || byId('usLeaders') || byId('usChina') || byId('industryGlobe') || byId('industryGraph') || byId('capital') || byId('industrySources')) {
  // Logos are optional: without the manifest the globe and graph fall back to monograms.
  const manifestRequest = byId('industryGlobe') || byId('industryGraph') || byId('industrySources')
    ? fetch('/assets/sectors/logos/manifest.json', { signal: frontierAbort.signal }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    : {};
  Promise.all([
    fetchJson('sectors-frontier-2026-09-27', { signal: frontierAbort.signal }),
    fetchJson('sectors-industry-2026-09-27', { signal: frontierAbort.signal }),
    manifestRequest,
  ])
    .then(([snapshot, industry, manifest]) => {
      if (destroyed) return;
      if (byId('sectorsStage')) destroyStage = mountSafely('stage', () => mountStage(byId('sectorsStage'), { snapshot, industry }));
      chapterData = { snapshot, industry };
      globeData = { industry, manifest };
      mountChapters();
    })
    .catch((error) => { if (error?.name !== 'AbortError') console.error('sectors: chapter data unavailable', error); });
}

// Chapters 02–06 and the source ledger render their copy at mount, so a language switch remounts them.
function mountChapters() {
  const lang = currentLanguage();
  destroyLeaders = mountSafely('chapter 02', () => mountHeadToHead(byId('usLeaders'), { ...chapterData, lang }));
  destroyUsChina = mountSafely('chapter 03', () => mountUsChina(byId('usChina'), { ...chapterData, lang }));
  destroyIpo = mountSafely('chapter 06', () => mountIpo(byId('capital'), { industry: chapterData.industry, lang }));
  if (byId('industryGlobe')) destroyGlobe = mountSafely('chapter 04', () => mountCompanyGlobe(byId('industryGlobe'), { ...globeData, lang }));
  destroyGraph = mountSafely('chapter 05', () => mountIndustryGraph(byId('industryGraph'), { ...globeData, lang }));
  destroySources = mountSafely('source ledger', () => mountIndustrySources(byId('industrySources'), { ...globeData, lang }));
}
const destroyChapters = () => { destroyLeaders(); destroyUsChina(); destroyIpo(); destroyGlobe(); destroyGraph(); destroySources(); };

if (byId('sectorsFrontier')) {
  fetchJson('sectors-frontier-2026-09-27', { signal: frontierAbort.signal })
    .then((snapshot) => {
      if (destroyed) return;
      editorialBoard = mountEditorialBoard(byId('frontierEditorial'), snapshot, currentLanguage());
      sourceWall = mountSourceWall(byId('sourceWall'), snapshot, currentLanguage());
      frontier = mountFrontier(byId('sectorsFrontier'), snapshot, {
        language: currentLanguage(),
        ownLanguageToggle: false,
      });
    })
    .catch(() => {
      // The generated, bilingual source table remains readable on failure.
    });
}

const taskStory = byId('frontierTaskStory') ? mountTaskStory(byId('frontierTaskStory')) : null;

const dataController = createSectorsDataController();
const destroyChrome = initSectorsPageChrome();
const destroyStory = initSectorsStoryController();
const rivalry = initSectorsRivalryController({
  k3: byId('rivalryK3'),
  cost: byId('rivalryCost'),
  labs: byId('rivalryLabs'),
  event: byId('rivalryEvent'),
  transmission: byId('rivalryTransmission'),
  equities: byId('rivalryEquities'),
  letter: byId('rivalryLetter'),
  theses: byId('rivalryTheses'),
  sources: byId('rivalrySources'),
});

function renderFailure() {
  taskStory?.setData(null);
  renderRelationshipReader(null);
  renderAtlas(null);

}

dataController.load()
  .then((data) => {
    if (destroyed) return;
    sectorsData = data;
    taskStory?.setData(data);
    renderRelationshipReader(data);
    const asOf = byId('mwAsOf');
    if (asOf) {
      asOf.textContent = currentLanguage() === 'zh'
        ? `关系数据快照 · ${data.ecosystemGraph?.updated || data.as_of || data.updated || ''}`
        : `Relationship data snapshot · ${data.ecosystemGraph?.updated || data.as_of || data.updated || ''}`;
    }
    renderAtlas(data);
  })
  .catch((error) => {
    if (error?.name !== 'AbortError') renderFailure();
  });

const onLanguage = () => {
  frontier?.setLanguage(currentLanguage());
  editorialBoard?.setLanguage(currentLanguage());
  sourceWall?.setLanguage(currentLanguage());
  taskStory?.setLanguage();
  if (chapterData) { destroyChapters(); mountChapters(); }
  if (!sectorsData) return;
  renderRelationshipReader(sectorsData);
  const asOf = byId('mwAsOf');
  if (asOf) {
    asOf.textContent = currentLanguage() === 'zh'
      ? `关系数据快照 · ${sectorsData.ecosystemGraph?.updated || sectorsData.as_of || sectorsData.updated || ''}`
      : `Relationship data snapshot · ${sectorsData.ecosystemGraph?.updated || sectorsData.as_of || sectorsData.updated || ''}`;
  }
  renderAtlas(sectorsData);
};
addEventListener('afflatus-lang', onLanguage);

addEventListener('pagehide', (event) => {
  // A persisted pagehide means the browser is keeping this document in the
  // back-forward cache. RenderBudgetCoordinator pauses its surfaces there;
  // keep the controllers reusable so returning to Sectors restores the page.
  if (event.persisted) return;
  destroyed = true;
  frontierAbort.abort();
  frontier?.destroy();
  editorialBoard?.destroy();
  sourceWall?.destroy();
  taskStory?.destroy();

  dataController.destroy();

  rivalry.destroy();
  destroyStory();
  destroyStage();
  destroyChapters();
  destroyChrome();
  removeEventListener('afflatus-lang', onLanguage);
});
