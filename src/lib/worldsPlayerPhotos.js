/* Official player headshots for the Finals MVP board (spec 2026-10-26 §7).
   Riot Games photos as published on Leaguepedia (lol.fandom.com), looked up
   on each player infobox on 2026-10-26. Images © Riot Games; used under
   Riot's "Legal Jibber Jabber" fan-content policy. Players without an
   entry (JiaQi had no infobox photo) get the page placeholder. */

const CDN = 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/';
const WIKI = 'https://lol.fandom.com';

// slug: [team, image path under CDN (96 px rendition), Leaguepedia page]
const RAW = {
  breathe: ['AL', 'a/ab/AL_Breathe_2026_Split_3.png/revision/latest/scale-to-width-down/96?cb=20260723134338', '/wiki/Breathe'],
  hope: ['AL', '8/80/AL_Hope_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160126', '/wiki/Hope_(Wang_Jie)'],
  kael: ['AL', '5/57/AL_Kael_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160132', '/wiki/Kael_(Kim_Jin-hong)'],
  shanks: ['AL', '6/6a/AL_Shanks_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160145', '/wiki/Shanks'],
  tarzan: ['AL', 'e/eb/AL_Tarzan_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160102', '/wiki/Tarzan_(Lee_Seung-yong)'],
  bin: ['BLG', '1/18/BLG_Bin_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160417', '/wiki/Bin_(Chen_Ze-Bin)'],
  knight: ['BLG', 'e/ec/BLG_Knight_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160422', '/wiki/Knight_(Zhuo_Ding)'],
  on: ['BLG', 'e/e8/BLG_ON_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160426', '/wiki/ON'],
  viper: ['BLG', '3/3b/BLG_Viper_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160431', '/wiki/Viper_(Park_Do-hyeon)'],
  xun: ['BLG', '7/7c/BLG_Xun_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160434', '/wiki/XUN'],
  doggo: ['CFO', 'a/a4/CFO_Doggo_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124181353', '/wiki/Doggo'],
  kino: ['CFO', '5/55/CFO_Kino_2026_Split_3.png/revision/latest/scale-to-width-down/96?cb=20260806145822', '/wiki/Kino'],
  pout: ['CFO', '3/3a/CFO_POUT_2026_Split_3.png/revision/latest/scale-to-width-down/96?cb=20260806145823', '/wiki/Pout'],
  rest: ['CFO', 'a/aa/CFO_Rest_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124181357', '/wiki/Rest'],
  shad0w: ['CFO', '2/2e/CFO_Shad0w_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124181359', '/wiki/Shad0w'],
  career: ['DK', 'f/f3/DK_Career_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171027', '/wiki/Career'],
  lucid: ['DK', 'd/d4/DK_Lucid_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171034', '/wiki/Lucid_(Choi_Yong-hyeok)'],
  showmaker: ['DK', 'e/e7/DK_ShowMaker_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171041', '/wiki/ShowMaker'],
  siwoo: ['DK', '3/3e/DK_Siwoo_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171048', '/wiki/Siwoo'],
  smash: ['DK', '7/77/DK_Smash_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171056', '/wiki/Smash_(Shin_Geum-jae)'],
  brokenblade: ['G2', '5/53/G2_BrokenBlade_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117092520', '/wiki/BrokenBlade'],
  caps: ['G2', '6/6a/G2_Caps_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117092522', '/wiki/Caps'],
  hanssama: ['G2', 'd/d9/G2_Hans_Sama_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117092525', '/wiki/Hans_Sama'],
  labrov: ['G2', '6/62/G2_Labrov_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117092527', '/wiki/Labrov'],
  skewmond: ['G2', '0/00/G2_SkewMond_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117092529', '/wiki/SkewMond'],
  canyon: ['GEN', '5/55/GEN_Canyon_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171322', '/wiki/Canyon'],
  chovy: ['GEN', 'b/b3/GEN_Chovy_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171212', '/wiki/Chovy'],
  duro: ['GEN', '7/75/GEN_Duro_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171225', '/wiki/Duro'],
  kiin: ['GEN', '6/65/GEN_Kiin_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171304', '/wiki/Kiin'],
  ruler: ['GEN', 'e/e3/GEN_Ruler_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122171312', '/wiki/Ruler'],
  delight: ['HLE', '7/7b/HLE_Delight_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122172846', '/wiki/Delight'],
  gumayusi: ['HLE', '0/0e/HLE_Gumayusi_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122172840', '/wiki/Gumayusi'],
  kanavi: ['HLE', '1/14/HLE_Kanavi_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122172841', '/wiki/Kanavi'],
  zeka: ['HLE', '3/36/HLE_Zeka_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122172843', '/wiki/Zeka_(Kim_Geon-woo)'],
  zeus: ['HLE', 'c/cf/HLE_Zeus_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260122172844', '/wiki/Zeus'],
  meiko: ['IG', 'c/c1/IG_Meiko_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160909', '/wiki/meiko'],
  rookie: ['IG', '1/1b/IG_Rookie_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160928', '/wiki/RooKie'],
  theshy: ['IG', 'b/b9/IG_TheShy_2025_Worlds.png/revision/latest/scale-to-width-down/96?cb=20251013151900', '/wiki/TheShy'],
  wei: ['IG', 'a/a7/IG_Wei_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260327160951', '/wiki/Wei_(Yan_Yang-Wei)'],
  busio: ['KC', '5/52/KC_Busio_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721165931', '/wiki/Busio'],
  caliste: ['KC', '9/9d/KC_Caliste_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721165928', '/wiki/Caliste'],
  canna: ['KC', '2/29/KC_Canna_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721165929', '/wiki/Canna'],
  kyeahoo: ['KC', '5/5c/KC_kyeahoo_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721165933', '/wiki/Kyeahoo'],
  yike: ['KC', 'b/be/KC_Yike_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721165926', '/wiki/Yike'],
  ackerman: ['LOS', '5/5d/LOS_Ackerman_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260729214349', '/wiki/Ackerman_(Gabriel_Aparicio)'],
  curse: ['LOS', '0/09/LOS_Curse_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260729214007', '/wiki/Curse_(Ra%C3%AD_Yamada)'],
  duduhh: ['LOS', '4/48/LOS_Duduhh_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260729214157', '/wiki/Duduhh'],
  feisty: ['LOS', 'd/d6/LOS_Feisty_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260729214051', '/wiki/Feisty'],
  zest: ['LOS', '4/47/LOS_Zest_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260729213929', '/wiki/Zest_(Kim_Dong-min)'],
  berserker: ['LYON', '2/2d/LYON_Berserker_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260131091823', '/wiki/Berserker_(Kim_Min-cheol)'],
  dhokla: ['LYON', '4/47/LYON_Dhokla_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041832', '/wiki/Dhokla'],
  inspired: ['LYON', 'f/fa/LYON_Inspired_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041829', '/wiki/Inspired'],
  isles: ['LYON', 'c/ce/LYON_Isles_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041834', '/wiki/Isles'],
  saint: ['LYON', '7/7b/LYON_Saint_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041831', '/wiki/Saint_(Kang_Sung-in)'],
  alvaro: ['MKOI', 'e/ed/MKOI_Alvaro_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117101830', '/wiki/Alvaro_(%C3%81lvaro_Fern%C3%A1ndez)'],
  elyoya: ['MKOI', 'f/f9/MKOI_Elyoya_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721170427', '/wiki/Elyoya'],
  jojopyun: ['MKOI', 'a/ac/MKOI_Jojopyun_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117101834', '/wiki/jojopyun'],
  myrwn: ['MKOI', '4/4b/MKOI_Myrwn_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260117101837', '/wiki/Myrwn'],
  supa: ['MKOI', 'a/aa/MKOI_Supa_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721170424', '/wiki/Supa'],
  doran: ['T1', 'd/de/T1_Doran_2026_LCK_Cup.png/revision/latest/scale-to-width-down/96?cb=20260122163256', '/wiki/Doran_(Choi_Hyeon-jun)'],
  faker: ['T1', '5/5a/T1_Faker_2026_LCK_Cup.png/revision/latest/scale-to-width-down/96?cb=20260122163312', '/wiki/Faker'],
  keria: ['T1', 'd/da/T1_Keria_2026_LCK_Cup.png/revision/latest/scale-to-width-down/96?cb=20260122163329', '/wiki/Keria'],
  oner: ['T1', 'd/d2/T1_Oner_2026_LCK_Cup.png/revision/latest/scale-to-width-down/96?cb=20260122163304', '/wiki/Oner'],
  peyz: ['T1', 'e/e9/T1_Peyz_2026_LCK_Cup.png/revision/latest/scale-to-width-down/96?cb=20260122163320', '/wiki/Peyz'],
  '369': ['TES', '6/6f/TES_369_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260328182011', '/wiki/369'],
  creme: ['TES', '4/49/TES_Creme_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260328182016', '/wiki/Creme'],
  jackeylove: ['TES', '1/1f/TES_JackeyLove_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260325171016', '/wiki/JackeyLove'],
  tian: ['TES', '9/92/TES_Tian_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260501040950', '/wiki/Tian'],
  zhuo: ['TES', 'a/a1/TES_Zhuo_2026_Split_3.png/revision/latest/scale-to-width-down/96?cb=20260723134333', '/wiki/Zhuo'],
  corejj: ['TL', '8/80/TL_CoreJJ_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041859', '/wiki/CoreJJ'],
  josedeodo: ['TL', 'f/fb/TL_Josedeodo_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041857', '/wiki/Josedeodo'],
  morgan: ['TL', '3/3a/TL_Morgan_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260131091809', '/wiki/Morgan'],
  quid: ['TL', 'c/c9/TL_Quid_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041855', '/wiki/Quid'],
  yeon: ['TL', 'e/ef/TL_Yeon_2026_Split_1.png/revision/latest/scale-to-width-down/96?cb=20260124041900', '/wiki/Yeon_(Sean_Sung)'],
  bie: ['TSW', '6/69/TSW_Bie_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721172248', '/wiki/Bie'],
  dire: ['TSW', '3/35/TSW_Dire_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721172247', '/wiki/Dire'],
  eddie: ['TSW', '7/7a/TSW_Eddie_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721172242', '/wiki/Eddie'],
  hizto: ['TSW', '7/7a/TSW_Hizto_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721172251', '/wiki/Hizto'],
  pun: ['TSW', 'd/d3/TSW_Pun_2026_Split_2.png/revision/latest/scale-to-width-down/96?cb=20260721172243', '/wiki/Pun'],
};

export function playerSlug(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const PLAYER_PHOTOS = Object.freeze(Object.fromEntries(Object.entries(RAW).map(([slug, [team, path, page]]) => [
  slug, Object.freeze({ team, src: CDN + path, sourceUrl: WIKI + page }),
])));

export function photoFor(name) {
  return PLAYER_PHOTOS[playerSlug(name)] ?? null;
}
