import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { getLocale } from './lib/localeStore.js';
import { App } from './showcase/PremiereApp.jsx';
import './showcase/premiere.css';
import './lib/nav.js';
import './lib/i18n.js';

const root = document.getElementById('root');
const tree = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
const locale = getLocale(document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
if (root.dataset.prerenderedLocale === locale) hydrateRoot(root, tree);
else createRoot(root).render(tree);
