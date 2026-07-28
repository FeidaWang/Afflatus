import { fetchJson } from '../lib/fetchJson.js';
import { buildProvenanceBadge } from '../lib/provenanceBadge.js';
import { initSectorsCompetition } from '../lib/sectorsCompetitionView.js';
import { currentLanguage } from './content.js';

export function initSectorsCompetitionController(hosts) {
  if (!hosts.radar) return () => {};
  const abortController = new AbortController();
  let viewHandle = null;
  let data = null;

  const renderBadge = () => {
    if (!hosts.provenance || !data) return;
    const sources = new Set();
    for (const model of data.models) {
      for (const row of model.bench) if (row.src) sources.add(row.src);
      if (model.pricing?.src) sources.add(model.pricing.src);
    }
    const badge = buildProvenanceBadge({
      updatedAt: data.updated,
      version: 1,
      sourceCount: sources.size,
      lang: currentLanguage(),
    });
    const badgeElement = document.createElement('span');
    badgeElement.className = `prov-badge prov-${badge.tier}`;
    badgeElement.textContent = badge.text;
    const note = document.createElement('span');
    note.textContent = currentLanguage() === 'zh'
      ? data.provenance_note_zh
      : data.provenance_note_en;
    hosts.provenance.replaceChildren(badgeElement, note);
  };
  const onLanguage = () => {
    viewHandle?.render();
    renderBadge();
  };
  addEventListener('afflatus-lang', onLanguage);

  fetchJson('sectors-competition', { signal: abortController.signal })
    .then((result) => {
      data = result;
      viewHandle = initSectorsCompetition(hosts, data, { lang: currentLanguage });
      renderBadge();
    })
    .catch((error) => {
      if (error?.name === 'AbortError') return;
      const message = document.createElement('div');
      message.className = 'empty';
      message.textContent = currentLanguage() === 'zh'
        ? '竞争数据集加载失败；完整对比矩阵仍可在上方数据视图中查阅。'
        : 'The competition dataset could not be loaded; the comparison matrix above remains available.';
      hosts.radar.replaceChildren(message);
    });

  return () => {
    abortController.abort();
    removeEventListener('afflatus-lang', onLanguage);
    viewHandle?.destroy?.();
  };
}
