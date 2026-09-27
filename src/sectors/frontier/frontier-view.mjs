import { explore } from './explorer-core.mjs';
import { explorerCopy, lensMarkup, distributionMarkup, evidenceGapsMarkup } from './explorer-view.mjs';
import {assertSnapshot,observation,estimateTokenBill} from './frontier-core.mjs';
let instance=0;
const esc=(value)=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=(value)=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
const number=(v,d=0)=>v===null||v===undefined?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v);
const words={
 en:{eyebrow:'AFFLATUS / RESEARCH COMPONENT',title:'One frontier. Many different strengths.',intro:'Compare measured configurations, not brands or slogans. This is a selected public-source snapshot, not a live feed, a global model census or an independent rerun.',date:'Retrieved 27 September 2026 · AA v4.3.2 family · rounded source values',metric:'Comparison dimension',geo:'Developer geography',all:'All selected models',us:'US-based labs',cn:'China-based labs',open:'Open weights only',coverage:'with a reported value in this view',excluded:'Excluded or missing',table:'Source-backed comparison',rank:'Rank within selection',model:'Model / configuration',value:'Reported value',cost:'AA task cost (USD)',source:'Evidence',details:'Configuration dossier',none:'No matching observations. Missing data is not a zero.',plot:'Capability–cost frontier',plotnote:'Horizontal axis: published weighted cost per AA Intelligence Index task (log scale). This stays fixed across dimensions; it is not the cost of the selected individual benchmark. Vertical axis: selected score. The line is the Pareto set within this subset, not a purchase recommendation.',plotfallback:'Use the table below for the equivalent data. On phones, paired bars show the same observations on separate linear score and cost scales. The full table scrolls horizontally.',partial:'Plot coverage',available:'configurations with both coordinates',inspect:'Inspect',unknown:'Not verified',yes:'Yes',no:'No',weight:'Open weights',license:'License',context:'Declared context limit',params:'Total parameters',modalities:'Declared inputs',pricedate:'Reference API prices / USD per million tokens',input:'Input',output:'Output including billed reasoning',cache:'Cache read',bill:'What would these entered tokens cost?',billnote:'Illustrative API bill only. These token counts are editable assumptions, not benchmark usage or completed-task costs.',uncached:'Uncached input tokens',cached:'Cache-read tokens',outtokens:'Billed output tokens',calculate:'Calculate illustrative bill',total:'Illustrative total',noquote:'A required price is unavailable; no free-cache assumption was made.',evidence:'Sources for this selection',notie:'Equal displayed values are not a statistical equivalence result.',pending:'MiniMax M3 is provisional and excluded by default. Unretrieved metrics, latency and Chinese/multimodal quality are not invented.',assumption:'Excludes cache writes, unentered tools, hosting, review, taxes and tier-specific charges.',emptyplot:'Insufficient comparable score/cost observations.',change:'中文',pricewarning:'Reference rates only; verify endpoint, context tier, region and current terms before use.',scope:'Selected snapshot, not a universal ranking',status:'Evidence status',snap:'Source reported; not rerun',provisional:'Source conflict; unranked',missing:'Not retrieved',origin:'Lab origin',scoreunit:'score',units:{index_points:'index points',rating_points:'rating points',percent:'%',USD_per_evaluation_task:'USD / evaluation task'}},
 zh:{eyebrow:'AFFLATUS / 研究组件',title:'同一条前沿，不同的能力长处。',intro:'比较经过标注的模型配置，而不是品牌或口号。这是选定公开来源的快照，并非实时数据、全球模型普查或本站独立复测。',date:'采集于 2026 年 9 月 27 日 · AA v4.3.2 系列 · 保留来源四舍五入精度',metric:'比较维度',geo:'开发者所在地',all:'全部已选模型',us:'美国实验室',cn:'中国实验室',open:'仅看开放权重',coverage:'个配置在本视图有来源数值',excluded:'排除或缺失',table:'有来源的模型比较',rank:'所选范围内排名',model:'模型／配置',value:'来源报告值',cost:'AA 任务成本（美元）',source:'证据',details:'模型配置档案',none:'没有匹配的观测。数据缺失不等于零分。',plot:'按能力维度比较成本前沿',plotnote:'横轴固定为来源公布的 AA 综合评测加权每任务成本（对数），不是当前单项评测的运行成本；纵轴为所选分数。折线仅连接此样本内的 Pareto 前沿，不是购买建议。',plotfallback:'手机端以成对条形图展示同一组观测，分数与成本各用独立线性刻度。下方完整表格可横向滑动。',partial:'图表覆盖',available:'个配置同时有两个坐标',inspect:'查看',unknown:'未核验',yes:'是',no:'否',weight:'开放权重',license:'许可证',context:'声明的上下文容量',params:'总参数量',modalities:'声明的输入模态',pricedate:'参考 API 价格／美元每百万 token',input:'输入',output:'输出（包括计费的推理）',cache:'缓存读取',bill:'输入这些 token，用量账单是多少？',billnote:'仅为示例 API 账单。下面的 token 数是可修改的假设，不是基准用量，也不是成功完成任务的成本。',uncached:'非缓存输入 token',cached:'缓存读取 token',outtokens:'计费输出 token',calculate:'计算示例账单',total:'示例合计',noquote:'必要价格未核验；没有将未知缓存费用当作免费。',evidence:'所选配置的来源',notie:'相同显示分数，不代表统计学上的等效。',pending:'MiniMax M3 因来源快照冲突默认不进入排名。未取得的指标、延迟以及中文／多模态质量不会被编造补齐。',assumption:'不含缓存写入、未填写的工具费用、托管、复核、税费及特殊计费档位。',emptyplot:'可比较的分数与成本数据不足。',change:'English',pricewarning:'仅为参考价；使用前应核对端点、上下文档位、地区及当前条款。',scope:'选定快照，并非通用总榜',status:'证据状态',snap:'来源报告，未独立复测',provisional:'来源冲突，未排名',missing:'尚未取得',origin:'实验室所在地',scoreunit:'分数',units:{index_points:'指数分',rating_points:'评分点',percent:'%',USD_per_evaluation_task:'美元／评测任务'}}
};
/** Mount once. Caller owns fetch, page lifecycle and the shared language event. */
export function mountFrontier(host,data,{language='en',ownLanguageToggle=false}={}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('A real host element is required.');
  assertSnapshot(data);
  const id=`fc-${++instance}`;
  const fallback=host.innerHTML;
  const state={lang:language==='zh'?'zh':'en',metric:'intelligence',geography:'all',openOnly:false,minScore:null,maxCost:null,context:0,lens:'premium',selected:'astra-max',bill:{uncachedInput:1000000,cacheRead:0,output:250000}};
  const sourceMap=new Map(data.sources.map(s=>[s.id,s]));
  let dead=false;
  const text=()=>words[state.lang];
  const model=(mid)=>data.models.find(m=>m.id===mid);
  const sourceLinks=(ids)=>[...new Set(ids)].map(sid=>{const s=sourceMap.get(sid);return s?`<a href="${esc(href(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.id)} · ${esc(s.title)} ↗</a>`:'';}).join('');
  const format=(value,metric)=>`${number(value,metric.id==='cost_task'?2:0)}${metric.unit==='percent'?'%':''}`;
  const result=()=>explore(data,{metric:state.metric,geography:state.geography,openOnly:state.openOnly,minScore:state.minScore,maxCost:state.maxCost,context:state.context});
  function shell() {
    const t=text(),e=explorerCopy[state.lang];host.classList.add('frontier-observatory');host.lang=state.lang==='zh'?'zh-CN':'en';
    host.innerHTML=`<header class="fc-header"><p class="fc-kicker">${t.eyebrow}</p>${ownLanguageToggle?`<button type="button" class="fc-language" data-action="language">${t.change}</button>`:''}<h2>${t.title}</h2><p class="fc-lede">${t.intro}</p><p class="fc-meta">${t.date}</p></header>
      <section class="fc-lenses">${lensMarkup(state.lang,state.lens)}</section><form class="fc-controls" data-role="filters"><label>${t.metric}<select name="metric">${data.metrics.map(m=>`<option value="${esc(m.id)}" ${m.id===state.metric?'selected':''}>${esc(m.label[state.lang])}</option>`).join('')}</select></label><label>${t.geo}<select name="geography"><option value="all">${t.all}</option><option value="US" ${state.geography==='US'?'selected':''}>${t.us}</option><option value="CN" ${state.geography==='CN'?'selected':''}>${t.cn}</option></select></label><label class="fc-check"><input type="checkbox" name="openOnly" ${state.openOnly?'checked':''}>${t.open}</label><label>${e.minimum}<input name="minScore" type="number" step="any" value="${state.minScore??''}" placeholder="${e.unlimited}" ${state.metric==='cost_task'?'disabled':''}></label><label>${e.budget}<input name="maxCost" type="number" min="0" step="any" value="${state.maxCost??''}" placeholder="${e.unlimited}"></label><label>${e.context}<input name="context" type="number" min="0" step="1" value="${state.context}" required></label><p class="fc-plot-note">${e.constraintsNote}</p></form>
      <div class="fc-status" role="status" aria-live="polite"></div>
      <section class="fc-distributions" data-role="distributions"></section><section class="fc-plot-section" aria-label="${t.plot}"><div class="fc-section-title"><h3>${t.plot}</h3><span class="fc-scope">${t.scope}</span></div><p class="fc-plot-note">${t.plotnote}</p><div class="fc-plot" data-role="plot"></div><p class="fc-plot-summary"></p><p class="fc-plot-note">${t.plotfallback}</p></section>
      <section class="fc-board" aria-label="${t.table}"><div class="fc-section-title"><h3>${t.table}</h3><span class="fc-unit"></span></div><div class="fc-table-scroll" tabindex="0" role="region" aria-label="${t.table}"></div><p class="fc-plot-note">${t.notie}</p><details class="fc-exclusions"><summary>${t.excluded}</summary><div></div></details></section>
      <section class="fc-dossier" data-role="dossier" aria-label="${t.details}" aria-live="polite"></section>
      <section class="fc-billing"><div class="fc-section-title"><h3>${t.bill}</h3></div><p class="fc-plot-note">${t.billnote}</p><form data-role="billing" class="fc-bill-form"><label>${t.uncached}<input name="uncachedInput" type="number" min="0" step="1" value="${state.bill.uncachedInput}" required></label><label>${t.cached}<input name="cacheRead" type="number" min="0" step="1" value="${state.bill.cacheRead}" required></label><label>${t.outtokens}<input name="output" type="number" min="0" step="1" value="${state.bill.output}" required></label><button type="submit">${t.calculate}</button></form><output class="fc-bill-result" aria-live="polite"></output><p class="fc-plot-note">${t.assumption}</p></section>
      ${evidenceGapsMarkup(state.lang)}<footer class="fc-footer"><p>${t.pending}</p><a href="${href(sourceMap.get('AA-METHOD').url)}" target="_blank" rel="noopener noreferrer">${state.lang==='zh'?'评测方法与限制':'Evaluation methodology and limitations'} ↗</a></footer>`;
    renderViews();
  }
  function renderViews() {
    const t=text(),r=result(),e=explorerCopy[state.lang];
    host.querySelector('[name=minScore]').disabled=state.metric==='cost_task';
    host.querySelector('[data-role=distributions]').innerHTML=distributionMarkup(r,state.lang,data,state);
    if (!r.ranked.some(x=>x.model.id===state.selected)) state.selected=r.ranked[0]?.model.id??null;
    host.querySelector('.fc-status').textContent=`${r.coverage} / ${r.scopeCount} ${t.coverage} · ${t.excluded}: ${r.excluded.length}`;
    host.querySelector('.fc-unit').textContent=`${r.metric.label[state.lang]} · ${t.units[r.metric.unit]} · ${r.metric.version}`;
    const body=r.ranked.map(row=>{
      const cost=observation(data,row.model.id,'cost_task')?.value;
      return `<tr data-row="${esc(row.model.id)}"><td class="fc-rank">${row.displayTie?'=':''}${row.rank}</td><th scope="row"><button type="button" data-model="${esc(row.model.id)}">${esc(row.model.name)}</button><small>${esc(row.model.configuration)}</small></th><td class="fc-origin" data-origin="${row.model.lab_geography}">${esc(row.model.lab_geography)}</td><td class="fc-value">${format(row.value,r.metric)}</td><td>${number(cost,2)}</td><td><a href="${esc(href(sourceMap.get(row.observation.source_ids[0])?.url))}" target="_blank" rel="noopener noreferrer">${t.source} ↗</a></td></tr>`;
    }).join('');
    host.querySelector('.fc-table-scroll').innerHTML=`<table><thead><tr><th scope="col">${t.rank}</th><th scope="col">${t.model}</th><th scope="col">${t.origin}</th><th scope="col">${t.value}</th><th scope="col">${t.cost}</th><th scope="col">${t.source}</th></tr></thead><tbody>${body||`<tr><td colspan="6">${t.none}</td></tr>`}</tbody></table>`;
    host.querySelector('.fc-exclusions div').innerHTML=r.excluded.map(x=>`<p><b>${esc(x.model.name)}</b> — ${e.reasons[x.reason]??t.missing}</p>`).join('')||'<p>—</p>';
    plot(r.pareto);dossier(state.selected);bill();markSelection();
  }
  function plot(p) {
    const t=text(),quality=state.metric==='cost_task'?'intelligence':state.metric;
    const metric=data.metrics.find(m=>m.id===quality);
    const root=host.querySelector('[data-role="plot"]');
    host.querySelector('.fc-plot-summary').textContent=`${t.partial}: ${p.eligible.length} / ${p.scopeCount} ${t.available} · Pareto: ${p.frontier.map(row=>row.model.name).join(', ')||'—'}`;
    if (!p.eligible.length) {root.innerHTML=`<p>${t.emptyplot}</p>`;return;}
    const W=1000,H=430,L=76,R=42,T=32,B=66;
    const xmin=Math.min(.05,...p.eligible.map(row=>row.cost)),xmax=Math.max(12,...p.eligible.map(row=>row.cost));
    const values=p.eligible.map(x=>x.value);
    const ymin=Math.min(0,...values);
    let ymax=metric.unit==='percent'?100:quality==='intelligence'?60:Math.ceil(Math.max(...values)/10)*10;
    if (ymax<=ymin) ymax=ymin+1;
    const X=v=>L+(Math.log10(v)-Math.log10(xmin))/(Math.log10(xmax)-Math.log10(xmin))*(W-L-R);
    const Y=v=>H-B-(v-ymin)/(ymax-ymin)*(H-T-B);
    const ticks=Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
    const grid=ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="fc-grid"/><text x="${L-14}" y="${Y(v)+5}" text-anchor="end" class="fc-axis-text">${number(v,Number.isInteger(v)?0:1)}</text>`).join('');
    const xticks=[.1,.25,.5,1,2,5,10].map(v=>`<text x="${X(v)}" y="${H-B+28}" text-anchor="middle" class="fc-axis-text">$${v}</text>`).join('');
    const path=p.frontier.map((v,i)=>`${i?'L':'M'} ${X(v.cost)} ${Y(v.value)}`).join(' ');
    const points=p.eligible.map(v=>`<g class="fc-point" data-origin="${v.model.lab_geography}" data-model="${esc(v.model.id)}" tabindex="0" role="button" aria-label="${esc(v.model.name+' / '+v.model.configuration+' / '+v.value+' / $'+v.cost)}"><circle class="fc-hit" cx="${X(v.cost)}" cy="${Y(v.value)}" r="16"/><circle class="fc-dot" cx="${X(v.cost)}" cy="${Y(v.value)}" r="7"/><ellipse class="fc-ink-ring" cx="${X(v.cost)}" cy="${Y(v.value)}" rx="8.5" ry="7.5" transform="rotate(-12 ${X(v.cost)} ${Y(v.value)})"/><text class="fc-point-label" x="${X(v.cost)}" y="${Y(v.value)<60?Y(v.value)+25:Y(v.value)-18}" text-anchor="middle">${esc(v.model.name)} · ${format(v.value,metric)}</text><title>${esc(v.model.name)} · ${format(v.value,metric)} · $${number(v.cost,2)}</title></g>`).join('');
    root.innerHTML=`<svg class="fc-desktop-plot" viewBox="0 0 ${W} ${H}" aria-labelledby="${id}-plot-title ${id}-plot-desc" role="group"><title id="${id}-plot-title">${esc(metric.label[state.lang])} / ${t.cost}</title><desc id="${id}-plot-desc">${t.plotnote} ${t.plotfallback}</desc>${grid}<line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}" class="fc-axis"/>${xticks}<text x="${L}" y="16" class="fc-axis-label">${esc(metric.label[state.lang])} (${esc(t.units[metric.unit])})</text><text x="${W-R}" y="${H-10}" text-anchor="end" class="fc-axis-label">${t.cost} · log</text><path d="${path}" class="fc-frontier-path"/>${points}</svg><div class="fc-chart-legend"><span data-origin="US">US · ${t.us}</span><span data-origin="CN">CN · ${t.cn}</span><span class="fc-pareto-legend">Pareto · ${t.scope}</span></div>`;
    const maxCost=Math.max(...p.eligible.map(row=>row.cost));
    const scaleNote=state.lang==='zh'
      ? `独立线性刻度：分数 ${ymin}–${ymax}；成本 $0–$${number(maxCost,2)}。条长仅在同一列内比较。`
      : `Separate linear scales: score ${ymin}–${ymax}; cost $0–$${number(maxCost,2)}. Compare bar lengths within each column.`;
    root.insertAdjacentHTML('beforeend', `<div class="fc-mobile-plot"><p class="fc-plot-note">${scaleNote}</p>${p.eligible.map(v=>`<button type="button" class="fc-mobile-point" data-model="${esc(v.model.id)}" data-origin="${v.model.lab_geography}"><span class="fc-mobile-name">${esc(v.model.name)}<small>${v.model.lab_geography} · ${esc(v.model.configuration)}</small></span><span class="fc-mobile-pair"><span><small>${esc(metric.label[state.lang])}</small><i aria-hidden="true"><b style="width:${(v.value-ymin)/(ymax-ymin)*100}%"></b></i><strong>${format(v.value,metric)}</strong></span><span><small>${t.cost}</small><i aria-hidden="true"><b style="width:${v.cost/maxCost*100}%"></b></i><strong>$${number(v.cost,2)}</strong></span></span></button>`).join('')}</div>`);
  }
  function dossier(mid) {
    const t=text(),m=model(mid),root=host.querySelector('[data-role="dossier"]');
    if (!m) {root.innerHTML=`<h3>${t.details}</h3><p>${t.none}</p>`;return;}
    const o=observation(data,m.id,state.metric);
    const ids=[...m.source_ids,...(o?.source_ids??[]),...(observation(data,m.id,'cost_task')?.source_ids??[])];
    root.innerHTML=`<div class="fc-dossier-main"><p class="fc-kicker">${t.details}</p><h3>${esc(m.name)}</h3><p class="fc-configuration">${esc(m.configuration)}</p><dl><div><dt>${t.origin}</dt><dd>${esc(m.lab)} · ${m.lab_geography}</dd></div><div><dt>${t.weight}</dt><dd>${m.open_weights===null?t.unknown:m.open_weights?t.yes:t.no}</dd></div><div><dt>${t.license}</dt><dd>${esc(m.license||t.unknown)}</dd></div><div><dt>${t.context}</dt><dd>${m.context_tokens?number(m.context_tokens):t.unknown}</dd></div><div><dt>${t.params}</dt><dd>${m.total_parameters_b===null?t.unknown:number(m.total_parameters_b)+' B'}</dd></div><div><dt>${t.status}</dt><dd>${m.status==='provisional_conflict'?t.provisional:t.snap}</dd></div></dl>${m.note?`<p class="fc-note">${esc(state.lang==='zh'?(m.note_zh||m.note):m.note)}</p>`:''}</div><div class="fc-dossier-aside"><h4>${t.pricedate}</h4><p>${t.input}: <b>$${number(m.prices.input,3)}</b><br>${t.output}: <b>$${number(m.prices.output,3)}</b><br>${t.cache}: <b>${m.prices.cache_read===null?t.unknown:'$'+number(m.prices.cache_read,4)}</b></p><p class="fc-plot-note">${t.pricewarning}</p><details><summary>${t.evidence}</summary><div class="fc-source-links">${sourceLinks(ids)}</div></details></div>`;
  }
  function markSelection() {
    host.querySelectorAll('[data-model]').forEach(el=>{el.classList.toggle('is-selected',el.getAttribute('data-model')===state.selected);el.setAttribute('aria-pressed',String(el.getAttribute('data-model')===state.selected));});
    host.querySelectorAll('[data-row]').forEach(el=>el.classList.toggle('is-selected',el.getAttribute('data-row')===state.selected));
  }
  function bill() {
    const t=text(),m=model(state.selected),out=host.querySelector('.fc-bill-result');
    if (!m) {out.textContent=t.none;return;}
    try {const b=estimateTokenBill(m.prices,state.bill);out.textContent=`${m.name} · ${t.total}: $${number(b.total,4)} USD · ${t.input}: $${number(estimateTokenBill(m.prices,{uncachedInput:state.bill.uncachedInput}).total,4)} + ${t.cache}: $${number(estimateTokenBill(m.prices,{cacheRead:state.bill.cacheRead}).total,4)} + ${t.output}: $${number(estimateTokenBill(m.prices,{output:state.bill.output}).total,4)} · ${m.prices.as_of}`;}
    catch {out.textContent=t.noquote;}
  }
  function pick(mid) {
    if (!model(mid)) return;state.selected=mid;dossier(mid);markSelection();bill();
  }
  function click(event) {
    const el=event.target instanceof Element?event.target.closest('[data-model],[data-action],[data-lens]'):null;
    if (!el||!host.contains(el)) return;
    if (el.hasAttribute('data-lens')) {state.lens=el.dataset.lens;host.querySelectorAll('[data-lens]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lens===state.lens)));host.querySelector('[data-lens-explanation]').innerHTML=lensMarkup(state.lang,state.lens,true);return;}
    if (el.getAttribute('data-action')==='language') {state.lang=state.lang==='en'?'zh':'en';shell();return;}
    if (el.hasAttribute('data-model')) pick(el.getAttribute('data-model'));
  }
  function keydown(event) {
    const el=event.target instanceof Element?event.target.closest('.fc-point[data-model]'):null;
    if (el&&['Enter',' '].includes(event.key)) {event.preventDefault();pick(el.getAttribute('data-model'));}
  }
  function focus(event) {
    const el=event.target instanceof Element?event.target.closest('.fc-point[data-model]'):null;
    if (el) pick(el.getAttribute('data-model'));
  }
  function change(event) {
    const form=event.target instanceof Element?event.target.closest('[data-role="filters"]'):null;
    if (!form) return;
    if (!form.reportValidity()) return;
    const values=new FormData(form);state.metric=String(values.get('metric'));state.geography=String(values.get('geography'));state.openOnly=values.has('openOnly');
    for (const key of ['minScore','maxCost']) state[key]=values.get(key)===null||String(values.get(key)).trim()===''?null:Number(values.get(key));
    state.context=Number(values.get('context'));renderViews();
  }
  function submit(event) {
    if (!(event.target instanceof HTMLFormElement)||!host.contains(event.target))return;
    event.preventDefault();
    if(event.target.dataset.role!=='billing')return;
    const values=new FormData(event.target);
    for (const k of ['uncachedInput','cacheRead','output']) state.bill[k]=Number(values.get(k));
    bill();
  }
  host.addEventListener('click',click);host.addEventListener('keydown',keydown);host.addEventListener('focusin',focus);host.addEventListener('change',change);host.addEventListener('submit',submit);
  shell();
  return {
    setLanguage(lang){if(dead)return;state.lang=String(lang).startsWith('zh')?'zh':'en';shell();},
    getState(){return structuredClone(state);},
    destroy(){if(dead)return;dead=true;host.removeEventListener('click',click);host.removeEventListener('keydown',keydown);host.removeEventListener('focusin',focus);host.removeEventListener('change',change);host.removeEventListener('submit',submit);host.innerHTML=fallback;host.classList.remove('frontier-observatory');}
  };
}
