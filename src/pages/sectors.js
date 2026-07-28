import './sectorsLibs.js';
import { installBrandAssets } from '../sectors/brandAssets.js';
import { createSectorsCardsController } from '../sectors/cardsController.js';
import { initSectorsCompetitionController } from '../sectors/competitionController.js';
import { currentLanguage, emptyMessage } from '../sectors/content.js';
import { createSectorsDataController } from '../sectors/dataController.js';
import { createDetailController } from '../sectors/detailController.js';
import { createSectorsGraphController } from '../sectors/graphController.js';
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

const detail = createDetailController({
  getData: () => sectorsData,
  getLanguage: currentLanguage,
  host: byId('mwDetail'),
});

const graph = createSectorsGraphController({
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

const dataController = createSectorsDataController();
const destroyBrandAssets = installBrandAssets();
const destroyChrome = initSectorsPageChrome();
const destroyStory = initSectorsStoryController();
const destroyCompetition = initSectorsCompetitionController({
  radar: byId('rbRadarHost'),
  table: byId('rbTableHost'),
  boards: byId('rbBoardsHost'),
  scoreboard: byId('rbScoreHost'),
  provenance: byId('rbCompetitionProv'),
});

let graphObserver = null;
function scheduleGraph() {
  const story = byId('storyGraphSection');
  const requests3D = new URLSearchParams(location.search).get('fx') === 'starfield3d';
  if (requests3D || !story || typeof IntersectionObserver !== 'function') {
    void graph.render();
    return;
  }
  graphObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    graphObserver.disconnect();
    graphObserver = null;
    void graph.render();
  }, { rootMargin: '900px 0px' });
  graphObserver.observe(story);
}

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
  graph.refreshLanguage();
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
  graph.destroy();
  cards.destroy();
  destroyStory();
  destroyCompetition();
  destroyChrome();
  destroyBrandAssets();
  removeEventListener('afflatus-lang', onLanguage);
});
