import { buildProvenanceBadge } from '../lib/provenanceBadge.js';
import { mountProgressiveCollection } from '../lib/progressiveCollection.js';
import { artHtml, nameFor } from './brandAssets.js';
import {
  currentLanguage,
  emptyMessage,
  escapeHtml,
  relationLabel,
  translate,
  vendorName,
  VENDOR_MARKET,
} from './content.js';

export function createSectorsCardsController(hosts, options = {}) {
  const getData = options.getData || (() => null);
  const getLanguage = options.getLanguage || currentLanguage;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let postMemoryCollection = null;
  const t = (en, zh) => translate(en, zh, getLanguage());

  function renderProvenance(host) {
    if (!host) return;
    const data = getData();
    const sources = new Set();
    (data?.modelWatch || []).forEach((card) => {
      (card.developments || []).forEach((development) => {
        if (development.src) sources.add(development.src);
      });
    });
    const badge = buildProvenanceBadge({
      updatedAt: data?.updated,
      version: data?.version,
      sourceCount: sources.size || undefined,
      lang: getLanguage(),
    });
    const element = document.createElement('span');
    element.className = `prov-badge prov-${badge.tier}`;
    element.textContent = badge.text;
    host.replaceChildren(element);
  }

  function wireDisclosureCards(container) {
    container?.querySelectorAll('.nCard').forEach((card) => {
      const button = card.querySelector('.nToggle');
      if (!button || button.dataset.wired === 'true') return;
      button.dataset.wired = 'true';
      button.addEventListener('click', () => {
        const toggle = () => {
          card.classList.toggle('open');
          const expanded = card.classList.contains('open');
          button.setAttribute('aria-expanded', String(expanded));
          button.textContent = expanded ? t('Hide details', '收起详情') : t('Read details', '查看详情');
        };
        if (!reduceMotion && document.startViewTransition) document.startViewTransition(toggle);
        else toggle();
      });
    });
  }

  function newsCard(optionsForCard) {
    const detailId = optionsForCard.id ? `${optionsForCard.id}-detail` : '';
    const art = artHtml(
      optionsForCard.brand,
      `<div class="nTags">${optionsForCard.tags || ''}</div>`,
    );
    return `<article class="nCard"${optionsForCard.id ? ` id="${escapeHtml(optionsForCard.id)}"` : ''}>`
      + art
      + `<div class="nBody"><div class="nHead"><h3 class="nTitle">${escapeHtml(optionsForCard.title)}</h3>`
      + (optionsForCard.meta ? `<span class="nMeta">${escapeHtml(optionsForCard.meta)}</span>` : '')
      + `</div><div class="nExcerpt">${escapeHtml(optionsForCard.excerpt || '')}</div>`
      + (optionsForCard.chips ? `<div class="nChips">${optionsForCard.chips}</div>` : '')
      + (optionsForCard.detail
        ? `<button type="button" class="nToggle" aria-expanded="false"${detailId ? ` aria-controls="${escapeHtml(detailId)}"` : ''}>${escapeHtml(t('Read details', '查看详情'))}</button>`
          + `<div class="nDetail"${detailId ? ` id="${escapeHtml(detailId)}"` : ''}>${optionsForCard.detail}</div>`
        : '')
      + '</div></article>';
  }

  function renderStoryCards() {
    const data = getData();
    if (!hosts.newsGrid) return;
    if (hosts.storyTake) {
      hosts.storyTake.innerHTML = data?.weeklyTake
        ? '<div class="featuredMedia"><img src="/assets/sectors/media/zhipu-bigmodel.jpg" alt="" width="756" height="386" loading="lazy" decoding="async"><img src="/assets/sectors/media/openai-chatgpt-work.jpg" alt="" width="800" height="450" loading="lazy" decoding="async"></div>'
          + `<div class="featuredBody"><b>${escapeHtml(t('WEEKLY TAKE', '本周主线'))}</b><p>${escapeHtml(t(data.weeklyTake.en, data.weeklyTake.zh))}</p></div>`
        : '';
    }
    const baskets = Array.isArray(data?.baskets) ? data.baskets : [];
    const basketByVendor = new Map(baskets.map((basket) => [basket.vendor, basket]));
    const modelWatch = Array.isArray(data?.modelWatch) ? data.modelWatch : [];
    const modelByVendor = new Map(modelWatch.map((card) => [card.vendor, card]));
    const order = modelWatch.map((card) => card.vendor);
    baskets.forEach((basket) => {
      if (!order.includes(basket.vendor)) order.push(basket.vendor);
    });

    const renderVendorCard = (vendor) => {
      const model = modelByVendor.get(vendor);
      const basket = basketByVendor.get(vendor);
      const equities = basket?.equities || [];
      const market = basket?.market || VENDOR_MARKET[vendor] || 'US';
      const chips = equities
        .map((equity) => `<span class="nChip" data-ticker="${escapeHtml(equity.ticker)}">${escapeHtml(equity.ticker)}</span>`)
        .join('');
      const tags = `<span class="nTag ${market === 'CN' ? 'cn' : 'us'}">${escapeHtml(market)}</span>`
        + (model ? `<span class="nTag">${escapeHtml(model.route === 'open' ? t('OPEN', '开源') : t('CLOSED', '闭源'))}</span>` : '');
      const developments = model
        ? (model.developments || []).map((development) => (
            `<div class="mwDev"><a href="${escapeHtml(development.src)}" target="_blank" rel="noopener">${escapeHtml(t(development.t_en, development.t_zh))}</a></div>`
          )).join('')
        : '';
      const equityRows = equities.map((equity) => (
        `<div class="mwDev"><b>${escapeHtml(equity.ticker)}</b> · ${escapeHtml(relationLabel(equity.relation, getLanguage()))}`
        + (equity.correlation_note_en || equity.correlation_note_zh
          ? `<div class="mwGap">${escapeHtml(t(equity.correlation_note_en, equity.correlation_note_zh))}</div>`
          : '')
        + '</div>'
      )).join('');
      return newsCard({
        id: `vendorCard-${vendor}`,
        brand: vendor,
        tags,
        title: vendorName(vendor, getLanguage()),
        meta: model?.current_line || '',
        excerpt: model
          ? t(model.gap_note_en, model.gap_note_zh)
          : t(equities[0]?.correlation_note_en, equities[0]?.correlation_note_zh),
        chips,
        detail: developments + equityRows,
      });
    };

    const renderColumn = (market) => order
      .filter((vendor) => (basketByVendor.get(vendor)?.market || VENDOR_MARKET[vendor] || 'US') === market)
      .map(renderVendorCard)
      .join('');
    hosts.newsGrid.innerHTML = order.length
      ? '<div class="mwColWrap">'
        + `<section class="mwCol"><h3 class="mwColHead">${escapeHtml(t('US frontier labs', '美国前沿实验室'))}</h3><div class="newsGrid">${renderColumn('US')}</div></section>`
        + `<section class="mwCol"><h3 class="mwColHead">${escapeHtml(t('China frontier labs', '中国前沿实验室'))}</h3><div class="newsGrid">${renderColumn('CN')}</div></section>`
        + '</div>'
      : '';
    wireDisclosureCards(hosts.newsGrid);
  }

  function renderModelWatch() {
    if (!hosts.modelGrid) return;
    const data = getData();
    renderProvenance(hosts.modelAsOf);
    const modelWatch = Array.isArray(data?.modelWatch) ? data.modelWatch : [];
    if (!modelWatch.length) {
      hosts.modelGrid.innerHTML = `<div class="empty">${escapeHtml(emptyMessage(getLanguage()))}</div>`;
      hosts.modelBaskets?.replaceChildren();
      hosts.modelTake?.replaceChildren();
      return;
    }
    hosts.modelGrid.innerHTML = modelWatch.map((card) => {
      const developments = (card.developments || []).map((development) => (
        `<div class="mwDev"><a href="${escapeHtml(development.src)}" target="_blank" rel="noopener">${escapeHtml(t(development.t_en, development.t_zh))}</a></div>`
      )).join('');
      return '<article class="mwCard">'
        + `<div class="mwHead"><span class="mwVendor">${escapeHtml(vendorName(card.vendor, getLanguage()))}</span>`
        + `<span class="mwRoute ${escapeHtml(card.route)}">${escapeHtml(card.route === 'open' ? t('open-weight', '开源权重') : t('closed API', '闭源 API'))}</span></div>`
        + `<div class="mwLine">${escapeHtml(card.current_line)}</div>${developments}`
        + `<div class="mwGap">${escapeHtml(t(card.gap_note_en, card.gap_note_zh))}</div></article>`;
    }).join('');

    const baskets = Array.isArray(data?.baskets) ? data.baskets : [];
    if (hosts.modelBaskets) {
      hosts.modelBaskets.innerHTML = baskets.map((basket) => {
        const equities = (basket.equities || []).map((equity) => (
          `<span class="basketTag">${escapeHtml(equity.ticker)}<i>${escapeHtml(relationLabel(equity.relation, getLanguage()))}</i></span>`
        )).join('');
        return `<div class="basketRow"><b>${escapeHtml(vendorName(basket.vendor, getLanguage()))} · ${escapeHtml(basket.market)}</b>${equities}</div>`;
      }).join('');
    }
    if (hosts.modelTake) {
      hosts.modelTake.textContent = data?.weeklyTake ? t(data.weeklyTake.en, data.weeklyTake.zh) : '';
    }
  }

  function postMemoryCard(card) {
    const tags = `<span class="nTag">${escapeHtml(card.status)}</span>`;
    const chips = (card.tracks || [])
      .map((track) => `<span class="nChip">${escapeHtml(track)}</span>`)
      .join('');
    const catalysts = (card.catalysts || [])
      .map((catalyst) => `${escapeHtml(catalyst.what)} · ${escapeHtml(catalyst.when)}`)
      .join(' · ');
    const detail = `<div class="mwGap"><b>${escapeHtml(t('MOAT', '护城河'))}</b> ${escapeHtml(t(card.moat_en, card.moat_zh))}</div>`
      + `<div class="mwGap"><b>${escapeHtml(t('KEY RISK', '关键风险'))}</b> ${escapeHtml(t(card.key_risk_en, card.key_risk_zh))}</div>`
      + (catalysts ? `<div class="mwGap">${catalysts}</div>` : '');
    return newsCard({
      id: `pmCard-${card.ticker}`,
      brand: card.ticker,
      tags,
      title: nameFor(card.ticker),
      meta: card.ticker,
      excerpt: t(card.thesis_en, card.thesis_zh),
      chips,
      detail,
    });
  }

  function renderPostMemory() {
    if (!hosts.postGrid) return;
    const data = getData();
    renderProvenance(hosts.postAsOf);
    const postMemory = data?.postMemory;
    const previouslyVisible = postMemoryCollection?.visible || 0;
    postMemoryCollection?.destroy();
    postMemoryCollection = null;
    if (!Array.isArray(postMemory?.cards) || !postMemory.cards.length) {
      hosts.postGrid.innerHTML = `<div class="empty">${escapeHtml(emptyMessage(getLanguage()))}</div>`;
      hosts.postTracks?.replaceChildren();
      hosts.postSwap?.replaceChildren();
      hosts.postTake?.replaceChildren();
      return;
    }
    if (hosts.postTracks) {
      hosts.postTracks.innerHTML = (postMemory.tracks || []).map((track) => (
        `<div class="pmTrack"><b>${escapeHtml(track.id)}</b><p>${escapeHtml(t(track.state_en, track.state_zh))}</p></div>`
      )).join('');
    }
    postMemoryCollection = mountProgressiveCollection(hosts.postGrid, postMemory.cards, {
      // Language changes re-render the bilingual card markup. Preserve how
      // far the reader had already expanded instead of collapsing to four.
      initialCount: Math.max(4, previouslyVisible),
      batchSize: 3,
      renderItem: postMemoryCard,
      label: (remaining) => t(
        `Load ${Math.min(3, remaining)} more companies`,
        `继续显示 ${Math.min(3, remaining)} 家公司`,
      ),
      onAppend: () => wireDisclosureCards(hosts.postGrid),
    });
    if (hosts.postSwap) {
      hosts.postSwap.innerHTML = postMemory.swap_proposals?.length
        ? postMemory.swap_proposals.map((proposal) => (
            `<div>${escapeHtml(t('Proposed swap: ', '换股提议：'))}${escapeHtml(proposal.out)} → ${escapeHtml(proposal.in)} — ${escapeHtml(proposal.why_zh)}</div>`
          )).join('')
        : '';
    }
    if (hosts.postTake) hosts.postTake.textContent = t(postMemory.take_en, postMemory.take_zh);
  }

  function render() {
    renderModelWatch();
    renderStoryCards();
    renderPostMemory();
  }

  return Object.freeze({
    render,
    destroy() {
      postMemoryCollection?.destroy();
      postMemoryCollection = null;
    },
  });
}
