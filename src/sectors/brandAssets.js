const BRAND_COLOR = {
  NVDA: '#76B900',
  AVGO: '#CC092F',
  MU: '#0077C8',
  SKHY: '#FF7A00',
  TSM: '#E7000A',
  ASML: '#0F238C',
  SSNLF: '#1428A0',
  PSTG: '#FE5000',
  SNDK: '#E10600',
  RMBS: '#4764AC',
  ALAB: '#7C5CBF',
  MRVL: '#6E2585',
  TER: '#2E4A7A',
  anthropic: '#D97757',
  openai: '#10A37F',
  zhipu: '#2F6BFF',
  alibaba: '#FF6A00',
  google: '#4285F4',
  xai: '#1A1A1A',
  meta: '#0866FF',
  cohere: '#39594D',
  deepseek: '#4D6BFE',
  moonshot: '#11131A',
  minimax: '#F23F5D',
};

const DISPLAY_NAME = {
  NVDA: 'NVIDIA',
  AVGO: 'Broadcom',
  MU: 'Micron',
  SKHY: 'SK hynix',
  TSM: 'TSMC',
  ASML: 'ASML',
  SSNLF: 'Samsung',
  ALAB: 'Astera Labs',
  MRVL: 'Marvell',
  PSTG: 'Pure Storage',
  SNDK: 'SanDisk',
  TER: 'Teradyne',
  RMBS: 'Rambus',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  zhipu: 'Zhipu AI',
  alibaba: 'Alibaba',
  google: 'Google Gemini',
  xai: 'xAI Grok',
  meta: 'Meta',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot Kimi',
  minimax: 'MiniMax',
};

const LOGO_URL = {
  NVDA: '/assets/sectors/logos/nvidia.svg',
  AVGO: '/assets/sectors/logos/broadcom.svg',
  MU: '/assets/sectors/logos/micron.svg',
  SKHY: '/assets/sectors/logos/sk-hynix.svg',
  TSM: '/assets/sectors/logos/tsmc.svg',
  ASML: '/assets/sectors/logos/asml.svg',
  anthropic: '/assets/sectors/logos/anthropic.svg',
  openai: '/assets/sectors/logos/openai.svg',
  zhipu: '/assets/sectors/logos/zhipu.svg',
  alibaba: '/assets/sectors/logos/alibaba.svg',
  google: '/assets/sectors/logos/google.svg',
  meta: '/assets/sectors/logos/meta.svg',
  moonshot: '/assets/sectors/logos/moonshot.png',
  SSNLF: '/assets/sectors/logos/samsung.svg',
  ALAB: '/assets/sectors/logos/astera-labs.svg',
  MRVL: '/assets/sectors/logos/marvell.svg',
  PSTG: '/assets/sectors/logos/pure-storage.svg',
  SNDK: '/assets/sectors/logos/sandisk.svg',
  TER: '/assets/sectors/logos/teradyne.svg',
  RMBS: '/assets/sectors/logos/rambus.svg',
};

export const MEDIA_MANIFEST = {
  NVDA: { kind: 'photo', src: '/assets/sectors/media/nvidia-vera-rubin.opt.web.jpg', alt: 'NVIDIA Vera Rubin AI compute platform' },
  AVGO: { kind: 'photo', src: '/assets/sectors/media/broadcom-tomahawk6.opt.web.jpg', alt: 'Broadcom Tomahawk 6 AI networking switch silicon' },
  MU: { kind: 'photo', src: '/assets/sectors/media/micron-hbm4.opt.web.jpg', alt: 'Micron HBM4 memory product' },
  SKHY: '/assets/sectors/media/sk-hynix-hbm.opt.web.jpg',
  TSM: '/assets/sectors/media/tsmc-3dfabric.web.jpg',
  ASML: { kind: 'photo', src: '/assets/sectors/media/asml-high-na.opt.web.jpg', alt: 'ASML TWINSCAN EXE high-NA EUV lithography system' },
  anthropic: '/assets/sectors/media/anthropic-claude.opt.web.jpg',
  openai: { kind: 'photo', src: '/assets/sectors/media/openai-chatgpt-work.opt.web.jpg', alt: 'ChatGPT Work product interface' },
  zhipu: '/assets/sectors/media/zhipu-bigmodel.web.jpg',
  alibaba: '/assets/sectors/media/alibaba-model-studio.web.jpg',
  SSNLF: '/assets/sectors/media/samsung-hbm4.web.jpg',
  ALAB: '/assets/sectors/media/astera-scorpio.opt.web.jpg',
  MRVL: '/assets/sectors/media/marvell-structera.web.jpg',
  PSTG: '/assets/sectors/media/pure-flashblade.web.jpg',
  SNDK: '/assets/sectors/media/sandisk-sn861.opt.web.jpg',
  TER: '/assets/sectors/media/teradyne-ai-chip.opt.web.jpg',
  RMBS: '/assets/sectors/media/rambus-cxl.web.jpg',
  google: { kind: 'poster', alt: 'Google Gemini model intelligence signal' },
  xai: { kind: 'poster', alt: 'xAI Grok model intelligence signal' },
  meta: { kind: 'poster', alt: 'Meta Llama model intelligence signal' },
  cohere: { kind: 'poster', alt: 'Cohere model intelligence signal' },
  deepseek: { kind: 'poster', alt: 'DeepSeek model intelligence signal' },
  moonshot: { kind: 'poster', alt: 'Moonshot Kimi model intelligence signal' },
  minimax: { kind: 'poster', alt: 'MiniMax model intelligence signal' },
};

const MEDIA_ALT = {
  SKHY: 'SK hynix HBM product showcase',
  TSM: 'TSMC 3DFabric heterogeneous integration roadmap',
  anthropic: 'Claude product interface',
  zhipu: 'Zhipu BigModel product homepage',
  alibaba: 'Alibaba Cloud Model Studio and Qwen product page',
  SSNLF: 'Samsung HBM4 memory product',
  ALAB: 'Astera Labs Scorpio smart fabric switch platform',
  MRVL: 'Marvell Structera CXL product line',
  PSTG: 'Pure Storage FlashBlade product platform',
  SNDK: 'SanDisk DC SN861 data-center SSD',
  TER: 'Teradyne semiconductor testing for AI chips',
  RMBS: 'Rambus CXL 2.0 controller product page',
};

Object.entries(MEDIA_MANIFEST).forEach(([key, media]) => {
  if (typeof media === 'string') {
    MEDIA_MANIFEST[key] = {
      kind: 'photo',
      src: media,
      alt: MEDIA_ALT[key] || `${DISPLAY_NAME[key] || key} product visual`,
    };
  }
});

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[character]);
}

export function colorFor(key) {
  return BRAND_COLOR[key];
}

export function nameFor(key) {
  return DISPLAY_NAME[key] || key;
}

function posterHtml(key, media) {
  const name = nameFor(key);
  return `<div class="rPoster" role="img" aria-label="${escapeAttribute(media.alt || `${name} model intelligence signal`)}"><span>MODEL INTELLIGENCE</span><b>${escapeAttribute(name)}</b><i>VERIFIED SIGNAL FEED · ${escapeAttribute(String(key).toUpperCase())}</i></div>`;
}

export function artHtml(key, extraHtml = '') {
  const color = colorFor(key);
  const media = MEDIA_MANIFEST[key] || {
    kind: 'poster',
    alt: `${nameFor(key)} model intelligence signal`,
  };
  const logo = LOGO_URL[key];
  const name = nameFor(key);
  const style = color ? ` style="--brand:${color}"` : '';
  const mediaHtml = media.kind === 'photo'
    ? `<img class="rPhoto" src="${escapeAttribute(media.src)}" alt="${escapeAttribute(media.alt)}" width="1200" height="750" loading="lazy" decoding="async"><div class="rScrim"></div>`
    : posterHtml(key, media);
  const logoHtml = logo
    ? `<span class="rBrandPlate"><img class="rLogo" src="${logo}" alt="${escapeAttribute(name)} logo" width="240" height="80" loading="lazy" decoding="async"></span>`
    : `<span class="rLogoFallback">${escapeAttribute(name)}</span>`;
  return `<div class="rArt" data-brand="${escapeAttribute(key)}" data-media-kind="${media.kind}"${style}>${mediaHtml}${extraHtml}${logoHtml}</div>`;
}

export function installBrandAssets(root = document) {
  const onError = (event) => {
    const element = event.target;
    if (!element?.classList) return;
    if (element.classList.contains('rPhoto')) {
      const art = element.parentElement;
      const key = art?.dataset.brand || '';
      element.remove();
      art?.querySelector('.rScrim')?.remove();
      art?.insertAdjacentHTML('afterbegin', posterHtml(key, {
        alt: `${nameFor(key)} model intelligence signal`,
      }));
      if (art) art.dataset.mediaKind = 'poster';
    } else if (element.classList.contains('rLogo')) {
      const fallback = document.createElement('span');
      fallback.className = 'rLogoFallback';
      fallback.textContent = element.alt || '';
      const plate = element.closest('.rBrandPlate');
      if (plate) plate.replaceWith(fallback);
      else element.replaceWith(fallback);
    }
  };
  const onLoad = (event) => {
    const element = event.target;
    if (element?.classList?.contains('rPhoto')) element.classList.add('loaded');
    if (element?.classList?.contains('rLogo') && element.naturalWidth / element.naturalHeight < 1.4) {
      element.closest('.rArt')?.classList.add('is-mark');
    }
  };
  root.addEventListener('error', onError, true);
  root.addEventListener('load', onLoad, true);
  root.querySelectorAll('.rArt[data-brand]').forEach((element) => {
    element.outerHTML = artHtml(element.dataset.brand);
  });
  return () => {
    root.removeEventListener('error', onError, true);
    root.removeEventListener('load', onLoad, true);
  };
}
