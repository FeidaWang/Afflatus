import { currentLanguage, escapeHtml as esc } from '../content.js';
import { initSectorsGraph } from '../../lib/sectorsGraphView.js';
import snapshot from './dependency-data.json';
import { resolveDependencies, taskOwners } from './dependency-core.js';

const names = [['Reasoning','推理'],['Code','代码'],['Documents','文档'],['Tool calls','工具调用'],['Verification','验证'],['Human review','人工复核']];
const owners = [['Human','人工'],['Model assistance','模型协助'],['Tools / checks','工具／检查']];
const types = {
 uses_compute:['Compute use','算力使用'], platform_partnership:['Platform partnership','平台合作'],
 chip_codesign:['Chip co-design','芯片联合设计'], systems_integration:['Systems integration','系统集成'],
 memory_storage_supply:['Memory / storage supply','内存／存储供应'], equity_investment:['Equity investment','股权投资'],
 enterprise_model_use:['Enterprise model use','企业模型使用'], memory_platform_support:['Memory platform support','内存平台支持'], model_developer:['Model developer','模型开发主体'],
};
export function mountTaskStory(host) {
 let step='divide', lens='coding', graph=null, data=null, mapping=null, selected=null;
 const t=pair=>pair[currentLanguage()==='zh'?1:0];
 const network=host.querySelector('[data-network]');
 const tasks=[...host.querySelectorAll('[data-task]')];
 host.querySelector('.fc-story-controls').hidden=false;
 const evidence=host.querySelector('[data-dependencies]');
 const renderEvidence=()=>{
  if(!mapping)return;
  const rows=[...mapping.resolved,...mapping.pending].filter(r=>!selected||r.from_entity===selected||r.to_entity===selected);
  const name=id=>data?.ecosystemGraph?.nodes.find(n=>n.id===id)?.label||id;
  evidence.innerHTML=rows.map(r=>`<article data-relationship="${r.id}"><h4>${esc(r.id)} · ${esc(name(r.from_entity))} → ${esc(name(r.to_entity))}</h4><p><b>${esc(t(types[r.relationship_type]))}</b> · ${esc(r.effective_or_disclosed_on)} · ${esc(r.status)}</p><p>${esc(t([r.note,r.note_zh]))}</p><p>${r.missing ? esc(t(['Not mapped: ','未映射：']))+esc(r.missing.join(', ')) : esc(t(['Mapped to exact archive IDs.','已对应档案中的准确节点。']))}</p>${r.source_ids.map(id=>{const s=snapshot.sources.find(s=>s.id===id);return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(id)} ↗</a>`;}).join(' · ')}</article>`).join('');
 };
 function ensureGraph(){
  if(graph||step!=='system'||!mapping?.resolved.length)return;
  graph=initSectorsGraph(host.querySelector('canvas'),{ecosystemGraph:mapping.graph},{
   semanticOnly:true,theme:'paper',lang:currentLanguage,controlHost:host.querySelector('[data-node-controls]'),
   onSelect:node=>{selected=node.id;renderEvidence();},
  });
 }
 function render(){
  host.dataset.step=step;
  host.querySelectorAll('[data-story-step]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.storyStep===step)));
  host.querySelectorAll('[data-step-copy]').forEach(p=>p.hidden=p.dataset.stepCopy!==step);
  const state=taskOwners(step,lens);
  tasks.forEach((el,i)=>{el.style.setProperty('--lane',state[i].owner);el.querySelector('b').textContent=t(names[i]);el.querySelector('small').textContent=t(owners[state[i].owner]);});
  host.querySelector('[data-extra]').hidden=!['chokepoints','system'].includes(step);
  network.hidden=step!=='system';
  host.querySelector('[data-workload-label]').textContent=t(lens==='coding'?['Illustrative workload: a reviewed code change','示意工作负载：经复核的代码修改']:['Illustrative workload: a source-backed research note','示意工作负载：有来源的研究笔记']);
  ensureGraph();
 }
 const onClick=event=>{
  const button=event.target.closest('[data-story-step]');
  if(button){step=button.dataset.storyStep;render();}
  if(event.target.closest('[data-show-all]')){selected=null;graph?.resetFocus();renderEvidence();}
 };
 const onChange=event=>{if(event.target.matches('[data-workload]')){lens=event.target.value;render();}};
 host.addEventListener('click',onClick);host.addEventListener('change',onChange);render();
 return {
  setData(next){data=next;mapping=resolveDependencies(next?.ecosystemGraph,snapshot);host.querySelector('canvas').hidden=!mapping.resolved.length;host.querySelector('[data-network-unavailable]').hidden=!!mapping.resolved.length;renderEvidence();render();},
  setLanguage(){render();renderEvidence();graph?.refreshLanguage();},
  destroy(){graph?.destroy();host.removeEventListener('click',onClick);host.removeEventListener('change',onChange);},
 };
}
