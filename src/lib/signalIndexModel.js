export const SIGNAL_TOPICS = {
  fed: { en: 'Federal Reserve', zh: '美联储' },
  fiscal: { en: 'Fiscal policy', zh: '财政政策' },
  government: { en: 'Government & AI', zh: '政府与 AI' },
  macro: { en: 'Economic data', zh: '经济数据' },
};

export const SIGNAL_STATUSES = {
  decision: { en: 'Rate decision', zh: '利率决议' },
  record: { en: 'Official record', zh: '官方记录' },
  speech: { en: 'Speaker’s view', zh: '个人观点' },
  action: { en: 'Executive action', zh: '行政措施' },
  implementation: { en: 'Policy implementation', zh: '政策执行' },
  guidance: { en: 'Tax guidance', zh: '税收指引' },
  proposal: { en: 'Legislative proposal', zh: '立法提案' },
  pledge: { en: 'Company pledge', zh: '企业承诺' },
};

export const SIGNAL_INDUSTRIES = {
  compute: { name: { en: 'Semiconductors & compute', zh: '半导体与算力' }, read: { en: 'Equipment costs, tax treatment and domestic capacity.', zh: '设备成本、税收安排与本土产能。' } },
  cloud: { name: { en: 'Cloud & data centers', zh: '云与数据中心' }, read: { en: 'Capital intensity, financing and infrastructure demand.', zh: '资本密集度、融资与基础设施需求。' } },
  power: { name: { en: 'Power & infrastructure', zh: '电力与基础设施' }, read: { en: 'Generation, grid capacity and the cost of expansion.', zh: '发电、电网容量与扩张成本。' } },
  applications: { name: { en: 'Models & applications', zh: '模型与应用' }, read: { en: 'Adoption, productivity and the reorganization of work.', zh: '技术采用、生产率与工作方式重组。' } },
  security: { name: { en: 'Security & payments', zh: '安全与支付' }, read: { en: 'Trusted data, agent permissions and secure procurement.', zh: '可信数据、智能体授权与安全采购。' } },
};

export function filterSignalRecords(events, { topic = 'all', month = 'all', industry = 'all', query = '' } = {}) {
  const terms = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return events.filter(event => {
    if (topic !== 'all' && event.topic !== topic) return false;
    if (month !== 'all' && !event.date.startsWith(month)) return false;
    if (industry !== 'all' && !event.sectors?.includes(industry)) return false;
    const haystack = [event.agency, event.name.en, event.name.zh, event.print.en, event.print.zh,
      event.industryTransmission.en, event.industryTransmission.zh,
      ...(event.sectors || []).flatMap(key => Object.values(SIGNAL_INDUSTRIES[key]?.name || {})),
    ].join(' ').normalize('NFKC').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function signalEvidenceAge(checkedAt, now = new Date()) {
  const checked = Date.parse(`${checkedAt}T00:00:00Z`);
  const age = Math.floor((now.getTime() - checked) / 86400000);
  return !Number.isFinite(age) || age < 0 ? 'unknown' : age > 8 ? 'stale' : 'reviewed';
}

export function nextSignalReleases(schedule, today) {
  return schedule.filter(item => item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}
