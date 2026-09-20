import { currentLanguage, escapeHtml } from './content.js';

export function relationshipEvidence(graph, edge, language = 'en') {
  const t = (en, zh) => language === 'zh' ? zh : en;
  const name = id => graph.nodes?.find(n => n.id === id)?.label || id;
  const title = `${name(edge.source)} → ${name(edge.target)}`;
  let url = null;
  try { const parsed = new URL(edge.source_url); if (['http:', 'https:'].includes(parsed.protocol)) url = parsed.href; } catch { /* No source is shown as missing. */ }
  const row = (label, value) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
  return `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(t(edge.label_en, edge.label_zh) || t('Description unavailable', '描述未提供'))}</p><dl>`
    + row(t('Relationship type / ID', '关系类型／标识'), `${edge.type} / ${edge.id}`)
    + row(t('Archive version / updated', '档案版本／更新时间'), `${graph.version ?? '—'} / ${graph.updated || '—'} (Z = UTC)`)
    + row(t('Observation date', '观测日期'), t('Unavailable. Archive update time is not an observation date.', '未提供。档案更新时间不等于观测日期。'))
    + row(t('Unitless display weight', '无量纲绘图权重'), `${edge.strength ?? '—'} · ${t('Editorial input, not a measured correlation or probability.', '研究输入，不是实测相关系数或概率。')}`)
    + `</dl>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(t('Inspect cited source', '核对引用来源'))} ↗</a>` : `<p>${t('Source unavailable', '来源未提供')}</p>`}`;
}

export function renderRelationshipReader(data) {
  const select = document.getElementById('relationshipSelect');
  const source = document.getElementById('relationshipSource');
  const evidence = document.getElementById('relationshipEvidence');
  if (!select || !source || !evidence) return;
  const zh = currentLanguage() === 'zh';
  const graph = data?.ecosystemGraph;
  const selectedId = select.value;
  select.replaceChildren();
  const edges = graph?.edges || [];
  select.disabled = !edges.length;
  source.textContent = graph ? `${zh ? '图谱档案' : 'GRAPH ARCHIVE'} · v${graph.version ?? '—'} · ${graph.updated || '—'} · ${zh ? '获取时间未记录；各关系观测日期未提供。' : 'Retrieval time not recorded; relationship observation dates unavailable.'}` : (zh ? '图谱数据不可用；其他研究章节可继续阅读。' : 'Graph data unavailable; other research chapters remain readable.');
  if (!edges.length) {
    select.add(new Option(zh ? '无可用关系' : 'No relationships available', ''));
    evidence.textContent = '';
    return;
  }
  for (const edge of edges) {
    const name = id => graph.nodes?.find(n => n.id === id)?.label || id;
    select.add(new Option(`${name(edge.source)} → ${name(edge.target)} · ${zh ? edge.label_zh : edge.label_en}`, edge.id));
  }
  if (edges.some(e => e.id === selectedId)) select.value = selectedId;
  const render = () => { evidence.innerHTML = relationshipEvidence(graph, edges.find(e => e.id === select.value), currentLanguage()); };
  select.onchange = render;
  render();
}
