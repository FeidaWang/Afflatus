import { describe, expect, it } from 'vitest';
import { atlasRelations, atlasSceneState } from '../src/lib/courseAtlas.js';

describe('course atlas scroll scene', () => {
  it('opens on downward window scroll and reverses to the title', () => {
    const top = atlasSceneState(1000, 1000, 2000, 1000);
    const middle = atlasSceneState(1500, 1000, 2000, 1000);
    const restored = atlasSceneState(1000, 1000, 2000, 1000);

    expect(top.titleOpacity).toBe(1);
    expect(top.mapOpacity).toBe(0);
    expect(middle.titleOpacity).toBe(0);
    expect(middle.mapOpacity).toBe(1);
    expect(atlasSceneState(2000, 1000, 2000, 1000).active).toBe(true);
    expect(restored).toEqual(top);
  });

  it('connects strongly related material across question clusters', () => {
    expect(atlasRelations).toHaveLength(16);
    expect(atlasRelations).toContainEqual(['15', '20', 'state']);
    expect(atlasRelations).toContainEqual(['25', '34', 'pilot']);
    expect(atlasRelations).toContainEqual(['04', '36', 'transfer']);
  });
});
