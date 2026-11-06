/* ============================================================
   Election rule packs: the event layer decides jurisdiction, chamber
   geometry, voting system and status vocabulary. Seat counts and dates are
   checked against official sources in docs/elections/M1.md. There are no
   results, candidates or feeds in this module, and all feeds stay disabled.
   ============================================================ */

export const PARTIES = Object.freeze({
  // `tag` is a letter drawn on a mark, so parties never differ by colour alone:
  // Labor and Greens are almost the same colour to a red-green colour-blind reader.
  us: [
    { id: 'dem', en: 'Democrat', zh: '民主党', color: '#225DA8', tag: { en: 'D', zh: '民' } },
    { id: 'rep', en: 'Republican', zh: '共和党', color: '#A73D3A', tag: { en: 'R', zh: '共' } },
    { id: 'other', en: 'Other', zh: '其他', color: '#6E4BA8', tag: { en: 'O', zh: '其' } },
  ],
  au: [
    { id: 'labor', en: 'Labor', zh: '工党', color: '#C8302E', tag: { en: 'L', zh: '工' } },
    { id: 'coalition', en: 'Coalition', zh: '联盟党', color: '#1F4E9C', tag: { en: 'C', zh: '联' } },
    { id: 'greens', en: 'Greens', zh: '绿党', color: '#4C8A1F', tag: { en: 'G', zh: '绿' } },
    { id: 'teal', en: 'Independent', zh: '独立', color: '#0F8FA6', tag: { en: 'I', zh: '独' } },
    { id: 'other', en: 'Other', zh: '其他', color: '#7B4FB0', tag: { en: 'O', zh: '其' } },
  ],
});

// `noResult` means this page holds no data, not that the contest has no result.
export const NO_RESULT = Object.freeze({ en: 'No result loaded', zh: '未加载结果' });
export const NOT_ON_BALLOT = Object.freeze({ en: 'Not on ballot', zh: '本届不改选' });

const STATUS_VOCABULARY = {
  us: {
    notStarted: { en: 'No votes reported', zh: '尚未报告票数' },
    counting: { en: 'Reporting', zh: '计票中' },
    leading: { en: 'Leading', zh: '领先' },
    called: { en: 'Called by provider', zh: '提供方判定' },
    final: { en: 'Certified', zh: '已认证' },
    unavailable: { en: 'Source unavailable', zh: '来源不可用' },
  },
  au: {
    notStarted: { en: 'Not yet counting', zh: '尚未开始计票' },
    counting: { en: 'Counted, with primary votes', zh: '计票中（含第一优先票）' },
    leading: { en: 'Leading on TCP', zh: '两候选人优先票领先' },
    called: { en: 'Media projection', zh: '媒体预测' },
    final: { en: 'Declared by {authority}', zh: '由 {authority} 正式宣布' },
    unavailable: { en: 'Source unavailable', zh: '来源不可用' },
  },
};

const HOUSE_US = {
  id: 'house',
  name: { en: 'House', zh: '众议院' },
  fullName: { en: 'House of Representatives', zh: '众议院' },
  seats: 435,
  majority: 218,
  geometry: 'fan',
  majorityLabel: { en: '218 for majority', zh: '218 席过半' },
};

export const ELECTION_EVENTS = Object.freeze([
  {
    id: 'us-2026',
    family: 'us',
    level: { en: 'Federal · 2026', zh: '联邦 · 2026' },
    name: { en: 'US Midterms 2026', zh: '美国 2026 中期选举' },
    short: { en: 'US 2026', zh: '美国 2026' },
    region: { en: 'United States', zh: '美国' },
    headline: { en: 'The US voted on 3 November', zh: '美国已于 11 月 3 日投票' },
    pollDate: '2026-11-03',
    sortDate: '2026-11-03',
    // House and Senate terms begin at noon on 3 January (20th Amendment). A runoff or postponed contest must come before.
    termStarts: '2027-01-03',
    pollsCloseUtc: null,
    dateLabel: { en: '3 Nov 2026', zh: '2026 年 11 月 3 日' },
    pollsClose: { en: 'Polls close by state', zh: '各州关门时间不同' },
    timeLabel: 'AEDT · ET',
    authority: 'State election offices',
    decision: { en: 'Provider call, then state certification', zh: '提供方判定，之后由各州认证' },
    feed: { en: 'civicAPI, read by your browser · unofficial', zh: 'civicAPI，由你的浏览器直接读取 · 非正式' },
    officialUrl: 'https://www.eac.gov/election-officials/election-results-canvass-and-certification',
    officialLabel: { en: 'How results are certified (EAC)', zh: '结果如何认证（EAC）' },
    votingSystem: { en: 'Plurality in most states; some use ranked choice or runoffs', zh: '多数州为简单多数，部分州用排序复选或决选' },
    note: { en: 'A lead is not a race call. Calls come from named providers; certification comes later, state by state. Some contests can go to a later runoff.', zh: '领先不等于判定。判定来自具名提供方，各州之后才逐一认证。部分比赛可能之后还有决选。' },
    extraFact: { en: 'Senate 35 of 100 on ballot', zh: '参议院 100 席中 35 席改选' },
    offices: [
      HOUSE_US,
      {
        id: 'senate',
        name: { en: 'Senate', zh: '参议院' },
        fullName: { en: 'Senate', zh: '参议院' },
        seats: 100,
        majority: 51,
        // Only 35 are up and the seats not up have no source yet, so no bar here can be read against 51.
        heldSeatsUnknown: true,
        geometry: 'fan',
        majorityLabel: { en: '51 for an outright majority', zh: '51 席为绝对多数' },
        majorityNote: { en: 'A 50–50 split depends on the Vice President.', zh: '50 比 50 时取决于副总统。' },
      },
    ],
  },
  {
    id: 'vic-2026',
    family: 'au',
    level: { en: 'State · 2026', zh: '州 · 2026' },
    name: { en: 'Victorian state election 2026', zh: '维多利亚州 2026 州选举' },
    short: { en: 'VIC 2026', zh: '维州 2026' },
    region: { en: 'Victoria', zh: '维多利亚州' },
    headline: { en: 'Victoria votes on Saturday 28 November', zh: '维多利亚州 11 月 28 日（周六）投票' },
    pollDate: '2026-11-28',
    sortDate: '2026-11-28',
    pollsCloseUtc: '2026-11-28T07:00:00Z',
    dateLabel: { en: '28 Nov 2026', zh: '2026 年 11 月 28 日' },
    pollsClose: { en: 'Polls close 18:00 AEDT', zh: '18:00 AEDT 关门' },
    timeLabel: 'AEDT',
    authority: 'VEC',
    decision: { en: 'VEC declaration; media projections are labelled', zh: 'VEC 正式宣布；媒体预测单独标注' },
    feed: { en: 'VEC results feed: not connected', zh: 'VEC 结果数据：尚未接入' },
    officialUrl: 'https://www.vec.vic.gov.au/',
    officialLabel: { en: 'Victorian Electoral Commission', zh: '维多利亚州选举委员会' },
    votingSystem: { en: 'Assembly: full preferential. Council: proportional (STV), 8 regions × 5', zh: '下院：全优先制。上院：比例制（STV），8 个大区各 5 席' },
    note: { en: 'A lead on TCP is not a declaration. The VEC declares results; media projections are labelled as such.', zh: '两候选人优先票领先不等于当选。结果由 VEC 宣布，媒体预测会单独标注。' },
    extraFact: { en: 'Legislative Council 40', zh: '立法院 40 席' },
    offices: [
      {
        id: 'assembly',
        name: { en: 'Assembly', zh: '立法议会' },
        fullName: { en: 'Legislative Assembly', zh: '立法议会' },
        seats: 88,
        majority: 45,
        geometry: 'horseshoe',
        majorityLabel: { en: '45 for majority', zh: '45 席过半' },
      },
      {
        id: 'council',
        name: { en: 'Council', zh: '立法院' },
        fullName: { en: 'Legislative Council', zh: '立法院' },
        seats: 40,
        majority: 21,
        geometry: 'horseshoe',
        majorityLabel: { en: '21 is an arithmetic majority', zh: '21 席为算术过半' },
      },
    ],
  },
  {
    id: 'nsw-2027',
    family: 'au',
    level: { en: 'State · 2027', zh: '州 · 2027' },
    name: { en: 'New South Wales state election 2027', zh: '新南威尔士州 2027 州选举' },
    short: { en: 'NSW 2027', zh: '新州 2027' },
    region: { en: 'New South Wales', zh: '新南威尔士州' },
    headline: { en: 'New South Wales votes on Saturday 13 March', zh: '新南威尔士州 3 月 13 日（周六）投票' },
    pollDate: '2027-03-13',
    sortDate: '2027-03-13',
    pollsCloseUtc: '2027-03-13T07:00:00Z',
    dateLabel: { en: '13 Mar 2027', zh: '2027 年 3 月 13 日' },
    pollsClose: { en: 'Polls close 18:00 AEDT', zh: '18:00 AEDT 关门' },
    timeLabel: 'AEDT',
    authority: 'NSW Electoral Commission',
    decision: { en: 'NSW Electoral Commission declaration; media projections are labelled', zh: '新州选举委员会正式宣布；媒体预测单独标注' },
    feed: { en: 'NSW Electoral Commission: not connected', zh: '新州选举委员会：尚未接入' },
    officialUrl: 'https://elections.nsw.gov.au/',
    officialLabel: { en: 'NSW Electoral Commission', zh: '新州选举委员会' },
    votingSystem: { en: 'Assembly: optional preferential. Council: proportional (STV), 21 of 42 up', zh: '下院：可选优先制。上院：比例制（STV），42 席中 21 席改选' },
    note: { en: 'A lead on TCP is not a declaration. The Commission declares results; media projections are labelled as such.', zh: '两候选人优先票领先不等于当选。结果由选举委员会宣布，媒体预测会单独标注。' },
    extraFact: { en: 'Legislative Council 42 (21 up)', zh: '立法院 42 席（21 席改选）' },
    offices: [
      {
        id: 'assembly',
        name: { en: 'Assembly', zh: '立法议会' },
        fullName: { en: 'Legislative Assembly', zh: '立法议会' },
        seats: 93,
        majority: 47,
        geometry: 'horseshoe',
        majorityLabel: { en: '47 for majority', zh: '47 席过半' },
      },
      {
        id: 'council',
        name: { en: 'Council', zh: '立法院' },
        fullName: { en: 'Legislative Council', zh: '立法院' },
        seats: 42,
        // 21 of the 42 are up in 2027; which places they are is not on this page.
        up: 21,
        majority: 22,
        geometry: 'horseshoe',
        majorityLabel: { en: '22 is an arithmetic majority', zh: '22 席为算术过半' },
      },
    ],
  },
  {
    id: 'au-2028',
    family: 'au',
    level: { en: 'Federal · 2028', zh: '联邦 · 2028' },
    name: { en: 'Australian federal election 2028', zh: '澳大利亚 2028 联邦选举' },
    short: { en: 'AU 2028', zh: '澳洲 2028' },
    region: { en: 'Australia', zh: '澳大利亚' },
    headline: { en: 'Australia’s next federal election', zh: '澳大利亚下一次联邦选举' },
    pollDate: null,
    // For ordering only. No date has been announced.
    sortDate: '2028-05-31',
    pollsCloseUtc: null,
    dateLabel: { en: 'Date not set · half-Senate window ends May 2028', zh: '日期未定 · 半数参议院选举窗口至 2028 年 5 月' },
    pollsClose: { en: 'Polls close 18:00 local, state by state', zh: '各州当地 18:00 关门' },
    // No date is set and the window runs into May, after daylight saving ends.
    timeLabel: 'AEST/AEDT',
    authority: 'AEC',
    decision: { en: 'AEC declaration; media projections are labelled', zh: 'AEC 正式宣布；媒体预测单独标注' },
    feed: { en: 'AEC Tally Room and Media Feed: not connected', zh: 'AEC Tally Room 与 Media Feed：尚未接入' },
    officialUrl: 'https://www.aec.gov.au/',
    officialLabel: { en: 'Australian Electoral Commission', zh: '澳大利亚选举委员会' },
    votingSystem: { en: 'House: full preferential. Senate: proportional (STV), 40 of 76 up at a half-Senate election', zh: '众议院：全优先制。参议院：比例制（STV），半数改选时 76 席中 40 席改选' },
    note: { en: 'A lead on TCP is not a declaration. The AEC declares results; media projections are labelled as such.', zh: '两候选人优先票领先不等于当选。结果由 AEC 宣布，媒体预测会单独标注。' },
    extraFact: { en: 'Senate 76 (40 up)', zh: '参议院 76 席（40 席改选）' },
    offices: [
      {
        id: 'house',
        name: { en: 'House', zh: '众议院' },
        fullName: { en: 'House of Representatives', zh: '众议院' },
        seats: 150,
        majority: 76,
        geometry: 'horseshoe',
        majorityLabel: { en: '76 for majority', zh: '76 席过半' },
      },
      {
        id: 'senate',
        name: { en: 'Senate', zh: '参议院' },
        fullName: { en: 'Senate', zh: '参议院' },
        seats: 76,
        // 40 at a half-Senate election: 6 from each state and all 4 territory senators.
        up: 40,
        majority: 39,
        geometry: 'horseshoe',
        majorityLabel: { en: '39 is an arithmetic majority', zh: '39 席为算术过半' },
      },
    ],
  },
  {
    id: 'us-2028',
    family: 'us',
    level: { en: 'Federal · 2028', zh: '联邦 · 2028' },
    name: { en: 'US Presidential 2028', zh: '美国 2028 总统选举' },
    short: { en: 'US 2028', zh: '美国 2028' },
    region: { en: 'United States', zh: '美国' },
    headline: { en: 'The US votes on Tuesday 7 November', zh: '美国 11 月 7 日（周二）投票' },
    pollDate: '2028-11-07',
    sortDate: '2028-11-07',
    pollsCloseUtc: null,
    dateLabel: { en: '7 Nov 2028', zh: '2028 年 11 月 7 日' },
    pollsClose: { en: 'Polls close by state', zh: '各州关门时间不同' },
    timeLabel: 'ET · AEDT',
    authority: 'Electoral College',
    decision: { en: 'Provider call, then state certification and the Electoral College', zh: '提供方判定，之后各州认证并由选举人团投票' },
    feed: { en: 'No feed connected', zh: '尚未接入数据源' },
    officialUrl: 'https://www.archives.gov/electoral-college/allocation',
    officialLabel: { en: 'Electoral College allocation (NARA)', zh: '选举人票分配（NARA）' },
    votingSystem: { en: 'Electoral College; Maine and Nebraska split by district', zh: '选举人团；缅因州与内布拉斯加州按选区拆分' },
    note: { en: 'No candidates or scenarios are shown.', zh: '不显示候选人或情景。' },
    extraFact: { en: 'Maine and Nebraska split', zh: '缅因州与内布拉斯加州拆分' },
    offices: [
      {
        id: 'president',
        name: { en: 'President', zh: '总统' },
        fullName: { en: 'Electoral College', zh: '选举人团' },
        seats: 538,
        majority: 270,
        geometry: null,
        unit: { en: 'electoral votes', zh: '张选举人票' },
        majorityLabel: { en: '270 to win', zh: '270 票胜出' },
      },
    ],
  },
]);

export const eventById = (id) => ELECTION_EVENTS.find((event) => event.id === id) || null;
export const officeById = (event, id) => event?.offices.find((office) => office.id === id) || null;

export function statusVocabulary(event) {
  const fill = (text) => text.replace('{authority}', event.authority);
  return Object.fromEntries(Object.entries(STATUS_VOCABULARY[event.family]).map(([key, label]) => [
    key,
    { en: fill(label.en), zh: fill(label.zh) },
  ]));
}

// Calendar date in Melbourne, the page's primary time zone.
const melbourneDate = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne' }).format(now);
const dayNumber = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000;

export function eventPhase(event, now) {
  if (event.pollsCloseUtc) return now >= new Date(event.pollsCloseUtc) ? 'past' : 'upcoming';
  if (!event.pollDate) return 'undated';
  return melbourneDate(now) > event.pollDate ? 'past' : 'upcoming';
}

/** Whole calendar days to polling day in Melbourne, or null when no date is set. */
export function daysUntil(event, now) {
  if (!event.pollDate) return null;
  return dayNumber(event.pollDate) - dayNumber(melbourneDate(now));
}

// An undated event stops being "next" once its ordering date passes, without claiming it took place.
export function nextEvent(now) {
  return ELECTION_EVENTS.find((event) => {
    const phase = eventPhase(event, now);
    return phase === 'upcoming' || (phase === 'undated' && melbourneDate(now) <= event.sortDate);
  }) || null;
}

/** NOW marker position on an evenly spaced rail, as a share of the rail width. */
export function railPositions(now) {
  const step = 100 / ELECTION_EVENTS.length;
  const stops = ELECTION_EVENTS.map((event, index) => ({ event, left: step * (index + 0.5) }));
  const past = stops.filter(({ event }) => eventPhase(event, now) === 'past').length;
  return { stops, nowLeft: step * past };
}
