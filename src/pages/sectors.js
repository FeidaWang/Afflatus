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
import { mountGeographyEditorial } from '../sectors/geographyEditorial.js';
import { mountCompanyGlobe } from '../sectors/industry/globe-view.js';

let sectorsData = null;
let destroyed = false;
let frontier = null;
let editorialBoard = null;
let sourceWall = null;
let geography = null;
let destroyStage = () => {};
let destroyGlobe = () => {};
let globeData = null;
const frontierAbort = new AbortController();

const byId = (id) => document.getElementById(id);

// The dot stage needs both the frontier snapshot and the industry dataset; until then its
// cards render as static text (no data-mode), and on failure they simply stay that way.
// The company globe reuses the same industry fetch, plus the logo manifest.
if (byId('sectorsStage') || byId('industryGlobe')) {
  Promise.all([
    fetchJson('sectors-frontier-2026-09-27', { signal: frontierAbort.signal }),
    fetchJson('sectors-industry-2026-09-27', { signal: frontierAbort.signal }),
    byId('industryGlobe') ? fetch('/assets/sectors/logos/manifest.json').then((r) => r.json()) : null,
  ])
    .then(([snapshot, industry, manifest]) => {
      if (destroyed) return;
      if (byId('sectorsStage')) destroyStage = mountStage(byId('sectorsStage'), { snapshot, industry });
      if (byId('industryGlobe')) {
        globeData = { industry, manifest };
        destroyGlobe = mountCompanyGlobe(byId('industryGlobe'), { ...globeData, lang: currentLanguage() });
      }
    })
    .catch(() => {});
}

if (byId('sectorsFrontier')) {
  fetchJson('sectors-frontier-2026-09-27', { signal: frontierAbort.signal })
    .then((snapshot) => {
      if (destroyed) return;
      editorialBoard = mountEditorialBoard(byId('frontierEditorial'), snapshot, currentLanguage());
      sourceWall = mountSourceWall(byId('sourceWall'), snapshot, currentLanguage());
      geography = mountGeographyEditorial(byId('geographyEditorial'), snapshot, currentLanguage());
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
  geography?.setLanguage(currentLanguage());
  taskStory?.setLanguage();
  if (globeData) {
    // The globe renders its copy at mount, so a language switch remounts it.
    destroyGlobe();
    destroyGlobe = mountCompanyGlobe(byId('industryGlobe'), { ...globeData, lang: currentLanguage() });
  }
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
  geography?.destroy();
  taskStory?.destroy();

  dataController.destroy();

  rivalry.destroy();
  destroyStory();
  destroyStage();
  destroyGlobe();
  destroyChrome();
  removeEventListener('afflatus-lang', onLanguage);
});
