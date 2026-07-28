import { describe, expect, it } from 'vitest';
import {
  applySectorsGraphPositions,
  capSectorsGraphData,
  createInitialSectorsGraphLayout,
  encodeSectorsGraphPositions,
  prepareSectorsGraphLayout,
  settlePreparedSectorsGraphLayout,
} from '../src/lib/sectorsGraphLayout.js';

const ecosystemFixture = {
  ecosystemGraph: {
    chapters: [{ id: 'one', start: 0 }],
    nodes: [
      { id: 'us', label: 'US', stage: 'models', country: 'US', reveal: 0.2 },
      { id: 'cn', label: 'CN', stage: 'models', country: 'CN', reveal: 0.2 },
    ],
    edges: [{ id: 'edge', source: 'us', target: 'cn', type: 'compute', weight: 1 }],
  },
};

describe('Sectors force layout preparation', () => {
  it('keeps initial and settled layouts serializable and deterministic', () => {
    const prepared = prepareSectorsGraphLayout(ecosystemFixture);
    const initial = createInitialSectorsGraphLayout(prepared);
    const first = settlePreparedSectorsGraphLayout(prepared);
    const second = settlePreparedSectorsGraphLayout(prepared);

    expect(prepared.iterations).toBe(360);
    expect(initial.nodes).toHaveLength(first.nodes.length);
    expect(first).toEqual(second);
    expect(() => structuredClone(first)).not.toThrow();
  });

  it('transfers settled positions as a compact Float32Array snapshot', () => {
    const prepared = prepareSectorsGraphLayout(ecosystemFixture);
    const initial = createInitialSectorsGraphLayout(prepared);
    const settled = settlePreparedSectorsGraphLayout(prepared);
    const snapshot = encodeSectorsGraphPositions(settled);

    expect(snapshot.positions).toBeInstanceOf(Float32Array);
    expect(snapshot.positions.byteLength).toBe(settled.nodes.length * 4 * Float32Array.BYTES_PER_ELEMENT);
    applySectorsGraphPositions(initial, snapshot);
    expect(initial.nodes.map(({ x, y }) => [x, y])).toEqual(
      settled.nodes.map(({ x, y }) => [Math.fround(x), Math.fround(y)]),
    );
  });

  it('caps only mobile equity collections without mutating input', () => {
    const data = {
      baskets: [{
        vendor: 'example',
        equities: Array.from({ length: 12 }, (_, index) => ({
          ticker: `T${index}`,
          confidence: index / 12,
        })),
      }],
    };
    const capped = capSectorsGraphData(data, true);
    expect(capped.baskets[0].equities).toHaveLength(8);
    expect(capped.baskets[0].equities[0].ticker).toBe('T11');
    expect(data.baskets[0].equities).toHaveLength(12);
    expect(capSectorsGraphData(data, false)).toBe(data);
  });
});
