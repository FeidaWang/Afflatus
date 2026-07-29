import './sectorsLibs.js';
import { installBrandAssets } from '../sectors/brandAssets.js';
import { createSectorsCardsController } from '../sectors/cardsController.js';
import { currentLanguage, emptyMessage } from '../sectors/content.js';
import { createSectorsDataController } from '../sectors/dataController.js';
import { initSectorsPageChrome } from '../sectors/pageChromeController.js';
import { initSectorsStoryController } from '../sectors/storyController.js';

let sectorsData = null;
let destroyed = false;

const byId = (id) => document.getElementById(id);
const cards = createSectorsCardsController({
  modelAsOf: byId('mwAsOf'),
  modelGrid: byId('mwGrid'),
  modelBaskets: byId('mwBaskets'),
  modelTake: byId('mwTake'),
  postAsOf: byId('pmAsOf'),
  postTracks: byId('pmTracks'),
  postGrid: byId('pmGrid'),
  postSwap: byId('pmSwap'),
  postTake: byId('pmTake'),
  storyTake: byId('storyTake'),
  newsGrid: byId('newsGrid'),
}, {
  getData: () => sectorsData,
  getLanguage: currentLanguage,
});

const dataController = createSectorsDataController();
const destroyBrandAssets = installBrandAssets();
const destroyChrome = initSectorsPageChrome();
const destroyStory = initSectorsStoryController();

let graphObserver = null;
let graph = null;
let graphTask = null;
let competitionObserver = null;
let destroyCompetition = () => {};

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

async function startCompetition() {
  competitionObserver?.disconnect();
  competitionObserver = null;
  try {
    const { initSectorsCompetitionController } = await import('../sectors/competitionController.js');
    if (destroyed) return;
    destroyCompetition = initSectorsCompetitionController({
      radar: byId('rbRadarHost'),
      table: byId('rbTableHost'),
      boards: byId('rbBoardsHost'),
      scoreboard: byId('rbScoreHost'),
      provenance: byId('rbCompetitionProv'),
    });
  } catch {
    const radar = byId('rbRadarHost');
    if (radar) {
      radar.innerHTML = `<div class="empty">${emptyMessage(currentLanguage())}</div>`;
    }
  }
}

function scheduleCompetition() {
  const host = byId('rbRadarHost');
  const section = host?.closest('section') || host;
  if (!section || typeof IntersectionObserver !== 'function') {
    void startCompetition();
    return;
  }
  competitionObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    void startCompetition();
  }, { rootMargin: '900px 0px' });
  competitionObserver.observe(section);
}

scheduleCompetition();

function renderFailure() {
  const message = emptyMessage(currentLanguage());
  const modelGrid = byId('mwGrid');
  const postGrid = byId('pmGrid');
  const graphCanvas = byId('mwGraph');
  const graphEmpty = byId('mwEmpty');
  if (modelGrid) modelGrid.innerHTML = `<div class="empty">${message}</div>`;
  if (postGrid) postGrid.innerHTML = `<div class="empty">${message}</div>`;
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
    cards.render();
    scheduleGraph();
  })
  .catch((error) => {
    if (error?.name !== 'AbortError') renderFailure();
  });

const onLanguage = () => {
  if (!sectorsData) return;
  cards.render();
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
  competitionObserver?.disconnect();
  dataController.destroy();
  graph?.destroy();
  cards.destroy();
  destroyStory();
  destroyCompetition();
  destroyChrome();
  destroyBrandAssets();
  removeEventListener('afflatus-lang', onLanguage);
});
