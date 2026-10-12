// The journal's fixed company list. No prices live here: quotes come from
// /api/quote (Finnhub) and daily candles from /api/history (Twelve Data).
// These symbols are part of the anonymous API allowlist
// (src/lib/arenaPublishedAccess.js), so the page never needs the admin key.
export const JOURNAL_STOCKS = Object.freeze([
  { symbol:'NVDA', nameZh:'英伟达', name:'NVIDIA Corporation', short:'NVIDIA', sector:'AI 算力', sectorEn:'AI compute', color:'#7f9e80', note:'数据中心需求、算力供给与客户集中度。' },
  { symbol:'MSFT', nameZh:'微软', name:'Microsoft Corporation', short:'Microsoft', sector:'软件与云', sectorEn:'Software & cloud', color:'#76a0cf', note:'企业云需求、AI 产品商业化与资本开支。' },
  { symbol:'AVGO', nameZh:'博通', name:'Broadcom Inc.', short:'Broadcom', sector:'定制芯片', sectorEn:'Custom silicon', color:'#c78a82', note:'定制芯片需求、网络互联与客户结构。' },
  { symbol:'MU', nameZh:'美光科技', name:'Micron Technology', short:'Micron Technology', sector:'存储芯片', sectorEn:'Memory chips', color:'#9c85df', note:'HBM 供给、存储周期与毛利率。' },
  { symbol:'TSM', nameZh:'台积电', name:'Taiwan Semiconductor', short:'TSMC', sector:'半导体制造', sectorEn:'Semiconductor foundry', color:'#7f9f82', note:'先进制程、封装产能与资本开支。' },
  { symbol:'VRT', nameZh:'维谛技术', name:'Vertiv Holdings Co.', short:'Vertiv', sector:'电力与冷却', sectorEn:'Power & cooling', color:'#7ea2ce', note:'数据中心电力需求、散热与订单转化。' },
  { symbol:'AAPL', nameZh:'苹果', name:'Apple Inc.', short:'Apple', sector:'消费电子', sectorEn:'Consumer electronics', color:'#bd8d8b', note:'产品需求、服务收入与供应链。' },
  { symbol:'GOOGL', nameZh:'谷歌', name:'Alphabet Inc.', short:'Alphabet', sector:'AI 与互联网', sectorEn:'AI & internet', color:'#7b9e83', note:'搜索业务、云增长与 AI 投入。' },
  { symbol:'AMZN', nameZh:'亚马逊', name:'Amazon.com Inc.', short:'Amazon', sector:'电商与云', sectorEn:'Commerce & cloud', color:'#86a4cb', note:'AWS 增长、零售利润与基础设施投入。' },
  { symbol:'TSLA', nameZh:'特斯拉', name:'Tesla Inc.', short:'Tesla', sector:'电动车', sectorEn:'Electric vehicles', color:'#c98680', note:'交付量、汽车毛利与新产品节奏。' },
  { symbol:'META', nameZh:'Meta', name:'Meta Platforms Inc.', short:'Meta Platforms', sector:'社交与广告', sectorEn:'Social & advertising', color:'#cc938b', note:'广告收入、AI 投入与用户规模。' },
  { symbol:'AMD', nameZh:'超威半导体', name:'Advanced Micro Devices', short:'AMD', sector:'算力芯片', sectorEn:'Compute chips', color:'#8e87c7', note:'数据中心芯片需求、产品迭代与市场份额。' },
]);
export const JOURNAL_SYMBOLS = Object.freeze(JOURNAL_STOCKS.map((stock) => stock.symbol));
export const INITIAL_WATCHLIST = JOURNAL_SYMBOLS.slice(0, 6);
export const searchStocks = (query) => {
  const needle = query.trim().toLowerCase();
  return JOURNAL_STOCKS.filter((stock) => [stock.symbol, stock.name, stock.nameZh].some((text) => text.toLowerCase().includes(needle)));
};
