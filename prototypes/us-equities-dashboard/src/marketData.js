// Fictional, non-live quotes for the design prototype. No market API.
export const indices = [
  { symbol:'SPX', zh:'标普 500', name:'S&P 500', price:4376.95, change:53.71, pct:1.24, color:'#8e7ed5', seed:17, note:'观察指数走势与市场整体宽度。' },
  { symbol:'IXIC', zh:'纳斯达克', name:'Nasdaq Composite', price:13689.57, change:210.32, pct:1.56, color:'#7b9ece', seed:29, note:'观察科技板块与成长股表现。' },
  { symbol:'DJI', zh:'道琼斯', name:'Dow Jones', price:33507.50, change:289.41, pct:0.87, color:'#7d9d80', seed:43, note:'观察大型蓝筹企业的整体表现。' },
];
export const stocks = [
  { symbol:'NVDA', zh:'英伟达', name:'NVIDIA Corporation', short:'NVIDIA', sector:'AI 算力', price:183.24, change:4.61, pct:2.58, color:'#7f9e80', seed:31, note:'数据中心需求、算力供给与客户集中度。' },
  { symbol:'MSFT', zh:'微软', name:'Microsoft Corporation', short:'Microsoft', sector:'软件与云', price:517.36, change:6.72, pct:1.32, color:'#76a0cf', seed:37, note:'企业云需求、AI 产品商业化与资本开支。' },
  { symbol:'AVGO', zh:'博通', name:'Broadcom Inc.', short:'Broadcom', sector:'定制芯片', price:322.08, change:4.95, pct:1.56, color:'#c78a82', seed:41, note:'定制芯片需求、网络互联与客户结构。' },
  { symbol:'MU', zh:'美光科技', name:'Micron Technology', short:'Micron Technology', sector:'存储芯片', price:176.28, change:5.84, pct:3.43, color:'#9c85df', seed:47, note:'HBM 供给、存储周期与毛利率。' },
  { symbol:'TSM', zh:'台积电', name:'Taiwan Semiconductor', short:'TSMC', sector:'半导体制造', price:311.06, change:6.21, pct:2.04, color:'#7f9f82', seed:53, note:'先进制程、封装产能与资本开支。' },
  { symbol:'VRT', zh:'维谛技术', name:'Vertiv Holdings Co.', short:'Vertiv', sector:'电力与冷却', price:142.17, change:-1.00, pct:-0.70, color:'#7ea2ce', seed:59, note:'数据中心电力需求、散热与订单转化。' },
  { symbol:'AAPL', zh:'苹果', name:'Apple Inc.', short:'Apple', sector:'消费电子', price:254.32, change:-1.07, pct:-0.42, color:'#bd8d8b', seed:61, note:'产品需求、服务收入与供应链。' },
  { symbol:'GOOGL', zh:'谷歌', name:'Alphabet Inc.', short:'Alphabet', sector:'AI 与互联网', price:246.75, change:2.08, pct:0.85, color:'#7b9e83', seed:67, note:'搜索业务、云增长与 AI 投入。' },
  { symbol:'AMZN', zh:'亚马逊', name:'Amazon.com Inc.', short:'Amazon', sector:'电商与云', price:230.82, change:1.74, pct:0.76, color:'#86a4cb', seed:71, note:'AWS 增长、零售利润与基础设施投入。' },
  { symbol:'TSLA', zh:'特斯拉', name:'Tesla Inc.', short:'Tesla', sector:'电动车', price:438.20, change:-4.96, pct:-1.12, color:'#c98680', seed:73, note:'交付量、汽车毛利与新产品节奏。' },
  { symbol:'META', zh:'Meta', name:'Meta Platforms Inc.', short:'Meta Platforms', sector:'社交与广告', price:742.13, change:-4.78, pct:-0.64, color:'#cc938b', seed:79, note:'广告收入、AI 投入与用户规模。' },
  { symbol:'AMD', zh:'超威半导体', name:'Advanced Micro Devices', short:'AMD', sector:'算力芯片', price:192.64, change:3.21, pct:1.69, color:'#8e87c7', seed:83, note:'数据中心芯片需求、产品迭代与市场份额。' },
];
export const allAssets = [...indices,...stocks];
export const initialWatchlist = stocks.slice(0,6).map(asset => asset.symbol);
export const formatPrice = value => value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export const signed = value => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(2)}`;
export const searchAssets = query => allAssets.filter(asset => [asset.symbol,asset.name,asset.zh].some(text => text.toLowerCase().includes(query.trim().toLowerCase())));

export function makeSeries(asset,period='1M') {
  let seed = asset.seed + {'1D':0,'1W':11,'1M':101,'1Y':503}[period];
  const random = () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  const end=asset.price;
  const ratio=period==='1D' ? 1/(1+asset.pct/100) : {'1W':asset.pct>=0?.93:1.04,'1M':asset.pct>=0?.74:1.18,'1Y':asset.pct>=0?.52:1.36}[period];
  const start=end*ratio,range=end-start;
  return Array.from({length:121},(_,i)=> {
    const t=i/120;
    const noise=Math.sin(t*31+asset.seed)*Math.abs(range)*.024+(random()-.5)*Math.abs(range)*.055;
    return i===0?start:i===120?end:start+range*(.25*t+.75*Math.pow(t,1.16))+noise;
  });
}
export function pointLabel(index,period,english=false) {
  if(period==='1D') { const minutes=570+Math.round(index/120*390); return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')} ET`; }
  const days={'1W':6,'1M':28,'1Y':365}[period];
  const date=new Date(Date.UTC(2026,9,2-Math.round((1-index/120)*days)));
  return new Intl.DateTimeFormat(english?'en-US':'zh-CN',{month:'short',day:'numeric',timeZone:'UTC'}).format(date);
}
