import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './mission/mission.css';
import './content/content.css';
import { ContentApp } from './content/ContentApp.jsx';

createRoot(document.getElementById('content-root')).render(
  <StrictMode><ContentApp /></StrictMode>,
);
