import {
  currentLanguage,
  escapeHtml,
  relationLabel,
  translate,
  vendorName,
} from './content.js';

export function createDetailController(options = {}) {
  const getData = options.getData || (() => null);
  const getLanguage = options.getLanguage || currentLanguage;
  const host = options.host || null;
  const t = (en, zh) => translate(en, zh, getLanguage());

  function buildDetail(node) {
    const data = getData();
    if (node?.source && data?.ecosystemGraph) {
      const graph = data.ecosystemGraph;
      const nodeById = new Map((graph.nodes || []).map((item) => [item.id, item]));
      const edgeNames = {
        investment: t('INVESTMENT', '投资'),
        cloud: t('CLOUD', '云'),
        compute: t('COMPUTE', '算力'),
        silicon: t('SILICON', '芯片'),
        memory: t('MEMORY', '存储'),
        manufacturing: t('MANUFACTURING', '制造'),
        distribution: t('DISTRIBUTION', '分发'),
        platform: t('PLATFORM', '平台'),
        coalition: t('COALITION', '联盟'),
        supply: t('SUPPLY', '供应'),
      };
      const kindNames = {
        model: '模型',
        initiative: '倡议',
        cloud: '云',
        compute: '算力',
        silicon: '芯片',
        memory: '存储',
        manufacturing: '制造',
        platform: '平台',
      };
      const products = (node.products || [])
        .map((product) => `<span class="mwProduct">${escapeHtml(product)}</span>`)
        .join('');
      const connections = (graph.edges || [])
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .map((edge) => {
          const other = nodeById.get(edge.source === node.id ? edge.target : edge.source);
          return `<a class="mwConnection" href="${escapeHtml(edge.source_url)}" target="_blank" rel="noopener">`
            + `<span><i class="edge-${escapeHtml(edge.type)}"></i>${escapeHtml(edgeNames[edge.type] || edge.type)}</span>`
            + `<b>${escapeHtml(other?.label || '')}</b>`
            + `<small>${escapeHtml(t(edge.label_en, edge.label_zh))}</small></a>`;
        })
        .join('');
      return {
        title: node.label,
        tag: t(node.kind, kindNames[node.kind] || node.kind),
        tagClass: 'ecosystem',
        bodyHtml: `<div class="mwLine">${escapeHtml(t(node.summary_en, node.summary_zh))}</div>`
          + (products ? `<div class="mwProducts">${products}</div>` : '')
          + (connections ? `<div class="mwConnections"><strong>${escapeHtml(t('VERIFIED CONNECTIONS', '经核验关系'))}</strong>${connections}</div>` : '')
          + `<a class="mwPrimarySource" href="${escapeHtml(node.source)}" target="_blank" rel="noopener">${escapeHtml(t('Primary product source ↗', '产品一手来源 ↗'))}</a>`,
      };
    }

    if (node?.kind === 'vendor') {
      const card = (data?.modelWatch || []).find((item) => item.vendor === node.vendor);
      if (!card) return null;
      const developments = (card.developments || [])
        .map((development) => `<div class="mwDev"><a href="${escapeHtml(development.src)}" target="_blank" rel="noopener">${escapeHtml(t(development.t_en, development.t_zh))}</a></div>`)
        .join('');
      return {
        title: vendorName(card.vendor, getLanguage()),
        tag: card.route === 'open' ? t('open-weight', '开源权重') : t('closed API', '闭源 API'),
        tagClass: card.route,
        bodyHtml: `<div class="mwLine">${escapeHtml(card.current_line)}</div>${developments}`
          + `<div class="mwGap">${escapeHtml(t(card.gap_note_en, card.gap_note_zh))}</div>`,
      };
    }

    const references = [];
    (data?.baskets || []).forEach((basket) => {
      (basket.equities || []).forEach((equity) => {
        if (equity.ticker === node?.label) {
          references.push({
            vendor: basket.vendor,
            relation: equity.relation,
            note: t(equity.correlation_note_en, equity.correlation_note_zh),
          });
        }
      });
    });
    if (!references.length) {
      if (node?.kind === 'universe') {
        return {
          title: node.label,
          bodyHtml: `<div class="mwGap">${escapeHtml(t(
            'On the Arena trading universe list — no vendor-correlation thesis on file for this ticker.',
            '在 Arena 交易域清单内——该股暂无厂商关联研判。',
          ))}</div>`,
        };
      }
      return null;
    }
    return {
      title: node.label,
      bodyHtml: references.map((reference) => (
        `<div class="mwDev"><b>${escapeHtml(vendorName(reference.vendor, getLanguage()))}</b> · `
        + `<span class="basketTag">${escapeHtml(relationLabel(reference.relation, getLanguage()))}</span>`
        + (reference.note ? `<div class="mwGap">${escapeHtml(reference.note)}</div>` : '')
        + '</div>'
      )).join(''),
    };
  }

  function render(node) {
    if (!host) return;
    const detail = buildDetail(node);
    if (!detail) {
      host.hidden = true;
      return;
    }
    host.innerHTML = `<button type="button" class="mwDetailClose" aria-label="${escapeHtml(t('close', '关闭'))}">&times;</button>`
      + `<div class="mwHead"><span class="mwVendor">${escapeHtml(detail.title)}</span>`
      + (detail.tag ? `<span class="mwRoute ${escapeHtml(detail.tagClass || '')}">${escapeHtml(detail.tag)}</span>` : '')
      + `</div>${detail.bodyHtml}`;
    host.hidden = false;
    host.querySelector('.mwDetailClose')?.addEventListener('click', () => {
      host.hidden = true;
    }, { once: true });
  }

  return Object.freeze({ buildDetail, render });
}
