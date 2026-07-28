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

const PHOTO_URL = {
  NVDA: '/assets/sectors/media/nvidia-vera-rubin.jpg',
  AVGO: '/assets/sectors/media/broadcom-tomahawk6.png',
  MU: '/assets/sectors/media/micron-hbm4.jpg',
  SKHY: '/assets/sectors/media/sk-hynix-hbm.jpg',
  TSM: '/assets/sectors/media/tsmc-3dfabric.jpg',
  ASML: '/assets/sectors/media/asml-high-na.png',
  anthropic: '/assets/sectors/media/anthropic-claude.jpg',
  openai: '/assets/sectors/media/openai-chatgpt-work.jpg',
  zhipu: '/assets/sectors/media/zhipu-bigmodel.jpg',
  alibaba: '/assets/sectors/media/alibaba-model-studio.jpg',
  SSNLF: '/assets/sectors/media/samsung-hbm4.jpg',
  ALAB: '/assets/sectors/media/astera-scorpio.webp',
  MRVL: '/assets/sectors/media/marvell-structera.jpg',
  PSTG: '/assets/sectors/media/pure-flashblade.jpg',
  SNDK: '/assets/sectors/media/sandisk-sn861.jpg',
  TER: '/assets/sectors/media/teradyne-ai-chip.jpg',
  RMBS: '/assets/sectors/media/rambus-cxl.jpg',
};

const MEDIA_ALT = {
  NVDA: 'NVIDIA Vera Rubin AI compute platform',
  AVGO: 'Broadcom Tomahawk 6 AI networking switch silicon',
  MU: 'Micron HBM4 memory product',
  SKHY: 'SK hynix HBM product showcase',
  TSM: 'TSMC 3DFabric heterogeneous integration roadmap',
  ASML: 'ASML TWINSCAN EXE high-NA EUV lithography system',
  anthropic: 'Claude product interface',
  openai: 'ChatGPT Work product interface',
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

export function artHtml(key, extraHtml = '') {
  const color = colorFor(key);
  const photo = PHOTO_URL[key];
  const logo = LOGO_URL[key];
  const name = nameFor(key);
  const style = color ? ` style="--brand:${color}"` : '';
  const photoHtml = photo
    ? `<img class="rPhoto" src="${photo}" alt="${escapeAttribute(MEDIA_ALT[key] || `${name} product visual`)}" width="1200" height="750" loading="lazy" decoding="async"><div class="rScrim"></div>`
    : '';
  const logoHtml = logo
    ? `<span class="rBrandPlate"><img class="rLogo" src="${logo}" alt="${escapeAttribute(name)} logo" width="240" height="80" loading="lazy" decoding="async"></span>`
    : `<span class="rLogoFallback">${escapeAttribute(name)}</span>`;
  return `<div class="rArt${photo ? '' : ' noPhoto'}" data-brand="${escapeAttribute(key)}"${style}>${photoHtml}${extraHtml}${logoHtml}</div>`;
}

export function installBrandAssets(root = document) {
  const onError = (event) => {
    const element = event.target;
    if (!element?.classList) return;
    if (element.classList.contains('rPhoto')) {
      const art = element.parentElement;
      element.remove();
      art?.classList.add('noPhoto');
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
