/* Champion display name → Riot Data Dragon id (spec 2026-10-26 §6). Shared by
   the candidate builder and the page fallback. Names come from gol.gg, which
   has its own spellings for a few champions (KhaZix, VelKoz). */

const EXCEPTIONS = Object.freeze({
  Wukong: 'MonkeyKing', 'Nunu & Willump': 'Nunu', 'Renata Glasc': 'Renata', LeBlanc: 'Leblanc',
  "Kai'Sa": 'Kaisa', "Bel'Veth": 'Belveth', "Cho'Gath": 'Chogath', "Kha'Zix": 'Khazix', "Vel'Koz": 'Velkoz',
  KhaZix: 'Khazix', VelKoz: 'Velkoz',
});

export function championKey(name, map) {
  return map?.get(name) ?? EXCEPTIONS[name] ?? String(name).replace(/[^A-Za-z]/g, '');
}
