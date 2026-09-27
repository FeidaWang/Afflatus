// Local copies keep the research and trade views independent of third-party image hosts.
const LOGOS = {
  DRAM: ['Roundhill Investments', '/assets/portfolio/logos/roundhill.svg', 'mark'],
  AMD: ['AMD', '/assets/portfolio/logos/amd.svg', 'wide'],
  SPCX: ['SpaceX', '/assets/portfolio/logos/spacex.svg', 'wide'],
  SNDK: ['Sandisk', '/assets/portfolio/logos/sandisk.svg', 'wide'],
  NVDA: ['NVIDIA', '/assets/portfolio/logos/nvidia.svg', 'wide'],
  MSFT: ['Microsoft', '/assets/portfolio/logos/microsoft.svg', 'wide'],
  TSM: ['TSMC', '/assets/sectors/logos/tsmc.svg', 'wide'],
  AVGO: ['Broadcom', '/assets/portfolio/logos/broadcom.svg', 'wide'],
  MU: ['Micron', '/assets/sectors/logos/micron.svg', 'wide'],
  VRT: ['Vertiv', '/assets/portfolio/logos/vertiv.svg', 'wide'],
  RKLB: ['Rocket Lab', '/assets/portfolio/logos/rocket-lab.svg', 'wide'],
  LLY: ['Eli Lilly', '/assets/portfolio/logos/lilly.svg', 'wide'],
  CRSP: ['CRISPR Therapeutics', '/assets/portfolio/logos/crispr.svg', 'mark'],
  COIN: ['Coinbase', '/assets/portfolio/logos/coinbase.svg', 'wide'],
};

export function portfolioLogo(symbol, { decorative = false } = {}) {
  const [name, src, shape] = LOGOS[symbol] || [];
  if (!src) return `<span class="pa-logo-fallback">${symbol}</span>`;
  return `<img class="pa-brand-logo pa-brand-logo--${shape}" data-brand="${symbol}" src="${src}" alt="${decorative ? '' : `${name} logo`}" width="124" height="32" decoding="async">`;
}

export function portfolioLogoName(symbol) {
  return LOGOS[symbol]?.[0] || symbol;
}
