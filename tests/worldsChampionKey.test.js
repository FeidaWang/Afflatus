import { describe, it, expect } from 'vitest';
import { championKey } from '../src/lib/worldsChampionKey.js';

describe('championKey (no Data Dragon map)', () => {
  it.each([
    ["Kai'Sa", 'Kaisa'], ["Bel'Veth", 'Belveth'], ["Cho'Gath", 'Chogath'], ['Dr. Mundo', 'DrMundo'],
    ['LeBlanc', 'Leblanc'], ["K'Sante", 'KSante'], ['Wukong', 'MonkeyKing'], ['Nunu & Willump', 'Nunu'],
    ['Renata Glasc', 'Renata'], ["Kha'Zix", 'Khazix'], ["Vel'Koz", 'Velkoz'], ["Rek'Sai", 'RekSai'], ["Kog'Maw", 'KogMaw'],
    // gol.gg's own spellings
    ['KhaZix', 'Khazix'], ['VelKoz', 'Velkoz'], ['Lee Sin', 'LeeSin'], ['Vi', 'Vi'],
  ])('%s → %s', (name, id) => {
    expect(championKey(name)).toBe(id);
  });
});

describe('championKey (with map)', () => {
  it('prefers the map', () => {
    expect(championKey('Foo', new Map([['Foo', 'Bar']]))).toBe('Bar');
  });

  it('falls back to the exception table when the map misses', () => {
    expect(championKey('KhaZix', new Map())).toBe('Khazix');
  });
});
