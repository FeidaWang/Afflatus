import { createDailyJournal, DAILY_PROMPTS, LIFE_AREAS, localDay, shiftDay, dayIndex } from '../lib/dailyJournal.js';

export function mountDailyExperience() {
  const $ = (id) => document.getElementById(id);
  if (!$('observatoryToday')) return;
  const lang = () => document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const T = (zh, en) => lang() === 'zh' ? zh : en;
  let storage;
  try { storage = localStorage; } catch { storage = {getItem:()=>null, setItem:()=>{throw new Error('Unavailable');}}; }
  const journal = createDailyJournal(storage);
  let currentDay = localDay(), selectedDay = currentDay, noteDay = currentDay, dirty = false;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const views = ['today','self','relationships','journal'];
  // ?fx=almanac routes on the DESIGN.md §5 hashes; either set of hashes reaches the same view.
  const almanac = document.documentElement.getAttribute('data-fx') === 'almanac';
  const almanacHash = {today:'today',self:'you',relationships:'two',journal:'log'};
  const fromHash = (hash) => views.find((view) => almanacHash[view] === hash) || hash;
  const labelDate = (day, options) => new Date(`${day}T12:00:00`).toLocaleDateString(lang()==='zh'?'zh-CN':'en-AU',options);
  const icon = (name) => { const img = document.createElement('img'); img.src=`/assets/labs/icons/${name}.svg`; img.alt=''; img.width=24; img.height=24; return img; };

  function switchView(view, updateHash = true) {
    view = fromHash(view);
    if (!views.includes(view)) view = 'today';
    document.body.dataset.observatoryView = view;
    for (const id of ['observatoryToday','observatoryJournal']) $(id).hidden = id === 'observatoryToday' ? view !== 'today' : view !== 'journal';
    document.querySelector('.more-explorations').open = view === 'relationships';
    document.querySelectorAll('[data-observatory-nav]').forEach((button) => {
      if (button.dataset.observatoryNav === view) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    if (almanac) document.querySelectorAll('.alm-view').forEach((section) => { section.hidden = section.dataset.almView !== almanacHash[view]; });
    const hash = almanac ? almanacHash[view] : view;
    if (updateHash && location.hash !== `#${hash}`) history.pushState(null,'',`#${hash}`);
    if (view === 'journal') renderJournal();
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('[data-observatory-nav]').forEach((button) => button.addEventListener('click',()=>switchView(button.dataset.observatoryNav)));
  window.addEventListener('popstate',()=>switchView(location.hash.slice(1),false));
  window.addEventListener('hashchange',()=>switchView(location.hash.slice(1),false));
  $('chartSkip').addEventListener('click',()=>switchView('self'));
  $('obsChartLink').addEventListener('click',()=>switchView('self'));

  function renderDay() {
    const strip = $('obsDates'); strip.replaceChildren();
    for(let offset=-6;offset<=0;offset++) {
      const day=shiftDay(currentDay,offset), button=document.createElement('button');
      button.type='button'; button.className='obs-date';
      button.setAttribute('aria-label',labelDate(day,{month:'long',day:'numeric',weekday:'long'}));
      button.setAttribute('aria-pressed',String(day===selectedDay));
      const weekday=document.createElement('span');weekday.textContent=labelDate(day,{weekday:'short'}).replace('周','');
      const date=document.createElement('b'); date.textContent=String(Number(day.slice(-2))).padStart(2,'0');button.append(weekday,date);
      button.addEventListener('click',()=>{selectedDay=day;renderDay();});strip.append(button);
    }
    const prompt=DAILY_PROMPTS[((dayIndex(selectedDay)%DAILY_PROMPTS.length)+DAILY_PROMPTS.length)%DAILY_PROMPTS.length];
    $('obsDateLabel').textContent=labelDate(selectedDay,{year:'numeric',month:'long',day:'numeric',weekday:'long'});
    $('almDateline').textContent=labelDate(currentDay,{year:'numeric',month:'long',day:'numeric',weekday:'long'});
    $('obsTitle').textContent=T(prompt[0],prompt[2]);
    if (lang() === 'zh' && prompt[0] === '留一点时间给自己。') $('obsTitle').textContent = '给自己，\n留一点时间。';
    $('obsAction').textContent=T(prompt[1],prompt[3]);
    $('obsTimeZone').textContent=T(`日期按 ${timezone} · 每日短句为原创反思提示`,`Dates use ${timezone} · Original reflection prompts`);
    $('obsDrawStatus').textContent=journal.get(selectedDay).draw != null ? T('已收好','Saved') : T('待开启','Unopened');
    $('obsDrawButton').disabled=selectedDay!==currentDay && journal.get(selectedDay).draw == null;
    $('obsDrawButton').setAttribute('aria-label',T('打开每日一签','Open daily reflection draw'));
  }

  function renderAreas() {
    const list=$('obsAreas');list.replaceChildren();
    for(const area of LIFE_AREAS) {
      const detail=document.createElement('details'), summary=document.createElement('summary');
      summary.textContent=T(area.zh,area.en)+' · '+T(...area.title);
      const p=document.createElement('p');p.textContent=T(...area.action);
      const q=document.createElement('p');q.className='obs-question';q.textContent=T(...area.question);
      const source=document.createElement('small');source.textContent=T('来源：本站原创日常反思；不是命理预测。','Source: original everyday reflection, not a prediction.');
      detail.append(summary,p,q,source);list.append(detail);
    }
  }
  $('obsAreasButton').addEventListener('click',()=>{
    const opening=$('obsAreas').hidden;$('obsAreas').hidden=!opening;
    $('obsAreasButton').setAttribute('aria-expanded',String(opening));
  });
  $('obsSourcesButton').addEventListener('click',()=>{
    const opening=$('obsSources').hidden;$('obsSources').hidden=!opening;
    $('obsSourcesButton').setAttribute('aria-expanded',String(opening));
  });
  const drawDialog=$('drawDialog');
  drawDialog.querySelector('[data-draw-close]').addEventListener('click',()=>drawDialog.close());
  $('obsDrawButton').addEventListener('click',()=>{
    const record=journal.get(selectedDay);
    if(selectedDay!==localDay() && record.draw==null) { renderDay();return; }
    const random=crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
    const result=journal.draw(selectedDay,random,timezone), prompt=DAILY_PROMPTS[result.index];
    $('drawText').textContent=T(prompt[0],prompt[2]);$('drawAction').textContent=T(prompt[1],prompt[3]);
    $('drawDate').textContent=labelDate(selectedDay,{month:'long',day:'numeric'});
    $('drawSaveStatus').textContent=result.persisted ? T('今日的签已保存在本机，刷新不会重抽。','Saved on this device. Reloading will keep this draw.') : T('本次已揭签；浏览器存储不可用，关闭后可能丢失。','Drawn for this visit. Storage is unavailable; this draw may be lost.');
    drawDialog.showModal();renderDay();
  });
  function openNote(day) {
    if(dirty && !saveNote()) return;
    noteDay=day;$('obsNoteText').value=journal.get(day).note||'';dirty=false;
    $('obsNoteDay').textContent=labelDate(day,{year:'numeric',month:'long',day:'numeric'});
    $('obsNoteStatus').textContent='';switchView('journal');$('obsNoteText').focus({preventScroll:true});
  }
  $('obsWriteNote').addEventListener('click',()=>openNote(selectedDay));
  $('drawWriteNote').addEventListener('click',()=>{drawDialog.close();openNote(selectedDay);});
  $('obsNoteText').addEventListener('input',()=>{dirty=true;$('obsNoteStatus').textContent=T('尚未保存','Not yet saved');});
  function saveNote() {
    const saved=journal.saveNote(noteDay,$('obsNoteText').value,timezone);dirty=!saved;
    $('obsNoteStatus').textContent=saved ? T('已保存在这台设备。','Saved on this device.') : T('未能写入浏览器存储。请复制文字，或导出备份。','Could not save to browser storage. Copy your note or export a backup.');
    renderJournal();return saved;
  }
  $('obsSaveNote').addEventListener('click',saveNote);
  window.addEventListener('beforeunload',(event)=>{if(dirty){event.preventDefault();event.returnValue='';}});
  function renderJournal() {
    if(!dirty && !$('obsNoteText').value) { $('obsNoteText').value=journal.get(noteDay).note||''; }
    $('obsNoteDay').textContent=labelDate(noteDay,{year:'numeric',month:'long',day:'numeric'});
    const entries=journal.entries();$('obsJournalEmpty').hidden=entries.length>0;
    const list=$('obsJournalList');list.replaceChildren();
    for(const entry of entries) {
      const button=document.createElement('button');button.type='button';button.className='obs-journal-entry';
      const title=document.createElement('strong');title.textContent=labelDate(entry.day,{month:'long',day:'numeric'});
      const text=document.createElement('span');text.textContent=entry.note||T(DAILY_PROMPTS[entry.draw]?.[0]||'今日记录',DAILY_PROMPTS[entry.draw]?.[2]||'Daily entry');
      button.append(icon('note'),title,text);button.addEventListener('click',()=>openNote(entry.day));list.append(button);
    }
  }
  $('obsExport').addEventListener('click',()=>{
    if(dirty) saveNote();
    const url=URL.createObjectURL(new Blob([journal.export()],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='afflatus-journal-'+localDay()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  let theme='night';try{theme=storage.getItem('afflatus-horo:theme')==='paper'?'paper':'night';}catch{}
  function applyTheme(){document.body.dataset.labTheme=theme;$('obsTheme').setAttribute('aria-pressed',String(theme==='night'));$('obsTheme').setAttribute('aria-label',theme==='night'?T('切换日间模式','Switch to day mode'):T('切换夜间模式','Switch to night mode'));}
  $('obsTheme').addEventListener('click',()=>{theme=theme==='night'?'paper':'night';try{storage.setItem('afflatus-horo:theme',theme);}catch{}applyTheme();});
  function refreshDate(){const now=localDay();if(now!==currentDay){currentDay=now;selectedDay=now;renderDay();}}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDate();});
  let clock=setInterval(refreshDate,60000);
  window.addEventListener('pagehide',()=>{clearInterval(clock);clock=0;});
  window.addEventListener('pageshow',()=>{refreshDate();if(!clock)clock=setInterval(refreshDate,60000);});
  window.addEventListener('afflatus-lang',()=>{renderDay();renderAreas();renderJournal();applyTheme();});
  document.addEventListener('afflatus-chart-updated',()=>{$('obsChartLink').textContent=T('查看我的星图','View my chart');});
  document.addEventListener('afflatus-chart-created',()=>switchView('self'));
  if (almanac) {
    const root=document.documentElement, themeKey='afflatus-horo:almanac-theme', dark=matchMedia('(prefers-color-scheme: dark)');
    const applyAlmanacTheme=()=>$('almTheme').setAttribute('aria-pressed',String(root.getAttribute('data-alm-theme')==='dark'));
    $('almTheme').addEventListener('click',()=>{root.setAttribute('data-alm-theme',root.getAttribute('data-alm-theme')==='dark'?'light':'dark');try{storage.setItem(themeKey,root.getAttribute('data-alm-theme'));}catch{}applyAlmanacTheme();});
    dark.addEventListener('change',(event)=>{let saved=null;try{saved=storage.getItem(themeKey);}catch{}if(!saved){root.setAttribute('data-alm-theme',event.matches?'dark':'light');applyAlmanacTheme();}});
    applyAlmanacTheme();
  }
  applyTheme();renderDay();renderAreas();switchView(location.hash.slice(1)||'today',false);
}
