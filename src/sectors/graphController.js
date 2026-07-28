import { fetchJson } from '../lib/fetchJson.js';
import { createExclusiveRenderer } from '../lib/exclusiveRenderer.js';
import { initSectorsGraph } from '../lib/sectorsGraphView.js';
import {
  currentLanguage,
  emptyMessage,
  vendorName,
} from './content.js';

function requestedRenderer() {
  try {
    return new URLSearchParams(location.search).get('fx') === 'starfield3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

export function createSectorsGraphController(hosts, options = {}) {
  const getData = options.getData || (() => null);
  const detailController = options.detailController;
  const renderer = createExclusiveRenderer();
  const universeAbort = new AbortController();
  let universeData = null;
  let desiredRenderer = requestedRenderer();
  let destroyed = false;

  function setActiveState(id) {
    if (hosts.story) hosts.story.dataset.activeRenderer = id || 'none';
    if (hosts.canvas) hosts.canvas.hidden = id === '3d';
  }

  function hasGraphData(data) {
    return Boolean(data?.modelWatch?.length || data?.ecosystemGraph?.nodes?.length);
  }

  async function show2D() {
    if (destroyed) return null;
    const data = getData();
    desiredRenderer = '2d';
    if (!hasGraphData(data)) {
      renderer.deactivate();
      setActiveState(null);
      if (hosts.canvas) hosts.canvas.hidden = true;
      if (hosts.detail) hosts.detail.hidden = true;
      if (hosts.empty) {
        hosts.empty.hidden = false;
        hosts.empty.textContent = emptyMessage(currentLanguage());
      }
      return null;
    }
    if (hosts.empty) hosts.empty.hidden = true;
    if (renderer.activeId === '2d') {
      renderer.handle?.update?.(data);
      setActiveState('2d');
      return renderer.handle;
    }
    setActiveState(null);
    const handle = await renderer.activate('2d', async () => {
      if (hosts.canvas) hosts.canvas.hidden = false;
      return initSectorsGraph(hosts.canvas, data, {
        onSelect: (node) => detailController?.render(node),
        labelFor: (node) => node.kind === 'vendor'
          ? vendorName(node.vendor, currentLanguage())
          : node.label,
        lang: currentLanguage,
        controlHost: hosts.controls,
        summaryElement: hosts.summary,
        tooltipElement: hosts.tooltip,
        storyHost: hosts.story,
        progressElement: hosts.progress,
      });
    });
    if (handle) setActiveState('2d');
    return handle;
  }

  async function loadUniverse() {
    if (universeData) return universeData;
    try {
      universeData = await fetchJson('arena-universe', { signal: universeAbort.signal });
    } catch {
      universeData = {};
    }
    return universeData;
  }

  async function show3D() {
    if (destroyed) return null;
    const data = getData();
    if (!data?.modelWatch?.length) return show2D();
    desiredRenderer = '3d';
    if (renderer.activeId === '3d') {
      renderer.handle?.update?.({ sectorsData: data, universeData });
      setActiveState('3d');
      return renderer.handle;
    }
    setActiveState(null);
    const universe = await loadUniverse();
    if (destroyed || desiredRenderer !== '3d') return null;
    let handle;
    try {
      handle = await renderer.activate('3d', async () => {
        const { initSectorsStarfield } = await import('../scene/sectorsStarfield.js');
        if (destroyed || desiredRenderer !== '3d') return null;
        return initSectorsStarfield({ sectorsData: data, universeData: universe }, {
          buildDetail: detailController?.buildDetail,
          onExit(reason) {
            if (reason === 'user' && !destroyed) void show2D();
          },
        });
      });
    } catch {
      // A missing WebGL capability or a failed lazy chunk must leave the
      // editorial 2D story usable instead of surfacing an unhandled rejection.
      document.querySelectorAll('.sfStage').forEach((stage) => stage.remove());
      if (destroyed || desiredRenderer !== '3d') return null;
      desiredRenderer = '2d';
      return show2D();
    }
    if (!handle) {
      desiredRenderer = '2d';
      return show2D();
    }
    setActiveState('3d');
    return handle;
  }

  function render() {
    if (desiredRenderer === '3d') return show3D();
    return show2D();
  }

  return Object.freeze({
    render,
    show2D,
    show3D,
    refreshLanguage() {
      if (renderer.activeId === '2d') renderer.handle?.refreshLanguage?.();
      else if (renderer.activeId === '3d') {
        renderer.handle?.update?.({ sectorsData: getData(), universeData });
      }
    },
    get activeRenderer() {
      return renderer.activeId;
    },
    destroy() {
      destroyed = true;
      universeAbort.abort();
      renderer.deactivate();
      setActiveState(null);
    },
  });
}
