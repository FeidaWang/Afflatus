import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../prototypes/us-equities-dashboard/src/App.jsx';
import '../../prototypes/us-equities-dashboard/src/styles.css';

// A non-secret UI flag; the independent BFF flag and data gate still apply.
const Markets = import.meta.env.VITE_VIBE_MARKETS_ENABLED === 'true'
  ? lazy(() => import('../features/vibe-markets/Markets.jsx')) : null;
const researchPanel = Markets ? locale => <Suspense fallback={null}><Markets locale={locale} /></Suspense> : null;

createRoot(document.getElementById('root')).render(<React.StrictMode><App researchPanel={researchPanel} /></React.StrictMode>);
