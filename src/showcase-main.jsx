import React, { Component, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './showcase/App.jsx';
import {
  fallbackExperienceMode,
  legacyHomeHref,
  resolveExperienceMode,
} from './config/experienceMode.js';
import './showcase/showcase.css';

function LegacyHomeRedirect() {
  useEffect(() => {
    window.location.replace(legacyHomeHref(window.location));
  }, []);

  return (
    <main className="experience-redirect" aria-live="polite">
      <p>Loading the legacy AFFLATUS experience…</p>
      <a href={legacyHomeHref(window.location)}>Continue</a>
    </main>
  );
}

class ExperienceBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failedMode: null };
  }

  static getDerivedStateFromError() {
    return { failedMode: true };
  }

  componentDidCatch(error) {
    this.props.onFailure(error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.mode !== this.props.mode && this.state.failedMode) {
      this.setState({ failedMode: null });
    }
  }

  render() {
    if (this.state.failedMode) return null;
    return this.props.children;
  }
}

function ExperienceModeRoot() {
  const [mode, setMode] = useState(() => resolveExperienceMode({
    env: import.meta.env,
    location: window.location,
    navigator: window.navigator,
    matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
  }));

  useEffect(() => {
    document.documentElement.dataset.experienceMode = mode;
  }, [mode]);

  const onFailure = useCallback(() => {
    setMode((currentMode) => fallbackExperienceMode(currentMode));
  }, []);

  if (mode === 'legacy') return <LegacyHomeRedirect />;

  return (
    <ExperienceBoundary mode={mode} onFailure={onFailure}>
      <App key={mode} experienceMode={mode} onExperienceFailure={onFailure} />
    </ExperienceBoundary>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ExperienceModeRoot />
  </React.StrictMode>,
);
