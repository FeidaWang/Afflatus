import './sectorsLibs.js';
import { currentLanguage, emptyMessage } from '../sectors/content.js';
import { createSectorsDataController } from '../sectors/dataController.js';
import { initSectorsPageChrome } from '../sectors/pageChromeController.js';
import { initSectorsRivalryController } from '../sectors/rivalryController.js';
import { initSectorsStoryController } from '../sectors/storyController.js';

let sectorsData = null;
let destroyed = false;

const byId = (id) => document.getElementById(id);

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
});

let graphObserver = null;
let graph = null;
let graphTask = null;

async function loadGraphController() {
  if (destroyed) return null;
  if (!graphTask) {
    graphTask = Promise.all([
      import('../sectors/detailController.js'),
      import('../sectors/graphController.js'),
    ]).then(([detailModule, graphModule]) => {
      const detail = detailModule.createDetailController({
        getData: () => sectorsData,
        getLanguage: currentLanguage,
        host: byId('mwDetail'),
      });
      const controller = graphModule.createSectorsGraphController({
        canvas: byId('mwGraph'),
        controls: byId('mwGraphNodes'),
        summary: byId('mwGraphSummary'),
        progress: byId('mwStoryProgress'),
        tooltip: byId('mwHover'),
        detail: byId('mwDetail'),
        empty: byId('mwEmpty'),
        story: byId('storyGraphSection'),
      }, {
        getData: () => sectorsData,
        detailController: detail,
      });
      if (destroyed) {
        controller.destroy();
        return null;
      }
      graph = controller;
      return controller;
    });
  }
  return graphTask;
}

async function renderGraph() {
  try {
    const controller = await loadGraphController();
    await controller?.render();
  } catch {
    const canvas = byId('mwGraph');
    const empty = byId('mwEmpty');
    if (canvas) canvas.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.textContent = emptyMessage(currentLanguage());
    }
  }
}

function scheduleGraph() {
  const story = byId('storyGraphSection');
  const requests3D = new URLSearchParams(location.search).get('fx') === 'starfield3d';
  if (requests3D || !story || typeof IntersectionObserver !== 'function') {
    void renderGraph();
    return;
  }
  graphObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    graphObserver.disconnect();
    graphObserver = null;
    void renderGraph();
  }, { rootMargin: '900px 0px' });
  graphObserver.observe(story);
}

function renderFailure() {
  const message = emptyMessage(currentLanguage());
  const graphCanvas = byId('mwGraph');
  const graphEmpty = byId('mwEmpty');
  if (graphCanvas) graphCanvas.hidden = true;
  if (graphEmpty) {
    graphEmpty.hidden = false;
    graphEmpty.textContent = message;
  }
}

dataController.load()
  .then((data) => {
    if (destroyed) return;
    sectorsData = data;
    const asOf = byId('mwAsOf');
    if (asOf) {
      asOf.textContent = currentLanguage() === 'zh'
        ? `关系数据快照 · ${data.as_of || data.updated || ''}`
        : `Relationship data snapshot · ${data.as_of || data.updated || ''}`;
    }
    scheduleGraph();
  })
  .catch((error) => {
    if (error?.name !== 'AbortError') renderFailure();
  });

const onLanguage = () => {
  if (!sectorsData) return;
  const asOf = byId('mwAsOf');
  if (asOf) {
    asOf.textContent = currentLanguage() === 'zh'
      ? `关系数据快照 · ${sectorsData.as_of || sectorsData.updated || ''}`
      : `Relationship data snapshot · ${sectorsData.as_of || sectorsData.updated || ''}`;
  }
  graph?.refreshLanguage();
};
addEventListener('afflatus-lang', onLanguage);

addEventListener('pagehide', (event) => {
  // A persisted pagehide means the browser is keeping this document in the
  // back-forward cache. RenderBudgetCoordinator pauses its surfaces there;
  // keep the controllers reusable so returning to Sectors restores the page.
  if (event.persisted) return;
  destroyed = true;
  graphObserver?.disconnect();
  dataController.destroy();
  graph?.destroy();
  rivalry.destroy();
  destroyStory();
  destroyChrome();
  removeEventListener('afflatus-lang', onLanguage);
});
