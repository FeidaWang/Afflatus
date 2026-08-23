import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './mission/mission.css';
import { FlightExperimentApp } from './mission/FlightExperimentApp.jsx';

createRoot(document.getElementById('flight-experiment-root')).render(
  <StrictMode><FlightExperimentApp /></StrictMode>,
);
