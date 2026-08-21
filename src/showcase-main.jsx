import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './showcase/App.jsx';
import './showcase/showcase.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
