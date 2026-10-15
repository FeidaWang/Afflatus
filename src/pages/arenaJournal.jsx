import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../features/arena-journal/App.jsx';
import '../features/arena-journal/styles.css';
import './arena-layout.css';
import '../lib/nav.js';

// Match keyboard order to the mobile masthead's menu → language layout.
const languageKey = document.querySelector('#afflatus-header .af-header-language');
const menuKey = document.querySelector('#afflatus-header .af-header-menu');
if (languageKey && menuKey) languageKey.before(menuKey);

// A non-secret UI flag; the independent BFF flag and data gate still apply.
const Markets = (import.meta.env.VITE_VIBE_MARKETS_ENABLED === 'true' || import.meta.env.VITE_VIBE_MODELS_ENABLED === 'true')
  ? lazy(() => import('../features/vibe-markets/Markets.jsx')) : null;
const researchPanel = Markets ? locale => <Suspense fallback={null}><Markets locale={locale} /></Suspense> : null;

createRoot(document.getElementById('root')).render(<React.StrictMode><App researchPanel={researchPanel} /></React.StrictMode>);
