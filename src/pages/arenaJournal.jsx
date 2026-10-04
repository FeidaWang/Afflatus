import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../prototypes/us-equities-dashboard/src/App.jsx';
import '../../prototypes/us-equities-dashboard/src/styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
