import React, { Suspense, lazy } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { getLocale } from '../lib/localeStore.js';
import { App } from '../features/arena-journal/App.jsx';
import '../features/arena-journal/styles.css';
import './arena-layout.css';
import '../lib/nav.js';

// Match keyboard order to the mobile masthead's menu → language layout.
const languageKey = document.querySelector('#afflatus-header .af-header-language');
const menuKey = document.querySelector('#afflatus-header .af-header-menu');
if (languageKey && menuKey) languageKey.before(menuKey);

// A non-secret UI flag; the independent BFF flag and data gate still apply.
const Markets = import.meta.env.VITE_VIBE_MARKETS_ENABLED === 'true'
  ? lazy(() => import('../features/vibe-markets/Markets.jsx'))
  : import.meta.env.VITE_VIBE_MODELS_ENABLED === 'true'
    ? lazy(() => import('../features/vibe-markets/ModelPanel.jsx')) : null;
const researchPanel = Markets ? locale => <Suspense fallback={null}><Markets locale={locale} /></Suspense> : null;

const root = document.getElementById('root');
const tree = <React.StrictMode><App researchPanel={researchPanel} /></React.StrictMode>;
const locale = getLocale(document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
if (root.dataset.prerenderedLocale === locale) hydrateRoot(root, tree);
else createRoot(root).render(tree);
