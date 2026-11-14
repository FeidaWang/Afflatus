/* ============================================================
   Official prior-election baselines and party emblem manifest checks.
   Baselines render only while an upcoming election has no current-cycle
   snapshot, and yield immediately when live or replay data arrives.
   ============================================================ */
import { snapshotErrors } from './electionResults.js';

export const BASELINE_VERSION = '2026-11-13';

const BASELINES = Object.freeze({
  'vic-2026': Object.freeze({
    file: 'vic-2022',
    year: 2022,
    label: { en: '2022 baseline', zh: '上届基准 · 2022' },
    detail: { en: 'VEC 2022 Victorian state election · official final results', zh: 'VEC 2022 年维州选举 · 官方最终结果' },
    credit: { en: 'Baseline: © State Government of Victoria (VEC), CC BY 4.0', zh: '上届基准：© State Government of Victoria（VEC），CC BY 4.0' },
    drawerNote: { en: '2022 state election baseline · 2026 polls close 28 Nov', zh: '上届基准（2022 年州选举）· 本届于 11 月 28 日开票' },
  }),
  'nsw-2027': Object.freeze({
    file: 'nsw-2023',
    year: 2023,
    label: { en: '2023 baseline', zh: '上届基准 · 2023' },
    detail: { en: 'NSWEC 2023 NSW state election · official final results', zh: 'NSWEC 2023 年新州选举 · 官方最终结果' },
    credit: { en: 'Baseline: © State of New South Wales (NSW Electoral Commission), CC BY', zh: '上届基准：© State of New South Wales（新州选举委员会），CC BY' },
    drawerNote: { en: '2023 state election baseline · 2027 polls close 13 Mar', zh: '上届基准（2023 年州选举）· 本届于 2027 年 3 月 13 日开票' },
  }),
});

export const baselineFor = (eventId) => BASELINES[eventId] || null;
export const baselineUrl = (file) => `/assets/elections/baselines/${BASELINE_VERSION}/${file}.json`;

const isHex64 = (value) => /^[0-9a-f]{64}$/.test(value ?? '');
const isHttps = (value) => /^https:\/\//.test(value ?? '');

export function validateElectionBaseline(data) {
  const errors = snapshotErrors(data);
  if (data?.mode !== 'baseline') errors.push('mode: baseline snapshot must use mode "baseline"');
  if (data?.isSynthetic !== false) errors.push('isSynthetic: baseline must come from official results');
  if (!Number.isInteger(data?.baselineYear) || data.baselineYear < 2000) errors.push('baselineYear: missing year');
  if (typeof data?.baselineLabel?.en !== 'string' || typeof data?.baselineLabel?.zh !== 'string') errors.push('baselineLabel: bilingual label required');
  if (typeof data?.baselineDetail?.en !== 'string' || typeof data?.baselineDetail?.zh !== 'string') errors.push('baselineDetail: bilingual detail required');
  if (!data?.races?.length) errors.push('races: baseline must include at least one race');
  return { ok: errors.length === 0, errors };
}

export function validateElectionBaselineManifest(data) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.version ?? '')) errors.push('manifest needs a dated version');
  if (Number.isNaN(Date.parse(data?.retrievedAt ?? ''))) errors.push('manifest needs retrievedAt');
  const entries = Object.entries(data?.files ?? {});
  if (!entries.length) errors.push('manifest lists no baseline files');
  for (const [name, row] of entries) {
    if (!row?.eventId || !row?.baselineElection || !row?.authority || !row?.licence) errors.push(`${name}: missing metadata`);
    if (!isHttps(row?.sourceUrl) || !isHttps(row?.workbookUrl)) errors.push(`${name}: missing https source URLs`);
    if (!isHex64(row?.workbookSha256) || !isHex64(row?.sha256)) errors.push(`${name}: missing sha256 digests`);
    if (!Number.isInteger(row?.bytes) || row.bytes <= 0) errors.push(`${name}: missing byte count`);
  }
  return { ok: errors.length === 0, errors };
}

const REQUIRED_PARTY_LOGOS = ['us-dem', 'us-rep', 'au-alp', 'au-liberal', 'au-nationals', 'au-greens', 'independent', 'other'];

export function validateElectionPartyLogosManifest(data) {
  const errors = [];
  for (const id of REQUIRED_PARTY_LOGOS) {
    const row = data?.[id];
    if (!row) {
      errors.push(`missing party icon entry ${id}`);
      continue;
    }
    if (!row.name || !/^\/assets\/elections\/parties\/[\w-]+\.svg$/.test(row.file ?? '')) errors.push(`${id}: invalid file path`);
    if (!isHex64(row.web_sha256) || !(Number(row.aspect) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(row.retrieved_on ?? '')) errors.push(`${id}: incomplete digest or aspect`);
    if (row.kind !== 'editorial-geometric') {
      if (!/^\/assets\/elections\/parties\/official\/[\w-]+\.svg$/.test(row.official_file ?? '')) errors.push(`${id}: missing official_file`);
      if (!isHttps(row.source_page) || !isHttps(row.source_url) || !isHex64(row.official_sha256) || !row.licence) errors.push(`${id}: incomplete official provenance`);
    }
  }
  return { ok: errors.length === 0, errors };
}
