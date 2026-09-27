import { currentLanguage, escapeHtml as esc } from './content.js';
import { createDetailController } from './detailController.js';

const stages = [
  { id: 'apps', en: 'Apps', zh: '应用', verb: ['Ask', '提出问题'], text: ['The interface turns your question into a request and presents the response. The archive includes assistants, office tools and consumer platforms.', '应用把你的问题变成请求，再把回答呈现出来。现有档案涵盖助手、办公工具与消费平台。'], ids: ['openai', 'microsoft', 'tencent', 'apple'] },
  { id: 'models', en: 'Models', zh: '模型', verb: ['Generate', '生成回答'], text: ['Models generate the response. Compare the archived products and their sources before drawing conclusions about capability or cost.', '模型负责生成回答。判断能力与成本之前，先查看档案中的产品说明和来源。'], ids: ['anthropic', 'openai', 'meta', 'zhipu', 'alibaba', 'moonshot', 'google'] },
  { id: 'chips', en: 'Chips', zh: '芯片', verb: ['Compute', '执行计算'], text: ['Accelerators execute computation; foundries manufacture the chips. These are different roles within the same computing layer.', '加速器执行计算，晶圆代工厂制造芯片。这是计算环节中的不同分工。'], ids: ['nvidia', 'huawei', 'broadcom', 'tsmc'] },
  { id: 'memory', en: 'Memory & networks', zh: '内存与网络', verb: ['Move data', '传递数据'], text: ['Memory holds data close to computation. Networks move it between processors and systems. The archive separates memory products from network platforms.', '内存为计算提供就近的数据，网络在处理器与系统之间传递数据。档案分别列出存储产品和网络平台。'], ids: ['micron', 'skhynix', 'cxmt', 'broadcom', 'nvidia'] },
  { id: 'power', en: 'Power', zh: '电力', verb: ['Keep running', '持续运行'], text: ['Power supports the physical infrastructure. This graph archive does not list power suppliers; no company or contractual link is inferred here.', '电力支撑物理基础设施。现有图谱档案未列出电力供应商，因此这里不补写公司或推断合作关系。'], ids: [] },
];
let active = 'apps';
// Original pen-line vignettes. These describe roles, never quantities or flows.
const drawings = {
  apps: 'M12 14 Q39 12 68 14 L67 49 Q40 51 12 49 Z M13 23 L67 22 M19 18 L21 18 M26 18 L28 18 M21 32 Q38 31 53 32 M21 39 L45 40 M31 51 L30 59 M48 51 L50 59 M23 60 Q40 58 57 60',
  models: 'M14 38 Q17 18 34 20 Q41 9 52 23 Q69 23 66 39 Q74 53 56 57 Q44 67 33 56 Q12 60 14 38 M25 30 Q39 39 55 30 M25 46 Q40 37 56 48 M39 22 Q34 39 43 57 M24 31 L25 46 M55 30 L56 48',
  chips: 'M23 20 Q40 18 57 20 L58 55 Q40 57 22 55 Z M30 27 L50 26 L51 48 L29 49 Z M28 12 L28 19 M40 11 L40 19 M52 12 L52 20 M28 56 L28 64 M40 56 L40 65 M52 55 L52 64 M14 25 L22 25 M14 38 L22 38 M14 50 L22 50 M58 25 L66 25 M58 38 L67 38 M58 50 L66 50',
  memory: 'M10 21 Q25 19 38 21 L38 51 Q24 53 10 51 Z M15 29 L32 29 M15 37 L32 38 M15 45 L28 45 M49 14 L70 15 L69 35 L49 35 Z M50 47 L70 47 L70 66 L49 65 Z M38 35 L44 35 L44 24 L49 24 M44 35 L44 56 L49 56',
  power: 'M44 9 L24 39 L39 39 L34 65 L59 31 L43 31 Z M16 17 L21 22 M61 14 L57 21 M10 41 L17 41 M64 45 L72 46 M18 62 L24 57',
};
const illustration = id => `<svg class="atlasInkDrawing" viewBox="0 0 80 76" aria-hidden="true" focusable="false"><path d="${drawings[id]}"/></svg>`;
export function renderAtlas(data) {
  const zh = currentLanguage() === 'zh';
  const t = (pair) => pair[zh ? 1 : 0];
  const label = (stage) => stage[zh ? 'zh' : 'en'];
  const graph = data?.ecosystemGraph;
  const stage = stages.find(item => item.id === active);
  const tabs = document.getElementById('atlasStages');
  if (!tabs) return;
  tabs.innerHTML = stages.map((item, index) => `<button type="button" data-stage="${item.id}" aria-pressed="${item.id === active}" aria-controls="atlasExplanation atlasCompanies"><span>0${index + 1}</span>${esc(label(item))}</button>`).join('');
  tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    active = button.dataset.stage;
    renderAtlas(data);
    tabs.querySelector(`[data-stage="${active}"]`).focus({ preventScroll: true });
  }));
  document.getElementById('atlasDiagram').innerHTML = `<ol>${stages.map(item => `<li class="${item.id === active ? 'selected' : ''}">${illustration(item.id)}<span>${esc(t(item.verb))}</span><b>${esc(label(item))}</b></li>`).join('')}</ol>`;
  document.getElementById('atlasExplanation').innerHTML = `<span class="atlasEyebrow">0${stages.indexOf(stage) + 1} / 05</span><h2>${esc(label(stage))}</h2><p>${esc(t(stage.text))}</p><a href="#atlasCompanies">${t(['Explore this role ↓', '查看这个环节的公司 ↓'])}</a>`;
  const detail = createDetailController({ getData: () => data });
  const nodes = stage.ids.map(id => graph?.nodes?.find(n => n.id === id)).filter(Boolean);
  document.getElementById('atlasCompanies').innerHTML = `<h2>${t(['Companies & their roles', '公司与分工'])}</h2><p class="atlasNote">${esc(t(['Product and relationship details below retain the archive’s wording and dates.', '下方产品与关系详情保留档案原文及日期。']))}</p>` + (nodes.length ? nodes.map(node => {
    const content = detail.buildDetail(node);
    return `<details class="atlasCompany"><summary><span>${esc(node.label)}</span><small>${esc((node.products || []).slice(0, 2).join(' / '))}</small><span aria-hidden="true">＋</span></summary><div>${content?.bodyHtml || ''}</div></details>`;
  }).join('') : `<p>${esc(t(graph ? ['No suppliers listed for this role in the archive.', '档案未列出此环节的供应商。'] : ['Company archive unavailable. Please reload to try again.', '公司档案暂不可用，请刷新重试。']))}</p>`);
}
