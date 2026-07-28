import {
  buildForceGraphData,
  createForceSim,
  settleForceSim,
} from './forceGraph.js';

export const ECOSYSTEM_FORCE_SETTINGS = Object.freeze({
  repulsion: 0.05,
  springLength: 0.42,
  springStrength: 0.022,
  poleStrength: 0.1,
  damping: 0.86,
  minDist: 0.12,
});

const MOBILE_MAX_EQUITIES = 8;

export function capSectorsGraphData(data, mobile = false) {
  if (!mobile) return data || {};
  const capped = typeof structuredClone === 'function'
    ? structuredClone(data || {})
    : JSON.parse(JSON.stringify(data || {}));
  if (Array.isArray(capped.baskets)) {
    capped.baskets = capped.baskets.map((basket) => ({
      ...basket,
      equities: (basket.equities || [])
        .slice()
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, MOBILE_MAX_EQUITIES),
    }));
  }
  return capped;
}

export function prepareSectorsGraphLayout(data, options = {}) {
  const graph = buildForceGraphData(capSectorsGraphData(data, options.mobile));
  return {
    graph,
    settings: graph.mode === 'ecosystem' ? ECOSYSTEM_FORCE_SETTINGS : {},
    iterations: graph.mode === 'ecosystem' ? 360 : 220,
  };
}

export function createInitialSectorsGraphLayout(prepared) {
  return createForceSim(prepared.graph, prepared.settings);
}

export function settlePreparedSectorsGraphLayout(prepared) {
  const simulation = createInitialSectorsGraphLayout(prepared);
  settleForceSim(simulation, prepared.iterations);
  return simulation;
}

export function encodeSectorsGraphPositions(simulation) {
  const positions = new Float32Array((simulation?.nodes?.length || 0) * 4);
  simulation?.nodes?.forEach((node, index) => {
    const offset = index * 4;
    positions[offset] = node.x || 0;
    positions[offset + 1] = node.y || 0;
    positions[offset + 2] = node.vx || 0;
    positions[offset + 3] = node.vy || 0;
  });
  return { positions };
}

export function applySectorsGraphPositions(simulation, snapshot) {
  const positions = snapshot?.positions;
  if (!(positions instanceof Float32Array) || positions.length !== simulation.nodes.length * 4) {
    throw new Error('Invalid Sectors force-position snapshot');
  }
  simulation.nodes.forEach((node, index) => {
    const offset = index * 4;
    node.x = positions[offset];
    node.y = positions[offset + 1];
    node.vx = positions[offset + 2];
    node.vy = positions[offset + 3];
  });
  return simulation;
}
