import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './mission/mission.css';
import { CommandApp } from './mission/CommandApp.jsx';

createRoot(document.getElementById('command-root')).render(
  <StrictMode><CommandApp /></StrictMode>,
);
