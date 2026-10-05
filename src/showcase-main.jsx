import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './showcase/PremiereApp.jsx';
import './showcase/premiere.css';
import '../public/lib/header-controller.js';
import './lib/i18n.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
