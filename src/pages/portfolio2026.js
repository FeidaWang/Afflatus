import { portfolioLogo, portfolioLogoName } from './portfolioLogos.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const isZh = document.documentElement.lang.toLowerCase().startsWith('zh');
if (isZh) document.title = '投资组合表现图鉴 · AFFLATUS';
const languageLink = document.querySelector('[data-header-language]');
if (languageLink) {
  const syncLanguageLink = () => { languageLink.href = `/${isZh ? 'en' : 'zh'}/portfolio.html${location.hash}`; };
  syncLanguageLink();
  addEventListener('hashchange', syncLanguageLink);
  languageLink.setAttribute('aria-label', isZh ? 'Switch to English' : 'Switch to Chinese');
  languageLink.textContent = isZh ? 'EN' : '中文';
}
if (isZh) {
  const translations = [
    ['.pa-rail a:nth-child(1) span','方法'], ['.pa-rail a:nth-child(2) span','精选交易'],
    ['.pa-rail a:nth-child(3) span','财年展望'], ['.pa-rail a:nth-child(4) span','产业情景'], ['.pa-rail a:nth-child(5) span','十大观察'],
    ['.pa-hero h1','当判断遇见市场。'],
    ['.pa-hero .pa-lead','以可核对的交易片段，呈现主题判断、入场与退出，以及仍在观察的机会。'],
    ['.pa-actions a:nth-child(1)','查看决策路径 ↓'], ['.pa-actions a:nth-child(2)','探索十个观察标的 ↗'],
    ['.pa-scroll','向下探索 ↓'],
    ['.pa-intro p:nth-child(1)','这份记录中最有代表性的决策有共同路径：识别需求浪潮，在流动性良好的标的上行动，并随价格反馈迅速复核判断。'],
    ['.pa-intro .pa-note','这里仅展示正向精选案例，不代表账户总体收益或净值曲线。'],
    ['.pa-stage-head span:first-child','01 / 2025–26 财年 · 模型辅助复盘'], ['.pa-stage-grid h2','从交易证据到可复核的系统。'],
    ['.pa-scenarios .pa-heading span','三个反复出现的优势'], ['.pa-scenarios .pa-heading h2','同一方法，三种表达。'],
    ['.pa-scenario-grid article:nth-child(1) h3','追踪供需瓶颈'],
    ['.pa-scenario-grid article:nth-child(1) p','存储主题反复出现在记录中，从 Roundhill 存储 ETF 到个别芯片公司。完成交易后再次入场，体现主题的持续复核。'],
    ['.pa-scenario-grid article:nth-child(2) h3','跟随价格确认'],
    ['.pa-scenario-grid article:nth-child(2) p','5 月两笔 AMD 往返交易围绕算力主题快速决策。所选两段买卖价差均为正，持有窗口各不相同。'],
    ['.pa-scenario-grid article:nth-child(3) h3','识别新类别'],
    ['.pa-scenario-grid article:nth-child(3) p','一笔已完成的 SpaceX 交易捕捉到太空主题的快速波动；更广的交易记录还涵盖光通信、生物医药和数字资产基础设施。'],
    ['.pa-explorer .pa-heading span','互动交易探索器'],
    ['.pa-explorer .pa-heading h2','逐笔回看成交。'],
    ['.pa-explorer .pa-heading p','向下滚动或选择一笔成交记录，查看五笔已结交易。均价只代表两端真实成交，并非盘中价格历史。'],
    ['.pa-explorer-control label','选择一笔观察'],
    ['#paExplorePrev','上一笔'], ['#paExploreNext','下一笔'],
    ['.pa-explorer-visual-head span','成交价对比'],
    ['.pa-explorer-visual-foot span:nth-child(1)','买入'],
    ['.pa-explorer-visual-foot span:nth-child(2)','卖出'],
    ['.pa-performance .pa-heading span','02 / 精选交易观察'],
    ['.pa-performance .pa-heading h2','五段可以量化的后续走势。'],
    ['.pa-performance .pa-heading p','根据记录的买入价与卖出价计算毛价差，未计费用、税务或汇率换算。'],
    ['.pa-chart-top h3','精选交易价格变化'],
    ['.pa-switch button:nth-child(1)','价格变化'], ['.pa-switch button:nth-child(2)','持有窗口'],
    ['.pa-performance .pa-method','仅选取正向已结交易。百分比依据所列平均成交价计算，未扣交易成本；不是时间加权收益、账户收益或年化推算。'],
    ['.pa-growth-title b','2026–27 财年 / 组合指数示意'], ['.pa-growth-title span','起点 = 100 · 未扣成本'],
    ['#paGrowthHeading','从同一个起点出发的三条路径。'],
    ['#paGrowthText','向下滚动，观察不同月度复利假设如何拉开财年末指数。'],
    ['.pa-ideas .pa-heading span','05 / 下一阶段研究标的 / 2026 年 9 月'],
    ['.pa-ideas .pa-heading h2','十个研究方向，一张观察地图。'],
    ['.pa-ideas .pa-heading p','十支美股覆盖 AI、半导体、软硬件互联、太空、生物医药和 Web3。选择一项，阅读投资逻辑与下一步关键问题。'],
    ['.pa-ideas .pa-method','研究观察名单，日期为 2026 年 9 月 26 日。展示顺序仅作编辑性编排，并非目标权重或预期收益排名。此为主观研究观点，不构成个性化投资建议。'],
    ['.pa-end h2','判断仍在动态更新。'],
    ['.pa-end p','回到证据，更新假设，继续观察市场接下来会确认什么。'],
    ['.pa-end a','回到开端 ↑'],
    ['.pa-footer nav a:nth-child(1)','AI 产业'], ['.pa-footer nav a:nth-child(2)','市场'], ['.pa-footer nav a:nth-child(3)','关于'],
  ];
  translations.forEach(([selector, value]) => { const el = $(selector); if (el) el.textContent = value; });
}

function createFan(canvas, reverse = false) {
  const context = canvas.getContext('2d');
  let progress = reverse ? 1 : 0;
  function render() {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    const width = bounds.width, height = bounds.height;
    const startX = reverse ? width * .48 : -20;
    const endX = reverse ? width + 25 : width * .93;
    const originY = reverse ? height * .16 : height * .5;
    const visible = 58;
    for (let i = 0; i < visible; i++) {
      const lane = (i / 57 - .5) * 2;
      const color = Math.abs(lane) > .62 ? '#d9aab1' : Math.abs(lane) > .28 ? '#a8b69d' : '#93bdd2';
      context.strokeStyle = color;
      context.lineWidth = .85 + Math.abs(lane) * .35;
      context.globalAlpha = .3 + Math.abs(lane) * .16;
      context.beginPath();
      context.moveTo(startX, originY + lane * 8);
      for (let x = 0; x <= Math.max(1, Math.floor(48 * progress)); x++) {
        const t = x / 48;
        const px = startX + (endX - startX) * t;
        const spread = Math.pow(t, 1.55) * height * .54 * lane;
        const wiggle = (Math.sin(t * 18 + i * 4.2) * 1.7 + Math.sin(t * 67 + i * 1.8) * .7) * t;
        context.lineTo(px, originY + spread + wiggle);
      }
      context.stroke();
      context.globalAlpha = .11;
      context.lineWidth = 2.8;
      context.stroke();
      for (let dot = 0; dot < Math.floor(82 * progress); dot++) {
        const seed = Math.sin((i + 1) * 91.17 + dot * 11.73) * 43758.5453;
        const jitter = seed - Math.floor(seed);
        const t = clamp((dot + jitter * .65) / 82);
        const x = startX + (endX - startX) * t;
        const y = originY + Math.pow(t, 1.55) * height * .54 * lane + Math.sin(t * 18 + i * 4.2) * t * 2;
        context.fillStyle = color;
        context.globalAlpha = .34 + jitter * .5;
        context.save();
        context.translate(x, y);
        context.rotate((jitter - .5) * .7 + lane * .15);
        context.fillRect(0, 0, 3 + t * 3.8, 1.4 + jitter * 1.5);
        context.restore();
      }
    }
    context.globalAlpha = 1;
  }
  const resize = new ResizeObserver(render); resize.observe(canvas);
  render();
  return value => { const next = clamp(value); if (Math.abs(next - progress) > .004) {progress = next; render();} };
}
const heroFan = createFan($('#paFan'));
const endFan = createFan($('#paEndFan'), true);
let heroAnimation = 0;
function playHeroFan() {
  cancelAnimationFrame(heroAnimation);
  if (reduced.matches) { heroFan(1); return; }
  heroFan(0);
  const started = performance.now();
  const tick = now => {
    const t = clamp((now - started) / 2100);
    heroFan(1 - Math.pow(1 - t, 2.4));
    if (t < 1) heroAnimation = requestAnimationFrame(tick);
  };
  heroAnimation = requestAnimationFrame(tick);
}
playHeroFan();
let heroWasAway = false;
addEventListener('pageshow', event => { if (event.persisted && scrollY < innerHeight * .5) playHeroFan(); });

const stages = [
  ['RECONCILE', 'Start with the evidence', 'Astra can inspect the desktop ledger and surface mismatched fills, while code calculates dates, costs, cash flows and position changes.', 'Documented dates remain fixed while the review advances.'],
  ['CHALLENGE', 'Put the thesis under pressure', 'Fable 5.1 independently tests the memory and compute theses, identifies contradictory evidence and asks what would invalidate each trade idea.', 'Independent critique before any new model is trusted.'],
  ['IMPLEMENT', 'Build the measurable strategy', 'Astra turns hypotheses into a feature pipeline and walk-forward tests. Opus 5.5 reviews code, leakage, missing data and edge cases.', 'Reproducible research before simulated orders.'],
  ['GATE', 'Make one bounded judgment', 'Jev receives a typed, compact pre-trade state and returns probabilities for explicit review questions. Deterministic limits can veto the result.', 'No model can bypass the risk engine.'],
  ['DEPLOY', 'Release with a human in control', 'Replay historical data, paper trade, then run a monitored pilot with human sign-off, daily loss limits, audit logs and a kill switch.', 'Live deployment is a separately approved step.'],
];
const zhStages = [
  ['对账','从证据开始','Astra 可在桌面审阅账本并找出不匹配的成交；价格、日期、费用、现金流和仓位变化由确定性代码计算。','分镜推进时，已记录日期保持不变。'],
  ['质询','对投资逻辑提出反证','Fable 5.1 独立检验存储与算力主题，寻找反面证据，并明确什么事实会推翻每笔交易假设。','先独立质询，再信任新模型。'],
  ['实现','构建可测量策略','Astra 把假设转成特征管线和滚动回测；Opus 5.5 审阅代码、信息穿越、缺失数据和边界情况。','模拟下单之前先保证研究可复现。'],
  ['门控','做一项有边界的判断','Jev 读取精简且有类型的交易前状态，对明确的问题输出概率；确定性风险限制可直接否决。','任何模型都不能越过风控引擎。'],
  ['部署','由人掌握发布权','先做历史重放，再模拟盘，最后在人工签核、日亏损限制、审计日志和紧急停止下试运行。','实盘部署需要单独批准。'],
];
const selectedExecutionDates = [
  ['2026-02-12','SNDK entry'], ['2026-03-18','SNDK exit'],
  ['2026-05-04','DRAM entry'], ['2026-05-04','AMD entry'],
  ['2026-05-05','AMD exit'], ['2026-05-06','DRAM exit'],
  ['2026-05-08','AMD entry'], ['2026-05-11','AMD exit'],
  ['2026-06-12','SPCX entry'], ['2026-06-12','SPCX exit'],
];
const calendarHost = $('#paTaskGrid');
const fiscalMonths = Array.from({length:12}, (_, index) => new Date(Date.UTC(index < 6 ? 2025 : 2026, (index + 6) % 12, 1)));
const calendarButtons = [];
fiscalMonths.forEach(month => {
  const column = document.createElement('div');
  column.className = 'pa-month-column';
  const monthTitle = document.createElement('b');
  monthTitle.textContent = month.toLocaleString(isZh ? 'zh-CN' : 'en-AU', {month:'short',timeZone:'UTC'});
  column.append(monthTitle);
  for (let slot = 0; slot < 5; slot++) {
    const first = slot * 7 + 1;
    if (first > new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()+1, 0)).getUTCDate()) break;
    const last = Math.min(first + 6, new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()+1, 0)).getUTCDate());
    const events = selectedExecutionDates.filter(([day]) => {
      const date = new Date(day + 'T00:00:00Z');
      return date.getUTCFullYear() === month.getUTCFullYear() && date.getUTCMonth() === month.getUTCMonth() && date.getUTCDate() >= first && date.getUTCDate() <= last;
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pa-calendar-cell';
    button.dataset.count = String(events.length);
    const period = `${monthTitle.textContent} ${first}–${last}`;
    button.setAttribute('aria-label', `${period}: ${events.length} ${isZh ? '个精选买卖事件' : 'selected entry or exit events'}`);
    button.title = button.getAttribute('aria-label');
    button.addEventListener('click', () => {
      calendarButtons.forEach(cell => cell.setAttribute('aria-pressed', String(cell === button)));
      $('#paCalendarDetail').textContent = events.length
        ? `${period} · ${events.map(([day, label]) => `${day.slice(5)} ${isZh ? label.replace('entry','买入').replace('exit','卖出') : label}`).join(' · ')}`
        : `${period} · ${isZh ? '所展示的五笔交易中无已记录的成交' : 'No execution in the five selected trades'}`;
    });
    column.append(button);
    calendarButtons.push(button);
  }
  calendarHost.append(column);
});
calendarButtons.find(button => Number(button.dataset.count) > 0)?.click();
const eventButtonRanks = new Map(
  calendarButtons.filter(button => Number(button.dataset.count) > 0).map((button, index) => [button, index]),
);
function updateCalendarFill(progress) {
  const eventCount = eventButtonRanks.size;
  calendarButtons.forEach((button, index) => {
    // Empty weeks fill in calendar order; documented events appear across the five review steps.
    const fill = eventButtonRanks.has(button)
      ? clamp(progress * eventCount - eventButtonRanks.get(button))
      : clamp(progress * calendarButtons.length - index);
    button.style.setProperty('--fill', fill.toFixed(3));
  });
}
let currentStage = -1;
function setStage(index) {
  if (index === currentStage) return;
  currentStage = index;
  const [englishName, englishTitle, englishBody, englishCaption] = stages[index];
  const [name, title, body, caption] = isZh ? zhStages[index] : [englishName, englishTitle, englishBody, englishCaption];
  $('#paStep').textContent = `${String(index + 1).padStart(2, '0')} / 05`;
  $('#paStageName').textContent = name;
  $('#paStageTitle').textContent = title;
  $('#paStageBody').textContent = body;
  $('#paStageCaption').textContent = caption;
  $('.pa-sticky').style.setProperty('--stage-index', index);
  if (!reduced.matches) $('#paStageTitle').animate([{opacity:.3,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:350,easing:'ease-out'});
}
setStage(0);

// Gross entry-to-exit moves from the FY 2025-26 transaction records. Never treat these as account returns.
const trades = [
  {ticker:'DRAM', buy:42.50, sell:49.58, start:'04 May', end:'06 May', days:2, theme:'Memory basket', detail:'100 units entered, then exited through six fills on the same day.'},
  {ticker:'AMD', buy:343.13, sell:398.15, start:'04 May', end:'05 May', days:1, theme:'AI compute', detail:'18 units: a one-day compute move with a complete exit.'},
  {ticker:'SPCX', buy:152.33, sell:173.86, start:'12 Jun', end:'12 Jun', days:0, theme:'Space', detail:'30 units bought and sold on the same trading date.'},
  {ticker:'SNDK', buy:641.29, sell:729.53, start:'12 Feb', end:'18 Mar', days:34, theme:'Storage', detail:'Eight units held across a longer storage-sector window.'},
  {ticker:'AMD', buy:415.61, sell:452.60, start:'08 May', end:'11 May', days:3, theme:'AI compute', detail:'A second, separately completed AMD round trip.'},
].map(trade => ({...trade, pct:(trade.sell / trade.buy - 1) * 100}));
const zhTradeText = [
  ['存储主题篮子','100 单位买入后，于同一卖出日期分六笔完成退出。'],
  ['AI 算力','18 单位，一天内完成买入与全部退出。'],
  ['太空','30 单位在同一交易日买入并卖出。'],
  ['存储','8 单位，经历较长的存储主题持有窗口。'],
  ['AI 算力','第二笔独立完成的 AMD 往返交易。'],
];
let exploredTrade = 0;
const explorerVisual = $('.pa-explorer-visual');
explorerVisual.innerHTML = `<div class="pa-explorer-visual-head"><span>${isZh ? '成交档案 / 五笔已结交易' : 'EXECUTION ARCHIVE / FIVE COMPLETED TRADES'}</span><b>${isZh ? '2025–26 财年' : 'FY 2025–26'}</b></div><div class="pa-folder-grid" id="paFolderGrid" role="group" aria-label="${isZh ? '逐笔选择交易' : 'Select a completed trade'}"></div><p class="pa-folder-legend">${isZh ? '每一行是一笔已完成的买入和卖出。选择一行查看成交均价。' : 'Each row is one completed entry and exit. Select a record to inspect its execution prices.'}</p>`;
const folderGrid = $('#paFolderGrid');
trades.forEach((trade, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pa-trade-folder';
  button.dataset.trade = String(index);
  button.innerHTML = `<span class="pa-folder-index">${String(index + 1).padStart(2, '0')}</span><span class="pa-folder-identity">${portfolioLogo(trade.ticker, { decorative: true })}<small>${isZh ? zhTradeText[index][0] : trade.theme}</small></span><span class="pa-folder-dates">${trade.start} <span aria-hidden="true">→</span> ${trade.end}</span><strong>+${trade.pct.toFixed(1)}%</strong>`;
  button.addEventListener('click', () => renderExplorer(index, true));
  folderGrid.append(button);
});
function renderExplorer(index, fromControl = false) {
  exploredTrade = clamp(index, 0, trades.length - 1);
  const trade = trades[exploredTrade];
  $('#paExploreStep').textContent = `${String(exploredTrade + 1).padStart(2, '0')} / 05`;
  $('#paExploreTitle').innerHTML = `${portfolioLogo(trade.ticker)}<span>${isZh ? zhTradeText[exploredTrade][0] : trade.theme}</span>`;
  $('#paExploreBody').textContent = isZh ? zhTradeText[exploredTrade][1] : trade.detail;
  $('#paExploreNumber').textContent = `+${trade.pct.toFixed(1)}%`;
  $('#paExploreRange').value = exploredTrade;
  $('#paExplorePrev').disabled = exploredTrade === 0;
  $('#paExploreNext').disabled = exploredTrade === trades.length - 1;
  $$('.pa-trade-folder').forEach((button, folderIndex) => {
    button.dataset.state = folderIndex < exploredTrade ? 'reviewed' : folderIndex === exploredTrade ? 'current' : 'waiting';
    button.setAttribute('aria-pressed', String(folderIndex === exploredTrade));
    button.setAttribute('aria-label', `${folderIndex + 1}. ${trades[folderIndex].ticker}, ${trades[folderIndex].start} ${isZh ? '至' : 'to'} ${trades[folderIndex].end}, +${trades[folderIndex].pct.toFixed(1)}%`);
  });
  let priceStrip = $('#paExplorerPrices');
  if (!priceStrip) {
    priceStrip = document.createElement('div');
    priceStrip.id = 'paExplorerPrices';
    priceStrip.className = 'pa-explorer-prices';
    $('#paExploreBody').after(priceStrip);
  }
  priceStrip.innerHTML = `<span>${isZh ? '买入均价' : 'AVERAGE ENTRY'}<b>$${trade.buy.toFixed(2)}</b></span><i aria-hidden="true">→</i><span>${isZh ? '卖出均价' : 'AVERAGE EXIT'}<b>$${trade.sell.toFixed(2)}</b></span>`;
  if (fromControl && !reduced.matches) {
    const section = $('.pa-explorer');
    const start = section.getBoundingClientRect().top + scrollY;
    const travel = Math.max(0, section.offsetHeight - innerHeight);
    scrollTo({top:start + travel * exploredTrade / (trades.length - 1),behavior:'smooth'});
  }
}
$('#paExploreRange').addEventListener('input', event => renderExplorer(Number(event.target.value), true));
$('#paExplorePrev').addEventListener('click', () => renderExplorer(exploredTrade - 1, true));
$('#paExploreNext').addEventListener('click', () => renderExplorer(exploredTrade + 1, true));
renderExplorer(0);
let explorerScrollFrame = 0;
addEventListener('scroll', () => {
  if (explorerScrollFrame) return;
  explorerScrollFrame = requestAnimationFrame(() => {
    explorerScrollFrame = 0;
    const section = $('.pa-explorer');
    const bounds = section.getBoundingClientRect();
    if (bounds.bottom <= innerHeight * .5 || bounds.top >= innerHeight * .5) return;
    const travel = Math.max(1, section.offsetHeight - innerHeight);
    const progress = clamp((-bounds.top + innerHeight * .13) / travel);
    const index = Math.min(trades.length - 1, Math.floor(progress * trades.length));
    if (index !== exploredTrade) renderExplorer(index);
  });
}, {passive:true});
function renderChart(view = 'return') {
  const duration = view === 'duration';
  const max = duration ? 34 : 18;
  $('#paTradeChart').replaceChildren(...trades.map((trade, index) => {
    const row = document.createElement('div');
    row.className = 'pa-chart-row';
    const value = duration ? trade.days : trade.pct;
    row.innerHTML = `<b><small>${String(index + 1).padStart(2, '0')}</small>${portfolioLogo(trade.ticker, { decorative: true })}</b><span><i style="--w:${Math.max(1, value / max * 100)}%"></i></span><strong>${duration ? (value === 0 ? (isZh ? '当日' : 'same day') : `${value} ${isZh ? '天' : 'd'}`) : `+${value.toFixed(1)}%`}</strong>`;
    return row;
  }));
  $('#paTradeChart').setAttribute('aria-label', duration ? (isZh ? '五笔精选正向交易的持有窗口' : 'Holding windows for five selected positive trades') : (isZh ? '五笔精选正向交易的毛价差' : 'Gross price changes for five selected positive trades'));
  $$('.pa-switch button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
}
$$('.pa-switch button').forEach(button => button.addEventListener('click', () => renderChart(button.dataset.view)));
$('#paTradeCards').replaceChildren(...trades.map((trade, index) => {
  const card = document.createElement('article');
  card.innerHTML = `<span>${isZh ? zhTradeText[index][0] : trade.theme}</span><h4>${portfolioLogo(trade.ticker)} <strong>+${trade.pct.toFixed(1)}%</strong></h4><p>${trade.start} ${isZh ? '至' : 'to'} ${trade.end} 2026 / $${trade.buy.toFixed(2)} ${isZh ? '至' : 'to'} $${trade.sell.toFixed(2)}</p><small>${isZh ? zhTradeText[index][1] : trade.detail}</small>`;
  return card;
}));
renderChart();

const outlookCases = {
  bear: {rate:-8, color:'#9b626a', en:'A drawdown case: protect capital and review whether the original thesis still holds.', zh:'回撤情景：先保护本金，再检验原有判断是否仍成立。'},
  base: {rate:12, color:'#4e867d', en:'A planning hurdle, contingent on new evidence and risk-adjusted execution.', zh:'作为规划目标，前提是新证据与风险调整后的执行。'},
  bull: {rate:24, color:'#b87857', en:'A stretch case that would require unusually strong opportunities and disciplined sizing.', zh:'高目标情景，需要异常强的机会和严格仓位控制。'},
};
const roughFilter = id => `<defs><filter id="paRough-${id}"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2"/></filter></defs>`;
function renderOutlook(key) {
  const item = outlookCases[key];
  const monthly = (Math.pow(1 + item.rate / 100, 1 / 12) - 1) * 100;
  const finalIndex = 100 + item.rate;
  const x = month => 82 + month * 46;
  const y = value => 345 - (value - 88) * 8;
  const labels = isZh ? {bear:'防守',base:'规划',bull:'进取'} : {bear:'Defensive',base:'Planning',bull:'Stretch'};
  const grid = [90, 100, 110, 120, 130].map(value => `<g><path d="M82 ${y(value)}H634" stroke="#92968c" stroke-opacity="${value === 100 ? '.52' : '.25'}"/><text x="68" y="${y(value)+4}" text-anchor="end" class="pa-path-axis">${value}</text></g>`).join('');
  const quarters = [0, 3, 6, 9, 12].map(month => `<g><path d="M${x(month)} 40V345" stroke="#92968c" stroke-opacity=".22"/><text x="${x(month)}" y="375" text-anchor="middle" class="pa-path-axis">${['JUL','OCT','JAN','APR','JUN'][month/3]}</text></g>`).join('');
  const paths = Object.entries(outlookCases).map(([caseKey, scenario]) => {
    const selected = caseKey === key;
    const points = Array.from({length:13}, (_, month) => `${month ? 'L' : 'M'}${x(month)} ${y(100 * Math.pow(1 + scenario.rate / 100, month / 12)).toFixed(1)}`).join(' ');
    const endY = y(100 + scenario.rate);
    return `<g class="pa-outlook-path ${selected ? 'is-current' : ''}"><path d="${points}" fill="none" stroke="${scenario.color}" stroke-width="${selected ? 4 : 1.8}" stroke-opacity="${selected ? 1 : .44}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="634" cy="${endY}" r="${selected ? 6 : 3}" fill="${scenario.color}"/><text x="655" y="${endY+5}" class="pa-path-end" fill="${scenario.color}" opacity="${selected ? 1 : .65}">${labels[caseKey]} ${100 + scenario.rate}</text></g>`;
  }).join('');
  const plot = $('#paOutlookSvg');
  plot.setAttribute('viewBox', '0 0 760 395');
  plot.innerHTML = `<g aria-hidden="true">${grid}${quarters}</g><circle cx="82" cy="${y(100)}" r="5" fill="#252521"/><text x="82" y="${y(100)-15}" class="pa-path-origin">${isZh ? '共同起点' : 'COMMON START'} · 100</text>${paths}`;
  let pathKey = $('.pa-path-key');
  if (!pathKey) {
    pathKey = document.createElement('div');
    pathKey.className = 'pa-path-key';
    plot.after(pathKey);
  }
  pathKey.innerHTML = Object.entries(outlookCases).map(([caseKey, scenario]) => `<span class="${caseKey === key ? 'is-current' : ''}" style="--path-color:${scenario.color}"><small>${labels[caseKey]}</small><b>${100 + scenario.rate}</b></span>`).join('');
  $('#paOutlookNumber').textContent = `${item.rate > 0 ? '+' : ''}${item.rate}%`;
  $('#paOutlookNumber').style.color = item.color;
  $('#paOutlookSummary').textContent = isZh ? item.zh : item.en;
  $('#paOutlookEnd').textContent = String(finalIndex);
  $('#paOutlookMonthly').textContent = `${monthly > 0 ? '+' : ''}${monthly.toFixed(2)}%`;
  plot.setAttribute('aria-label', isZh ? `三种财年规划路径，当前为${labels[key]}：期初指数 100，期末指数 ${finalIndex}` : `Three fiscal-year planning paths. Selected ${labels[key]} case: opening index 100, closing index ${finalIndex}`);
  $$('[data-case]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.case === key)));
}
$$('[data-case]').forEach(button => button.addEventListener('click', () => renderOutlook(button.dataset.case)));
renderOutlook('base');

const payScenarios = [
  {name:isZh ? '温和情景' : 'Modest scenario', endpoints:[.4,1.1,.7]},
  {name:isZh ? '显著情景' : 'Substantial scenario', endpoints:[-.3,5.9,2.1]},
  {name:isZh ? '极端情景' : 'Extreme scenario', endpoints:[-11.5,33.6,9.7]},
];
const payColors = ['#dda94e','#82afd0','#767872'];
function payCurve(value, series, scenario) {
  const x0 = 36, x1 = 257, y0 = 144, y1 = y0 - value * 2.75;
  const nodes = Array.from({length:18}, (_, i) => {
    const t = i / 17;
    const smooth = Math.pow(t, scenario === 2 ? 2.75 : 2.25);
    const jitter = Math.sin(i * 4.7 + series * 2.3 + scenario) * (t < .9 ? 1.3 : .4);
    return `${i ? 'L' : 'M'}${(x0 + (x1-x0)*t).toFixed(1)} ${(y0 + (y1-y0)*smooth + jitter).toFixed(1)}`;
  }).join(' ');
  const labelY = y1 + (scenario === 2 ? 4 : [19,-12,4][series]);
  return `<path d="${nodes}" fill="none" stroke="${payColors[series]}" stroke-width="4.8" stroke-opacity=".78" stroke-linecap="round" stroke-linejoin="round" filter="url(#paRough-pay-${scenario})" class="pa-pay-line" style="--line-delay:${scenario * 130 + series * 100}ms"/><path d="M257 ${y1.toFixed(1)} L262 ${labelY.toFixed(1)}" fill="none" stroke="${payColors[series]}" stroke-opacity=".5"/><text x="265" y="${labelY}" class="pa-pay-value" fill="${payColors[series]}">${value > 0 ? '+' : ''}${value.toFixed(1)}%</text>`;
}
const payHost = $('#paPayPanels');
payHost.innerHTML = payScenarios.map((scenario,index) => `<article class="pa-pay-panel"><h3>${scenario.name}</h3><svg viewBox="0 0 310 240" role="img" aria-label="${scenario.name}: ${scenario.endpoints.map((v,i) => `${isZh ? ['知识工作者','其他工作者','平均'][i] : ['Knowledge workers','All other workers','Average'][i]} ${v}%`).join(', ')}">${roughFilter(`pay-${index}`)}${[40,90,144,190].map(y => `<path d="M36 ${y}h221" stroke="#969990" stroke-opacity=".46" stroke-width="1"/>`).join('')}<text x="12" y="44" class="pa-pay-axis">40</text><text x="12" y="94" class="pa-pay-axis">20</text><text x="18" y="148" class="pa-pay-axis">0</text><text x="8" y="194" class="pa-pay-axis">−20</text><text x="36" y="225" class="pa-pay-axis">2026</text><text x="257" y="225" text-anchor="end" class="pa-pay-axis">2030</text>${scenario.endpoints.map((value,series) => payCurve(value,series,index)).join('')}</svg></article>`).join('');
const payReveal = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { payHost.classList.add('is-visible'); payReveal.disconnect(); } }, {threshold:.15});
payReveal.observe(payHost);

const sectorCases = {
  bear: {values:[-5,-3,-20], en:'Power constraints, trial delays and weak risk appetite could make all three themes contract.', zh:'电力瓶颈、临床延误与风险偏好下降可能使三个主题同时收缩。'},
  base: {values:[15,8,10], en:'AI infrastructure leads; biomedicine advances unevenly; Web3 grows with adoption but remains cyclical.', zh:'AI 基础设施领跑；生物医药进展不均；Web3 随采用增长但仍有周期性。'},
  bull: {values:[30,18,35], en:'Faster infrastructure delivery, clinical wins and stronger on-chain use produce a broad upside case.', zh:'基建提速、临床成果和更强的链上使用形成全面上行情景。'},
};
const sectorNames = isZh ? ['AI 相关产业','生物医药','Web3'] : ['AI industries','Biomedicine','Web3'];
const sectorColors = ['#79a99c','#8dabcc','#c3a675'];
function sectorTileGrid(color, index) {
  return Array.from({length:30}, (_, i) => `<span style="--tile-delay:${i * 12 + index * 55}ms;--tile-color:${i < 5 ? color : '#d6d7cc'}"></span>`).join('');
}
function renderSectors(key) {
  const item = sectorCases[key];
  $('#paSectorBars').replaceChildren(...item.values.map((value, index) => {
    const row = document.createElement('div');
    row.className = 'pa-sector-row';
    const finalIndex = 100 + value;
    const baseWidth = value >= 0 ? 100 / 135 * 100 : finalIndex / 135 * 100;
    const deltaWidth = Math.abs(value) / 135 * 100;
    row.innerHTML = `<div class="pa-sector-name"><b>${sectorNames[index]}</b><small>${isZh ? '2026 基准' : '2026 BASE'} · 100</small></div><div class="pa-sector-tiles" aria-hidden="true">${sectorTileGrid(sectorColors[index], index)}</div><div class="pa-sector-display"><div class="pa-sector-band" style="--sector-color:${sectorColors[index]};--base-width:${baseWidth}%;--delta-width:${deltaWidth}%"><span class="pa-sector-base"></span><span class="pa-sector-delta ${value < 0 ? 'is-loss' : ''}"></span></div><div class="pa-sector-ticks"><span>${isZh ? '基准 100' : 'BASE 100'}</span><span>${isZh ? '2027 指数' : '2027 INDEX'} <strong>${finalIndex}</strong></span></div></div><strong class="pa-sector-result ${value < 0 ? 'is-loss' : ''}">${value > 0 ? '+' : ''}${value}%</strong>`;
    return row;
  }));
  $('#paSectorNarrative').textContent = isZh ? item.zh : item.en;
  $('#paSectorBars').setAttribute('aria-label', sectorNames.map((name,index) => `${name} ${item.values[index]}%`).join(', '));
  $$('[data-sector-case]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sectorCase === key)));
}
$$('[data-sector-case]').forEach(button => button.addEventListener('click', () => renderSectors(button.dataset.sectorCase)));
renderSectors('base');
if (isZh) {
  const translated = [
    ['.pa-calendar-head span','精选成交频率'], ['.pa-calendar-head strong','2025 年 7 月 — 2026 年 6 月'],
    ['.pa-calendar-note','日历仅覆盖下方五笔精选已结案例。色格统计已记录的买入和卖出事件，不代表经纪商分笔数量；空白周不意味着没有其他交易。'],
    ['.pa-stage-legend span:nth-child(1)','无已展示成交'],
    ['.pa-stage-legend span:nth-child(2)','一个买卖事件'],
    ['.pa-stage-legend span:nth-child(3)','两个及以上买卖事件'],
    ['.pa-workflow .pa-heading span','桌面复盘蓝图'],
    ['.pa-workflow .pa-heading h2','让判断与执行各司其职。'],
    ['.pa-workflow .pa-heading p','为每个模型限定职责。确定性代码负责价格、仓位计算与订单；桌面复盘保留每条可检查的假设、决策和批准记录。'],
    ['.pa-outlook .pa-heading span','2026–27 财年 / 前瞻情景'],
    ['.pa-outlook .pa-heading h2','下一财年的年化增长需要达到什么水平？'],
    ['.pa-outlook .pa-heading p','以澳大利亚财年初的 100 为基准。比较三条情景路径，再选择一条查看财年末指数与对应的月复利要求。'],
    ['.pa-pay-heading span','AI 经济 / 工资分布'],
    ['.pa-pay-heading h3','按职业组划分的工资：相对无 AI 情景的百分比变化'],
    ['.pa-pay-heading p','这组独立的美国 2030 年模型说明收益在劳动者之间可能出现分化；它不参与上方组合目标的计算。'],
    ['.pa-pay-legend span:nth-child(1)','知识工作者'],
    ['.pa-pay-legend span:nth-child(2)','其他工作者'],
    ['.pa-pay-legend span:nth-child(3)','平均'],
    ['.pa-sector-chart-title span','2026 → 2027'],
    ['.pa-sector-chart-title strong','三种可能的活动指数'],
    ['.pa-outlook-eyebrow','组合流向示意'],
    ['.pa-outlook-controls dl div:nth-child(1) dt','期初指数'],
    ['.pa-outlook-controls dl div:nth-child(2) dt','2027 年 6 月指数'],
    ['.pa-outlook-controls dl div:nth-child(3) dt','月复利率'],
    ['.pa-plot-top span:nth-child(1)','2026 年 7 月 → 2027 年 6 月'],
    ['.pa-plot-top span:nth-child(2)','期初价值 / 情景变化'],
    ['.pa-plot-bottom span:nth-child(1)','期初指数 · 100'],
    ['.pa-plot-bottom span:nth-child(2)','财年末指数'],
    ['.pa-sector-outlook .pa-heading span','2027 / 三种产业未来'],
    ['.pa-sector-outlook .pa-heading h2','这些主题可能增长，也可能收缩。'],
    ['.pa-sector-outlook .pa-heading p','切换三种情景。每条色带从 2026 年活动指数 100 出发，展示 2027 年的变化假设，并非股票收益预测。'],
    ['[data-case="bear"]','防守'], ['[data-case="base"]','规划'], ['[data-case="bull"]','进取'],
    ['[data-sector-case="bear"]','承压'], ['[data-sector-case="base"]','基准'], ['[data-sector-case="bull"]','加速'],
  ];
  translated.forEach(([selector,value]) => { const el = $(selector); if (el) el.textContent = value; });
  $('.pa-model-path').innerHTML = 'GPT-6 Astra <span>→</span> Fable 5.1 <span>→</span> Opus 5.5 <span>→</span> Jev <span>→</span> 人工复核';
  const workflowCopy = [
    ['01 / 导入','核对账本','用 Python 导入任务将经纪商 CSV 规范化为本地 SQLite 成交账本。保存 UTC 时间戳、费用、汇率、公司行动及原始文件哈希；先核对分笔成交，再计算盈亏。','产出：不可变交易 ID 与异常清单。'],
    ['02 / ASTRA + FABLE','审阅与反证','Astra 统筹 Vite 桌面复盘界面与研究管线；Fable 独立质询投资标签和前瞻信息泄漏。每次复盘保存提示词、模型版本及证据 ID。','产出：附证据的假设与反方观点。'],
    ['03 / OPUS + JEV','验证门控','Opus 审阅滚动回测与故障路径；Jev 读取精简的 JSON 交易前状态并返回有类型的概率。每个候选都经过格式校验、超时控制和确定性亏损限制。','产出：可重放决策、否决理由与延迟日志。'],
    ['04 / 部署','分阶段发布','将复盘界面打包为签名桌面构建，分别接入只读、模拟盘和实盘适配器。历史重放及模拟盘通过后才晋级；实盘仍需要人工批准、日亏损上限、审计日志和紧急停止。','产出：桌面看板与签核发布清单。'],
  ];
  $$('.pa-workflow-grid article').forEach((card,index) => {
    ['b','h3','p','small'].forEach((tag,part) => { const el = $(tag,card); if (el) el.textContent = workflowCopy[index][part]; });
  });
  $('.pa-workflow .pa-method').innerHTML = 'Jev 是有类型的决策模型，尚无可靠证据证明它能预测市场。模型输出不能当作保证收益的信号。 <a href="https://api.typesafe.ai/docs" target="_blank" rel="noopener noreferrer">Jev API</a> · <a href="https://developers.openai.com/api/docs/models/gpt-6-astra" target="_blank" rel="noopener noreferrer">Astra</a> · <a href="https://www.anthropic.com/claude-fable-and-mythos-5-1" target="_blank" rel="noopener noreferrer">Fable</a> · <a href="https://www.anthropic.com/claude-opus-5-5" target="_blank" rel="noopener noreferrer">Opus</a>';
  $('.pa-pay-source').innerHTML = '来源：<a href="https://www.anthropic.com/institute/econ-scenarios" target="_blank" rel="noopener noreferrer">Anthropic，《变革性 AI 的经济情景》（2026）</a>。所示数值为其 2030 年工资情景，相对于无 AI 的同一经济体。';
  $('.pa-outlook .pa-method').textContent = '防守 −8%、规划 +12%、进取 +24% 均为编辑性规划假设，不能由五笔精选盈利交易推算。这些是未计税费、汇率及现金流的组合指数路径；页面没有声称 2026–27 财年已取得实际收益。';
  $('.pa-sector-outlook .pa-method').innerHTML = '假设日期：2026 年 9 月 26 日。方向参考 <a href="https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary" target="_blank" rel="noopener noreferrer">IEA 的数据中心需求与瓶颈</a>、<a href="https://www.fda.gov/drugs/novel-drug-approvals-fda/novel-drug-approvals-2026" target="_blank" rel="noopener noreferrer">FDA 药物批准清单</a>和 <a href="https://www.chainalysis.com/reports/the-2026-geography-of-cryptocurrency-report/" target="_blank" rel="noopener noreferrer">Chainalysis 采用情况研究</a>。图中的百分比是本页情景输入，并非这些机构发布或认可的预测。';
}

// Visual assignment: Sun plus the traditional nine planets, including Pluto.
const ideas = [
  {planet:'SUN', ticker:'NVDA', name:'NVIDIA', sector:'AI compute', thesis:'The compute and networking platform at the centre of large-scale AI deployments.', question:'Watch data-centre demand, export constraints and customer concentration.'},
  {planet:'MERCURY', ticker:'MSFT', name:'Microsoft', sector:'Software + cloud', thesis:'Azure and Copilot connect enterprise distribution to AI inference demand.', question:'Watch AI monetisation against the cost of new capacity.'},
  {planet:'VENUS', ticker:'TSM', name:'TSMC', sector:'Semiconductor foundry', thesis:'Advanced nodes and packaging sit on the manufacturing path for leading AI chips.', question:'Watch capacity expansion, geography and capital intensity.'},
  {planet:'EARTH', ticker:'AVGO', name:'Broadcom', sector:'Custom silicon + networking', thesis:'Custom accelerators and high-speed networks offer a second route into AI infrastructure.', question:'Watch the concentration of a small set of hyperscale customers.'},
  {planet:'MARS', ticker:'MU', name:'Micron', sector:'HBM + memory', thesis:'High-bandwidth memory links the AI accelerator cycle to a constrained component market.', question:'Watch pricing durability and the next HBM ramp.'},
  {planet:'JUPITER', ticker:'VRT', name:'Vertiv', sector:'Power + cooling', thesis:'More compute requires more data-centre power delivery and thermal management.', question:'Watch order conversion and execution capacity.'},
  {planet:'SATURN', ticker:'RKLB', name:'Rocket Lab', sector:'Space systems', thesis:'Launch plus spacecraft hardware provides exposure to a growing commercial and government space stack.', question:'Watch launch cadence, Neutron milestones and cash use.'},
  {planet:'URANUS', ticker:'LLY', name:'Eli Lilly', sector:'Biomedicine', thesis:'A deep obesity and metabolic pipeline complements a large existing commercial franchise.', question:'Watch supply, reimbursement and trial readouts.'},
  {planet:'NEPTUNE', ticker:'CRSP', name:'CRISPR Therapeutics', sector:'Gene editing', thesis:'CASGEVY gives gene editing a commercial base while the broader pipeline develops.', question:'Watch patient access, treatment throughput and clinical milestones.'},
  {planet:'PLUTO', ticker:'COIN', name:'Coinbase', sector:'Web3 infrastructure', thesis:'Exchange, custody and on-chain services create multiple ways to participate in digital assets.', question:'Watch regulation, trading cycles and recurring revenue quality.'},
];
const zhIdeaText = [
  ['AI 算力','大型 AI 部署中的算力与网络平台核心。','关注数据中心需求、出口限制与客户集中度。'],
  ['软件与云','Azure 与 Copilot 把企业分发能力连接到 AI 推理需求。','关注 AI 变现能否覆盖新增基础设施成本。'],
  ['半导体代工','先进制程与封装是领先 AI 芯片的制造必经环节。','关注扩产、地缘因素与资本开支强度。'],
  ['定制芯片与网络','定制加速器与高速网络是参与 AI 基础设施的另一条路径。','关注少数大型云客户带来的集中度。'],
  ['高带宽存储','高带宽内存把 AI 加速器周期与紧俏元件市场连接起来。','关注价格持续性与新一代 HBM 爬坡。'],
  ['电力与散热','更多算力意味着更多数据中心供电与热管理需求。','关注订单转化率与交付能力。'],
  ['太空系统','发射服务加航天器硬件，覆盖商业与政府太空基础设施。','关注发射频率、Neutron 进度与现金消耗。'],
  ['生物医药','肥胖症与代谢疾病管线结合已有的大型商业化业务。','关注供应、支付覆盖与临床结果。'],
  ['基因编辑','CASGEVY 为基因编辑建立商业化基础，其他管线继续推进。','关注患者可及性、治疗交付速度与临床节点。'],
  ['Web3 基础设施','交易、托管与链上服务构成参与数字资产市场的多条路径。','关注监管、交易周期与经常性收入质量。'],
];
function selectIdea(index) {
  const idea = ideas[index];
  $('#paPlanet').textContent = `${idea.planet} / ${String(index + 1).padStart(2, '0')} ${isZh ? '/ 10' : 'OF 10'}`;
  $('#paIdeaName').textContent = idea.name;
  $('#paIdeaTicker').innerHTML = `${portfolioLogo(idea.ticker, { decorative: true })}<span>${isZh ? zhIdeaText[index][0] : idea.sector}</span>`;
  $('#paIdeaThesis').textContent = isZh ? zhIdeaText[index][1] : idea.thesis;
  $('#paIdeaQuestion').textContent = isZh ? zhIdeaText[index][2] : idea.question;
  $$('.pa-idea-list button').forEach((button, i) => button.setAttribute('aria-pressed', String(index === i)));
}
ideas.forEach((idea, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span class="pa-idea-index">${String(index + 1).padStart(2, '0')}</span><span class="pa-idea-row-name"><b>${idea.name}</b><small>${isZh ? zhIdeaText[index][0] : idea.sector}</small></span>${portfolioLogo(idea.ticker, { decorative: true })}<span class="pa-idea-row-arrow" aria-hidden="true">↗</span>`;
  button.setAttribute('aria-label', `${idea.planet}, ${portfolioLogoName(idea.ticker)}, ${idea.sector}`);
  button.addEventListener('click', () => selectIdea(index));
  $('#paIdeaList').append(button);
});
selectIdea(0);

// The wide paper chart follows the desktop reference's scroll-drawn fan, while
// its values remain explicitly illustrative portfolio indexes, never US GDP.
const growthSvg = $('#paGrowthSvg');
const growthCases = [
  {rate:-8, color:'#82aecd', name:isZh?'防守':'Defensive'},
  {rate:12, color:'#91aa83', name:isZh?'规划':'Planning'},
  {rate:24, color:'#cf8b9a', name:isZh?'进取':'Stretch'},
];
const growthX = t => 88 + t * 1050;
const growthY = value => 610 - (value - 88) * (530 / 36);
const growthPath = (rate, variation = 0) => Array.from({length:61}, (_, index) => {
  const t = index / 60;
  const value = 100 * Math.pow(1 + rate / 100, t) + variation * Math.pow(t, 1.55) * 2.3;
  return `${index ? 'L' : 'M'}${growthX(t).toFixed(1)} ${growthY(value).toFixed(1)}`;
}).join(' ');
const gridLines = [88, 100, 112, 124].map(value => `<g><path d="M88 ${growthY(value)}H1138" stroke="#797c73" stroke-opacity="${value === 100 ? '.76' : '.64'}" stroke-width="${value === 100 ? '1.8' : '1.35'}"/><text x="75" y="${growthY(value)+5}" text-anchor="end">${value}</text></g>`).join('');
const yearLines = Array.from({length:13}, (_, index) => `<path d="M${growthX(index/12)} 80V610" stroke="#777b73" stroke-opacity="${index % 3 === 0 ? '.68' : '.22'}" stroke-width="${index % 3 === 0 ? '1.5' : '.85'}"/>`).join('');
growthSvg.innerHTML = `<rect x="88" y="${growthY(100)-7}" width="1050" height="14" fill="#767a70" fill-opacity=".08"/><g class="pa-growth-guide">${gridLines}${yearLines}</g><rect x="88" y="80" width="1050" height="530" fill="none" stroke="#777b73" stroke-opacity=".7" stroke-width="1.4"/>${growthCases.map((item, caseIndex) => `<g class="pa-growth-case" data-growth-case="${caseIndex}" style="--case-color:${item.color}">${Array.from({length:14}, (_, trace) => `<path class="pa-growth-trace" pathLength="1000" d="${growthPath(item.rate, (trace-6.5)*.19)}"/>`).join('')}<path class="pa-growth-main" pathLength="1000" d="${growthPath(item.rate)}"/><text x="1146" y="${growthY(100*(1+item.rate/100))+5}" class="pa-growth-label">${item.name} · ${100+item.rate}</text></g>`).join('')}`;
const growthCopy = isZh ? [
  ['从同一个起点出发的三条路径。','向下滚动，观察不同月度复利假设如何拉开财年末指数。'],
  ['增长与回撤逐渐分开。','防守 −8%、规划 +12%、进取 +24% 均为规划假设，沿月份复利计算。'],
  ['终点是情景，不是已实现收益。','三条路径分别止于 92、112 与 124；它们不是依据五笔精选交易推算的预测。'],
] : [
  ['Three paths from the same starting point.','Scroll to see how monthly compounding separates the illustrative year-end outcomes.'],
  ['Growth and drawdown diverge.','Defensive −8%, planning +12%, and stretch +24% are assumptions compounded across the months.'],
  ['The endpoints are scenarios.','The paths end at 92, 112, and 124. They are not forecasts derived from five selected winning trades.'],
];
let currentGrowthStage = -1;
function updateGrowthStory() {
  const bounds = $('.pa-growth-scroll').getBoundingClientRect();
  const progress = clamp(-bounds.top / Math.max(1, bounds.height - innerHeight));
  growthSvg.style.setProperty('--draw', reduced.matches ? 1 : progress);
  const stage = Math.min(2, Math.floor(progress * 3));
  if (stage !== currentGrowthStage) {
    currentGrowthStage = stage;
    $('#paGrowthStep').textContent = `${String(stage+1).padStart(2,'0')} / 03`;
    $('#paGrowthHeading').textContent = growthCopy[stage][0];
    $('#paGrowthText').textContent = growthCopy[stage][1];
  }
  $$('.pa-growth-case').forEach((item, index) => item.style.opacity = index <= stage || reduced.matches ? '1' : '.16');
}

let scrollRaf = 0;
function updateScroll() {
  scrollRaf = 0;
  const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  $('#paProgress').style.width = `${clamp(scrollY / total) * 100}%`;
  const story = $('.pa-story').getBoundingClientRect();
  const storyProgress = clamp(-story.top / Math.max(1, story.height - innerHeight));
  updateCalendarFill(storyProgress);
  if (story.top < innerHeight && story.bottom > 0) setStage(Math.min(4, Math.floor(storyProgress * 5)));
  const hero = $('.pa-hero').getBoundingClientRect();
  if (hero.bottom < innerHeight * .35) heroWasAway = true;
  if (heroWasAway && hero.top > -innerHeight * .25) { heroWasAway = false; playHeroFan(); }
  updateGrowthStory();
  const end = $('.pa-end').getBoundingClientRect();
  endFan(clamp((innerHeight - end.top) / (innerHeight + end.height) * 2));
  const sections = ['story','performance','outlook','sectorOutlook','ideas'];
  const active = sections.reduce((result,id,index) => document.getElementById(id).getBoundingClientRect().top < innerHeight * .43 ? index : result,-1);
  $('.pa-rail').classList.toggle('is-dark', active === 4 && $('.pa-ideas').getBoundingClientRect().bottom > innerHeight * .43);
  $$('.pa-rail a').forEach((link,index) => {if(index === active) link.setAttribute('aria-current','step'); else link.removeAttribute('aria-current');});
}
addEventListener('scroll', () => {if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScroll)}, {passive:true});
addEventListener('resize', () => {if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScroll)});
updateScroll();
