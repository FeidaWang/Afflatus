import {getLocale} from '../../lib/localeStore.js';
import React,{useEffect,useRef,useState} from 'react';
import {MagnifyingGlass,Plus,X,Check,ArrowDown,ArrowUp} from '@phosphor-icons/react';
import {JOURNAL_STOCKS,INITIAL_WATCHLIST,searchStocks} from './journalStocks.js';
import {formatPrice,signed,loadQuote,loadDailyCandles,quoteTime} from './quotes.js';
import {STOCK_RANGES} from './stockChartUtils.js';
import {PriceChart} from './PriceChart.jsx';
import {MarketClock} from './MarketClock.jsx';
import {assessNyseSession} from '../../lib/marketSession.js';

// Must match the route metadata in src/config/siteManifest.js.
export const JOURNAL_TITLES={en:'US stock journal · AFFLATUS',zh:'美股看板 · AFFLATUS'};
const QUOTE_REFRESH_MS=60_000;

const strings={
  zh:{kicker:'WATCHLIST / 自选观察',headline:'把注意力，留给好公司。',lead:'在噪声中，寻找真正创造价值的企业。',mine:'我的自选',add:'添加自选',company:'公司',price:'价格 USD',change:'今日涨跌',focus:'观察焦点',chartNote:'日线 · USD · 数据来源 Twelve Data',notice:'报价来自 Finnhub，日线来自 Twelve Data，可能有延迟。仅供观察，不构成投资建议。',quoteUnavailable:'报价暂时无法获取',modalTitle:'把下一家公司，放进自选。',modalLead:'搜索代码或名称，点击公司加入观察。',modalSearch:'搜索代码或公司，例如 AAPL / 苹果',added:'已在自选',join:'加入',noResults:'没有找到匹配的公司',tryAgain:'试试股票代码、中文或英文名称。',empty:'你的自选列表还空着',emptyLead:'点击上方“添加自选”，开始观察一家公司。'},
  en:{kicker:'WATCHLIST / COMPANY JOURNAL',headline:'Good companies, in focus.',lead:'Less noise. More attention to the companies creating value.',mine:'My watchlist',add:'Add a stock',company:'Company',price:'Price USD',change:'Day change',focus:'Research focus',chartNote:'Daily · USD · Source: Twelve Data',notice:'Quotes from Finnhub and daily candles from Twelve Data; they may be delayed. For observation only, not investment advice.',quoteUnavailable:'Quote unavailable right now',modalTitle:'Your next company, in view.',modalLead:'Search a ticker or company, then add it to your list.',modalSearch:'Search a ticker or company, e.g. AAPL',added:'Watching',join:'Add',noResults:'No matching companies',tryAgain:'Try another ticker or company name.',empty:'Your watchlist is empty',emptyLead:'Use “Add a stock” above to start following a company.'},
};

export function App({researchPanel=null,initialLocale="en"}={}){
  const[locale,setLocale]=useState(()=>{if(typeof document==='undefined')return initialLocale;const fixed=document.documentElement.dataset.afflatusLocale;return fixed==='en'||fixed==='zh'?fixed:getLocale(document.documentElement.lang.startsWith('zh')?'zh':'en');}),[selected,setSelected]=useState(JOURNAL_STOCKS[3]),[period,setPeriod]=useState('M');
  const[watchlist,setWatchlist]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem('afflatus:journal-watchlist:v1'));if(Array.isArray(saved))return [...new Set(saved.filter(sym=>JOURNAL_STOCKS.some(asset=>asset.symbol===sym)))];}catch{}return INITIAL_WATCHLIST;}),[sort,setSort]=useState(null);
  const[modalOpen,setModalOpen]=useState(false),[modalQuery,setModalQuery]=useState(''),[toast,setToast]=useState('');
  // symbol → {status:'loading'|'ok'|'error', quote} and {status, candles}.
  const[quotes,setQuotes]=useState({}),[daily,setDaily]=useState({});
  const quotesRef=useRef(quotes);quotesRef.current=quotes;
  const dialogRef=useRef(null),inputRef=useRef(null),addRef=useRef(null),workspaceRef=useRef(null),dragRef=useRef(false);
  const[chartStyle,setChartStyle]=useState('candles'),[split,setSplit]=useState(()=>{try{return Math.max(40,Math.min(68,Number(localStorage.getItem('afflatus:journal-split:v1'))||54));}catch{return 54;}});
  useEffect(()=>{try{localStorage.setItem('afflatus:journal-watchlist:v1',JSON.stringify(watchlist));}catch{}},[watchlist]);
  useEffect(()=>{try{localStorage.setItem('afflatus:journal-split:v1',String(split));}catch{}},[split]);
  const moveSplit=event=>{const rect=workspaceRef.current.getBoundingClientRect();setSplit(Math.max(40,Math.min(68,(event.clientX-rect.left)/rect.width*100)));};
  const english=locale==='en',t=strings[locale];
  const quoteOf=asset=>quotes[asset.symbol]?.quote||null;
  let watching=watchlist.map(symbol=>JOURNAL_STOCKS.find(asset=>asset.symbol===symbol)).filter(Boolean);
  // Unquoted rows sort last in either direction.
  if(sort)watching=[...watching].sort((a,b)=>{const pa=quoteOf(a)?.dp,pb=quoteOf(b)?.dp;if(pa==null||pb==null)return (pa==null)-(pb==null);return sort==='desc'?pb-pa:pa-pb;});
  const modalResults=searchStocks(modalQuery);

  const fetchQuotes=symbols=>symbols.forEach(symbol=>{
    setQuotes(map=>({...map,[symbol]:{...map[symbol],status:map[symbol]?.quote?'ok':'loading'}}));
    loadQuote(symbol).then(quote=>setQuotes(map=>({...map,[symbol]:{status:'ok',quote}})),()=>setQuotes(map=>({...map,[symbol]:{status:map[symbol]?.quote?'ok':'error',quote:map[symbol]?.quote||null}})));
  });
  const needed=[...new Set([...watchlist,selected.symbol])];
  useEffect(()=>{fetchQuotes(needed.filter(symbol=>!quotesRef.current[symbol]));},[needed.join()]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(!document.hidden&&assessNyseSession(new Date()).regularOpen)fetchQuotes(Object.keys(quotesRef.current));},QUOTE_REFRESH_MS);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const symbol=selected.symbol;if(daily[symbol]?.status==='ok')return;
    setDaily(map=>({...map,[symbol]:{status:'loading',candles:null}}));
    loadDailyCandles(symbol).then(candles=>setDaily(map=>({...map,[symbol]:{status:'ok',candles}})),()=>setDaily(map=>({...map,[symbol]:{status:'error',candles:null}})));
  },[selected.symbol]);

  useEffect(()=>{
    document.documentElement.lang=english?'en':'zh-CN';document.title=JOURNAL_TITLES[locale];
    document.querySelectorAll('#afflatus-header [data-en],.pa-footer [data-en]').forEach(node=>{node.textContent=node.dataset[locale];});
    document.querySelectorAll('#afflatus-header [data-aria-en],.pa-footer [data-aria-en]').forEach(node=>node.setAttribute('aria-label',node.dataset[english?'ariaEn':'ariaZh']));
    document.querySelectorAll('#afflatus-header a[href],.pa-footer a[href]').forEach(a=>{const href=a.getAttribute('href');if(href.startsWith('/')||href.startsWith('https://feida.au/')){const path=href.replace('https://feida.au','').replace(/^\/(en|zh)(?=\/)/,'');a.href=`/${path==='/serial.html'?'zh':locale}${path}`;}});
    const language=document.querySelector('[data-header-language]');language.href=`/${english?'zh':'en'}/arena.html`;language.textContent=english?'中文':'EN';language.setAttribute('aria-label',english?'切换至中文':'Switch to English');
  },[english,locale]);
  useEffect(()=>{const button=document.querySelector('[data-header-language]');const change=event=>{if(['en','zh'].includes(document.documentElement.dataset.afflatusLocale))return;event.preventDefault();setLocale(value=>value==='zh'?'en':'zh');};button.addEventListener('click',change);return()=>button.removeEventListener('click',change);},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(modalOpen){dialogRef.current.showModal();inputRef.current.focus();}else if(dialogRef.current.open)dialogRef.current.close();},[modalOpen]);
  const openAdd=()=>{setModalQuery('');setModalOpen(true);};
  const closeAdd=()=>{setModalOpen(false);requestAnimationFrame(()=>addRef.current?.focus());};
  const addStock=asset=>{if(watchlist.includes(asset.symbol))return;setWatchlist(list=>[...list,asset.symbol]);setToast(english?`${asset.symbol} added to your watchlist`:`${asset.symbol} 已加入自选`);};
  const removeStock=asset=>{setWatchlist(list=>list.filter(symbol=>symbol!==asset.symbol));setToast(english?`${asset.symbol} removed`:`${asset.symbol} 已移出自选`);};
  const symbolInfo=english?`${selected.symbol} · ${selected.sectorEn}`:`${selected.symbol} · ${selected.nameZh} · ${selected.sector}`;
  const selectedQuote=quoteOf(selected),selectedQuoteStatus=quotes[selected.symbol]?.status;
  const changeClass=quote=>quote?.dp==null?'':quote.dp>=0?'positive':'negative';
  const pctText=quote=>quote?.dp==null?'—':`${signed(quote.dp)}%`;
  const selectedDaily=daily[selected.symbol];

  return <div className={`dashboard ${english?'is-english':''}`}>
    <a className="skip-link" href="#main-content">{english?'Skip to chart':'跳至主图表'}</a>
    <main id="main-content" className="main-content"><section className="intro" aria-labelledby="page-title"><div><p className="kicker">{t.kicker}</p><h1 id="page-title">{t.headline}</h1><p className="lead">{t.lead}</p></div><div className="market-status"><MarketClock english={english}/></div></section>
      <section ref={workspaceRef} style={{'--stock-ratio':`${split/(100-split)}fr`,'--stock-share':split/100}} className="workspace" aria-label={english?'Market workspace':'行情工作台'}>
        <section className="detail-panel" aria-labelledby="detail-title"><h2 id="detail-title">{selected.short}</h2><p className="symbol-info">{symbolInfo}</p><div className="detail-quote"><strong>{selectedQuote?formatPrice(selectedQuote.c):'—'}</strong><span className="currency">USD</span><span className={changeClass(selectedQuote)}>{pctText(selectedQuote)}</span></div><p className="quote-time">{selectedQuote?quoteTime(selectedQuote.t,english):selectedQuoteStatus==='error'?t.quoteUnavailable:'\u00a0'}</p>
          <div className="periods" aria-label={english?'Chart period':'图表时间范围'}>{STOCK_RANGES.map(range=><button key={range} className={period===range?'selected':''} aria-pressed={period===range} onClick={()=>setPeriod(range)}>{range}</button>)}</div>
          <div className="chart-style-toggle" role="group" aria-label={english?'Chart style':'图表样式'}>{[['candles',english?'Candles':'烛形图'],['line',english?'Line':'折线图']].map(([style,label])=><button key={style} aria-pressed={chartStyle===style} className={chartStyle===style?'selected':''} onClick={()=>setChartStyle(style)}>{label}</button>)}</div><p className="chart-unit">USD</p><PriceChart key={`${selected.symbol}-${period}`} asset={selected} candles={selectedDaily?.candles||null} status={selectedDaily?.status||'loading'} period={period} chartStyle={chartStyle} english={english} unit="USD"/><p className="chart-note">{t.chartNote}</p>
          <div className="research-note"><h3>{t.focus}</h3><p>{english?'Follow demand, supply constraints and company fundamentals.':selected.note}</p></div>
        </section>
        <div className="workspace-slider" role="separator" tabIndex={0} aria-orientation="vertical" aria-valuemin={40} aria-valuemax={68} aria-valuenow={Math.round(split)} aria-valuetext={english?`Stock ${Math.round(split)}%, watchlist ${100-Math.round(split)}%`:`个股 ${Math.round(split)}%，自选列表 ${100-Math.round(split)}%`} aria-label={english?'Resize stock and watchlist':'左右拖动调整个股与自选列表宽度'} onPointerDown={event=>{if(event.button!==0)return;dragRef.current=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();moveSplit(event);}} onPointerMove={event=>{if(dragRef.current)moveSplit(event);}} onPointerUp={()=>{dragRef.current=false;}} onPointerCancel={()=>{dragRef.current=false;}} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setSplit(event.key==='Home'?40:event.key==='End'?68:Math.max(40,Math.min(68,split+(event.key==='ArrowLeft'?-2:2))));}}}><span aria-hidden="true">⋮</span></div>
        <aside className="watch-panel" aria-labelledby="watch-title"><div className="watch-heading"><h2 id="watch-title">{t.mine}</h2><button ref={addRef} className="primary-button" onClick={openAdd}><Plus size={18} weight="light" aria-hidden="true"/>{t.add}</button></div>
          <div className="table-head"><span>{t.company}</span><span>{t.price}</span><button className="sort-button" onClick={()=>setSort(value=>value==='desc'?'asc':'desc')} aria-label={english?`Sort daily change ${sort==='desc'?'ascending':'descending'}`:`按今日涨跌${sort==='desc'?'升序':'降序'}排列`}>{t.change}{sort==='asc'?<ArrowUp size={15} aria-hidden="true"/>:<ArrowDown size={15} aria-hidden="true"/>}</button></div>
          <div className="watch-rows">{watching.length?watching.map(asset=>{const quote=quoteOf(asset);return <div className={`watch-row ${selected.symbol===asset.symbol?'selected':''}`} key={asset.symbol}><button className="stock-select" onClick={()=>setSelected(asset)} aria-pressed={selected.symbol===asset.symbol} aria-label={`${asset.symbol} ${asset.nameZh}, ${pctText(quote)}`}><span className="stock-name"><b>{asset.symbol}</b><small>{asset.name}</small></span><strong className="stock-price">{quote?formatPrice(quote.c):'—'}</strong><span className={`stock-change ${changeClass(quote)}`}>{pctText(quote)}</span></button><button className="remove-stock" onClick={()=>removeStock(asset)} aria-label={`${english?'Remove':'移除自选'} ${asset.symbol}`}><X size={12} aria-hidden="true"/></button></div>;}):<div className="empty-watch"><h3>{t.empty}</h3><p>{t.emptyLead}</p></div>}</div>
        </aside>
      </section>
      {researchPanel&&researchPanel(locale)}
    </main>
    <footer className="site-footer"><p>{t.notice}</p></footer>
    {toast&&<div className="toast" role="status"><Check size={18} aria-hidden="true"/>{toast}</div>}
    <dialog ref={dialogRef} className="stock-dialog" aria-labelledby="add-title" onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAdd();}}} onCancel={event=>{event.preventDefault();closeAdd();}} onClick={event=>{if(event.target===event.currentTarget)closeAdd();}}><div className="dialog-content"><button className="dialog-close" onClick={closeAdd} aria-label={english?'Close':'关闭'}><X size={23} weight="light" aria-hidden="true"/></button><p className="kicker">AFFLATUS / WATCHLIST</p><h2 id="add-title">{t.modalTitle}</h2><p className="dialog-lead">{t.modalLead}</p><div className="dialog-search"><MagnifyingGlass size={21} weight="light" aria-hidden="true"/><input ref={inputRef} type="search" autoComplete="off" value={modalQuery} onChange={event=>setModalQuery(event.target.value)} placeholder={t.modalSearch} aria-label={t.modalSearch}/></div>
      <div className="dialog-results">{modalResults.length?modalResults.map(asset=><div className="dialog-stock" key={asset.symbol}><span><b>{asset.symbol}</b><small>{english?asset.name:`${asset.nameZh} · ${asset.name}`}</small></span><button disabled={watchlist.includes(asset.symbol)} className={watchlist.includes(asset.symbol)?'is-added':'add-stock'} onClick={()=>addStock(asset)}>{watchlist.includes(asset.symbol)?<Check size={16} aria-hidden="true"/>:<Plus size={16} aria-hidden="true"/>}{watchlist.includes(asset.symbol)?t.added:t.join}</button></div>):<div className="empty-search"><strong>{t.noResults}</strong><p>{t.tryAgain}</p></div>}</div>
    </div></dialog>
  </div>;
}
