import { getLocale, localeSwitchHref } from '../lib/localeStore.js';
import { escapeHtml as esc, localized as local, copy, aria, icon, renderUniverse, renderHero, renderRegion, renderChampions, renderStory, renderSkin, renderGallery, renderDialog } from '../lib/worldsUniverseTemplates.js';

const root = document.getElementById('wu-universe-content');
const detailDialog = document.getElementById('wu-detail');
const artDialog = document.getElementById('wu-lightbox');
const searchDialog = document.getElementById('wu-search');
let lang = getLocale('en');
let data;
let heroIndex = 0;
let regionId = 'ionia';
let skinId = 'star-guardian';
let championsExpanded = false;
let storiesExpanded = false;
let galleryExpanded = false;
let lastFocus;
let returnHash = '#top';
let artIndex = 0;
let activeArtSet = [];
const t = (en,zh) => lang === 'zh' ? zh : en;
const byId = id => document.getElementById(id);
const entityHash = () => /^#(region|champion|story|skin)\/([a-z0-9-]+)$/.exec(location.hash);
const selectedEntity = () => { const m = entityHash(); return m ? {type:m[1],id:m[2]} : null; };

function syncDialogScroll() {
  const open = detailDialog.open || artDialog.open || searchDialog.open;
  document.documentElement.style.overflow = open ? 'hidden' : '';
}
function refreshLanguageLinks() {
  const anchor = document.querySelector('[data-header-language]');
  if (anchor) anchor.href = localeSwitchHref(location,lang==='zh'?'en':'zh');
}
function openDetail(type,id) {
  const markup = renderDialog(data,lang,type,id);
  if (!markup) return;
  if (searchDialog.open) searchDialog.close();
  if (artDialog.open) artDialog.close();
  if (!detailDialog.open) lastFocus = document.activeElement;
  byId('wu-detail-body').innerHTML = markup;
  detailDialog.showModal();
  detailDialog.scrollTop = 0;
  detailDialog.querySelector('[data-close-detail]').focus({preventScroll:true});
  syncDialogScroll();
}
function closeDetail(updateHash = true) {
  if (detailDialog.open) detailDialog.close();
  if (updateHash && entityHash()) history.replaceState(null,'',`${location.pathname}${location.search}${returnHash}`);
  refreshLanguageLinks();
  syncDialogScroll();
  if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true});
}
function followHash() {
  const entity = selectedEntity();
  if (entity) openDetail(entity.type,entity.id);
  else if (detailDialog.open) closeDetail(false);
  refreshLanguageLinks();
}
function selectHero(index) {
  heroIndex = (index + 3) % 3;
  byId('wu-hero-slide').innerHTML = renderHero(data,lang,heroIndex);
  root.querySelectorAll('[data-hero-slide]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.heroSlide)===heroIndex)));
}
function selectRegion(id) {
  if (!data.regions.some(region=>region.id===id)) return;
  regionId = id;
  root.querySelectorAll('[data-region]').forEach(button=>{
    const selected = button.dataset.region===id;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  const feature = byId('wu-region-feature');
  feature.innerHTML = renderRegion(data,lang,id);
  feature.setAttribute('aria-labelledby',`wu-region-tab-${id}`);
}
function selectSkin(id) {
  if (!data.skinUniverses.some(skin=>skin.id===id)) return;
  skinId=id;
  root.querySelectorAll('[data-skin]').forEach(button=>{
    const selected=button.dataset.skin===id;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  const feature=byId('wu-skin-feature');
  feature.innerHTML=renderSkin(data,lang,id);
  feature.setAttribute('aria-labelledby',`wu-skin-tab-${id}`);
}
export function filterChampions() {
  const query=byId('wu-champion-search').value;
  const region=byId('wu-champion-region').value;
  const result=renderChampions(data,lang,{query,region,expanded:championsExpanded});
  byId('wu-champion-grid').innerHTML=result.html;
  byId('wu-champion-count').textContent=t(`${result.shown} / ${result.count} CHAMPIONS`,`${result.shown} / ${result.count} 位英雄`);
  const expand=root.querySelector('[data-champions-expand]');
  expand.hidden=!!query.trim() || region!=='all';
  expand.innerHTML=copy(championsExpanded?'Show selected champions':'View all 18 champions',championsExpanded?'收起英雄档案':'查看全部 18 位英雄',lang);
  expand.setAttribute('aria-expanded',String(championsExpanded));
}
function artFromGallery() {
  return data.artGallery.map(a=>({image:a.url,name:a.name,sourceUrl:a.sourceUrl,credit:{en:'Official concept art · Riot Games',zh:'官方设定原画 · Riot Games'}}));
}
function renderArt() {
  const art=activeArtSet[artIndex];
  byId('wu-lightbox-body').innerHTML=`<div class="wu-lightbox-stage"><img src="${art.image}" alt="${esc(local(art.name,lang))}" decoding="async"><button type="button" class="wu-lightbox-nav" data-art-step="-1" ${aria('Previous artwork','上一幅原画',lang)} ${activeArtSet.length<2?'hidden':''}>${icon('PreviousArrow')}</button><button type="button" class="wu-lightbox-nav" data-art-step="1" ${aria('Next artwork','下一幅原画',lang)} ${activeArtSet.length<2?'hidden':''}>${icon('NextArrow')}</button></div><div class="wu-lightbox-caption"><div><h2 id="wu-lightbox-title">${esc(local(art.name,lang))}</h2><p>${esc(local(art.credit,lang))} · ${artIndex+1} / ${activeArtSet.length}</p></div><a href="${esc(art.sourceUrl)}" target="_blank" rel="noopener noreferrer">${copy('View source','查看来源',lang)}</a></div>`;
}
function openArt(index,set=artFromGallery()) {
  activeArtSet=set;
  artIndex=Math.max(0,Math.min(index,set.length-1));
  renderArt();artDialog.showModal();syncDialogScroll();
}
function shiftArt(direction) {
  const focusedStep=document.activeElement?.dataset?.artStep;
  artIndex=(artIndex+direction+activeArtSet.length)%activeArtSet.length;renderArt();
  if(focusedStep)artDialog.querySelector(`[data-art-step="${focusedStep}"]`)?.focus({preventScroll:true});
}
function showSearch() {
  searchDialog.showModal();syncDialogScroll();byId('wu-global-search').focus();renderSearch(byId('wu-global-search').value);
}
function renderSearch(query='') {
  const normalized=query.trim().toLocaleLowerCase();
  const matches=[];
  const groups=[['region',data.regions,t('Region','区域')],['champion',data.champions,t('Champion','英雄')],['story',data.stories,t('Story','故事')],['skin',data.skinUniverses,t('Skin world','皮肤世界')]];
  for (const [type,collection,label] of groups) for (const item of collection) {
    const name=item.name||item.title;
    const searchable=`${name.en} ${name.zh} ${item.title?.en||''} ${item.title?.zh||''} ${item.summary.en} ${item.summary.zh}`.toLocaleLowerCase();
    if (normalized?searchable.includes(normalized):['ionia','ahri','bilgewater-story','star-guardian'].includes(item.id)) matches.push({type,item,name,label});
  }
  const title=normalized?t(`${matches.length} RESULTS`,`${matches.length} 个结果`):t('START EXPLORING','从这里开始探索');
  byId('wu-search-results').innerHTML=`<h3>${esc(title)}</h3>${matches.length?matches.map(m=>`<a href="#${m.type}/${m.item.id}"><span>${esc(local(m.name,lang))}</span><small>${esc(m.label)}</small></a>`).join(''):`<p class="wu-search-empty">${copy('No results. Try a champion, region or skin world.','没有找到结果。试试英雄名、区域或皮肤系列。',lang)}</p>`}`;
}
export function handleClick(event) {
  const target=event.target.closest('button,a');
  if(!target || !data)return;
  if(target.matches('a[href^="#"]')){
    const hash=target.getAttribute('href');
    const match=/^#(region|champion|story|skin)\/([a-z0-9-]+)$/.exec(hash);
    if(match){
      event.preventDefault();
      if(!entityHash())returnHash=location.hash||`#${({region:'regions',champion:'champions',story:'stories',skin:'skins'})[match[1]]}`;
      if(location.hash===hash)openDetail(match[1],match[2]);else location.hash=hash;
      return;
    }
    if(target.closest('.wu-nav') || target.classList.contains('wu-cta')){
      if(detailDialog.open)closeDetail(false);
      if(searchDialog.open)searchDialog.close();
    }
  }
  if(target.hasAttribute('data-hero-step'))selectHero(heroIndex+Number(target.dataset.heroStep));
  if(target.hasAttribute('data-hero-slide'))selectHero(Number(target.dataset.heroSlide));
  if(target.hasAttribute('data-region'))selectRegion(target.dataset.region);
  if(target.hasAttribute('data-skin'))selectSkin(target.dataset.skin);
  if(target.hasAttribute('data-champions-expand')){championsExpanded=!championsExpanded;filterChampions();}
  if(target.hasAttribute('data-reset-champions')){byId('wu-champion-search').value='';byId('wu-champion-region').value='all';filterChampions();byId('wu-champion-search').focus();}
  if(target.hasAttribute('data-stories-expand')){
    storiesExpanded=!storiesExpanded;
    byId('wu-story-grid').innerHTML=data.stories.slice(0,storiesExpanded?100:3).map((s,i)=>renderStory(s,data,lang,i)).join('');
    target.innerHTML=copy(storiesExpanded?'Show selected stories':'All 8 stories',storiesExpanded?'收起故事':'全部 8 篇故事',lang);
    target.setAttribute('aria-expanded',String(storiesExpanded));
  }
  if(target.hasAttribute('data-gallery-expand')){
    galleryExpanded=!galleryExpanded;byId('wu-gallery').innerHTML=renderGallery(data,lang,galleryExpanded);
    target.innerHTML=copy(galleryExpanded?'Show selected artwork':'All 10 artworks',galleryExpanded?'收起原画':'全部 10 幅原画',lang);
    target.setAttribute('aria-expanded',String(galleryExpanded));
  }
  if(target.hasAttribute('data-art'))openArt(Number(target.dataset.art));
  if(target.hasAttribute('data-skin-art')){
    const skins=data.skinUniverses.map(s=>({image:s.image,name:s.name,sourceUrl:s.sourceUrl,credit:{en:`${s.skinName} · Riot Games`,zh:`${s.name.zh} · Riot Games`}}));
    openArt(data.skinUniverses.findIndex(s=>s.id===target.dataset.skinArt),skins);
  }
  if(target.hasAttribute('data-art-step'))shiftArt(Number(target.dataset.artStep));
  if(target.hasAttribute('data-close-detail'))closeDetail();
  if(target.hasAttribute('data-close-art'))artDialog.close();
  if(target.hasAttribute('data-close-search'))searchDialog.close();
  if(target.hasAttribute('data-search-open'))showSearch();
  if(target.hasAttribute('data-motion')){
    const video=byId('wu-region-feature').querySelector('video');
    if(!video)return;
    if(video.paused){
      video.play().then(()=>{
        video.dataset.playing='true';target.textContent=t('Pause landscape','暂停动态风景');target.setAttribute('aria-label',t('Pause landscape animation','暂停风景动画'));target.setAttribute('aria-pressed','true');
      }).catch(error=>{if(error.name==='AbortError')return;target.textContent=t('Animation unavailable','动态风景暂不可用');target.disabled=true;});
    }else{video.pause();target.textContent=t('Animate landscape','播放动态风景');target.setAttribute('aria-label',t('Play landscape animation','播放风景动画'));target.setAttribute('aria-pressed','false');}
  }
}
export function handleKey(event) {
  if(!data)return;
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!detailDialog.open&&!artDialog.open){event.preventDefault();showSearch();return;}
  if(artDialog.open&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();shiftArt(event.key==='ArrowRight'?1:-1);return;}
  const tab=event.target.closest('[role="tab"]');
  if(tab&&(tab.hasAttribute('data-region')||tab.hasAttribute('data-skin'))){
    const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
    const current=tabs.indexOf(tab);
    let next;
    if(['ArrowRight','ArrowDown'].includes(event.key))next=(current+1)%tabs.length;
    if(['ArrowLeft','ArrowUp'].includes(event.key))next=(current-1+tabs.length)%tabs.length;
    if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
    if(next!==undefined){event.preventDefault();tabs[next].click();tabs[next].focus({preventScroll:true});tabs[next].scrollIntoView({block:'nearest',inline:'nearest'});}
  }
}
export async function initWorldsUniverse() {
  const response=await fetch('/worlds-universe/content.json');
  if(!response.ok)throw new Error(`Content ${response.status}`);
  data=await response.json();
  lang = getLocale('en');
  document.addEventListener('click',handleClick);
  document.addEventListener('keydown',handleKey);
  document.addEventListener('input',event=>{
    if(event.target.id==='wu-champion-search')filterChampions();
    if(event.target.id==='wu-global-search')renderSearch(event.target.value);
  });
  document.addEventListener('change',event=>{if(event.target.id==='wu-champion-region')filterChampions();});
  detailDialog.addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
  for(const dialog of [detailDialog,artDialog,searchDialog]){
    dialog.addEventListener('close',syncDialogScroll);
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const bounds=dialog.getBoundingClientRect();
      if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom){if(dialog===detailDialog)closeDetail();else dialog.close();}
    });
  }
  window.addEventListener('hashchange',followHash);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)root.querySelectorAll('video').forEach(video=>{video.pause();const button=video.closest('.wu-region-feature')?.querySelector('[data-motion]');if(button){button.textContent=t('Animate landscape','播放动态风景');button.setAttribute('aria-label',t('Play landscape animation','播放风景动画'));button.setAttribute('aria-pressed','false');}});});
  window.addEventListener('afflatus-lang',event=>{
    lang=event.detail;storiesExpanded=false;galleryExpanded=false;root.innerHTML=renderUniverse(data,lang);selectHero(heroIndex);selectRegion(regionId);selectSkin(skinId);filterChampions();followHash();
  });
  followHash();
  root.dataset.ready='true';
}
