export const VENDOR_MARKET = Object.freeze({
  anthropic: 'US',
  openai: 'US',
  google: 'US',
  xai: 'US',
  meta: 'US',
  cohere: 'US',
  deepseek: 'CN',
  alibaba: 'CN',
  zhipu: 'CN',
  moonshot: 'CN',
  minimax: 'CN',
});

const VENDOR_NAMES = {
  anthropic: ['Anthropic', 'Anthropic'],
  openai: ['OpenAI', 'OpenAI'],
  google: ['Google Gemini', 'Google Gemini'],
  xai: ['xAI Grok', 'xAI Grok'],
  meta: ['Meta', 'Meta'],
  cohere: ['Cohere', 'Cohere'],
  deepseek: ['DeepSeek', '深度求索'],
  alibaba: ['Alibaba Qwen', '阿里 Qwen'],
  zhipu: ['Zhipu GLM', '智谱 GLM'],
  moonshot: ['Moonshot Kimi', '月之暗面 Kimi'],
  minimax: ['MiniMax', 'MiniMax'],
};

export function currentLanguage() {
  try {
    return window.AfflatusI18N?.get?.() === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

export function translate(en, zh, language = currentLanguage()) {
  return language === 'zh' ? zh : en;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[character]);
}

export function vendorName(vendor, language = currentLanguage()) {
  const names = VENDOR_NAMES[vendor];
  return names ? names[language === 'zh' ? 1 : 0] : vendor;
}

export function relationLabel(relation, language = currentLanguage()) {
  const labels = {
    direct: ['direct', '直接受益'],
    supplier: ['supplier', '上游供给'],
    infra: ['infra', '算力底座'],
    competitor: ['competitor', '受压'],
  };
  const pair = labels[relation];
  return pair ? pair[language === 'zh' ? 1 : 0] : relation;
}

export function emptyMessage(language = currentLanguage()) {
  return translate(
    'Weekly matrix populates after the first scheduled run.',
    '每周对比矩阵将在首次定时任务运行后填充。',
    language,
  );
}
