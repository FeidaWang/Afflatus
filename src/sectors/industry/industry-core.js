// src/sectors/industry/industry-core.js
export const LAYERS = ['labs', 'apps', 'compute', 'foundry', 'memory', 'network', 'infra', 'power'];
export const GRAPH_COLUMNS = ['power', 'foundry', 'memory', 'compute', 'network', 'infra', 'labs', 'apps'];
export const EDGE_TYPES = ['investment', 'compute', 'chips', 'models', 'competitor'];
export const LISTINGS = ['listed', 'adr', 'pre_ipo', 'non_us', 'private'];
export const FACT_STATUS = ['official', 'independent', 'lab_claimed', 'reported', 'projection', 'unverified'];

export const LAYER_LABEL = {
  labs: { en: 'Labs & platforms', zh: '实验室与平台' },
  apps: { en: 'Software & apps', zh: '软件与应用' },
  compute: { en: 'Compute chips', zh: '算力芯片' },
  foundry: { en: 'Foundry & equipment', zh: '代工与设备' },
  memory: { en: 'Memory & storage', zh: '存储' },
  network: { en: 'Networking & optics', zh: '网络与光通信' },
  infra: { en: 'Servers & neoclouds', zh: '服务器与新云' },
  power: { en: 'Power & cooling', zh: '电力与散热' },
};
export const EDGE_LABEL = {
  investment: { en: 'Investment', zh: '投资' },
  compute: { en: 'Compute & cloud', zh: '算力与云' },
  chips: { en: 'Chips, memory & tools', zh: '芯片、存储与设备' },
  models: { en: 'Model licensing', zh: '模型授权' },
  competitor: { en: 'Competition', zh: '竞争' },
};
export const STATUS_LABEL = {
  official: { en: 'Official', zh: '官方' },
  independent: { en: 'Independent', zh: '第三方' },
  lab_claimed: { en: 'Lab-claimed', zh: '实验室自报' },
  reported: { en: 'Reported', zh: '媒体报道' },
  projection: { en: 'Projection', zh: '预期' },
  unverified: { en: 'Unverified', zh: '未核验' },
};

export const renderable = (item) => item?.status !== 'unverified';

export function validateIndustry(data) {
  if (!data || data.schema_version !== 1) return ['schema_version must be 1'];
  const errors = [];
  const sources = new Set();
  for (const s of data.sources ?? []) {
    if (!s.id || sources.has(s.id)) errors.push(`source id missing or duplicate: ${s.id}`);
    sources.add(s.id);
    if (!/^https:\/\//.test(s.url ?? '')) errors.push(`source ${s.id} needs an https url`);
  }
  const cite = (where, ids) => {
    if (!Array.isArray(ids) || ids.length === 0) errors.push(`${where} has no source_ids`);
    else for (const id of ids) if (!sources.has(id)) errors.push(`${where} cites unknown source ${id}`);
  };
  const bilingual = (v) => Boolean(v?.en && v?.zh);

  const ids = new Set();
  for (const c of data.companies ?? []) {
    const w = `company ${c.id}`;
    if (!c.id || ids.has(c.id)) errors.push(`${w}: id missing or duplicate`);
    ids.add(c.id);
    if (!LAYERS.includes(c.layer)) errors.push(`${w}: unknown layer ${c.layer}`);
    if (![1, 2, 3].includes(c.tier)) errors.push(`${w}: tier must be 1, 2 or 3`);
    if (!LISTINGS.includes(c.listing)) errors.push(`${w}: unknown listing ${c.listing}`);
    if (['listed', 'adr'].includes(c.listing) && !c.ticker) errors.push(`${w}: listed company needs a ticker`);
    const { lat, lon } = c.hq ?? {};
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) errors.push(`${w}: invalid hq coordinates`);
    if (!bilingual(c.name) || !bilingual(c.hq?.city) || !bilingual(c.role)) errors.push(`${w}: needs en and zh names`);
    if (!c.official_domain) errors.push(`${w}: needs official_domain`);
    if (c.source_ids) cite(w, c.source_ids);
  }
  for (const e of data.edges ?? []) {
    const w = `edge ${e.id}`;
    if (!ids.has(e.source) || !ids.has(e.target)) errors.push(`${w}: unknown endpoint`);
    if (e.source === e.target) errors.push(`${w}: self loop`);
    if (!EDGE_TYPES.includes(e.type)) errors.push(`${w}: unknown type ${e.type}`);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(e.as_of ?? '')) errors.push(`${w}: as_of must be YYYY-MM or YYYY-MM-DD`);
    if (!bilingual(e.label)) errors.push(`${w}: needs en and zh label`);
    if (!FACT_STATUS.includes(e.status)) errors.push(`${w}: unknown status ${e.status}`);
    cite(w, e.source_ids);
  }
  for (const [group, list] of Object.entries(data.facts ?? {})) {
    for (const f of list) {
      const w = `fact ${group}/${f.id}`;
      if (!FACT_STATUS.includes(f.status)) errors.push(`${w}: unknown status ${f.status}`);
      if (!bilingual(f.label)) errors.push(`${w}: needs en and zh label`);
      cite(w, f.source_ids);
    }
  }
  return errors;
}
