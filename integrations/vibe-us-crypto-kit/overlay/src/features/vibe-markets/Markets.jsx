import React, { useEffect, useRef } from 'react';
import { mountVibeMarkets } from './index.js';

export default function Markets({ locale }) {
  const root = useRef(null);
  useEffect(() => mountVibeMarkets(root.current, { locale }), [locale]);
  return <section ref={root} data-vibe-markets aria-label={locale === 'zh' ? '真实日线研究' : 'Daily market research'} />;
}
