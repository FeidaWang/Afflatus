import { useCallback, useEffect, useRef, useState } from 'react';
import { AFFLATUS_SCENE_SIGNAL_EVENT } from '../../lib/sceneSignals.js';
import { createFlightDirector, flightDebugEnabled } from './FlightDirector.js';
import {
  collectQualitySignals,
  probeWebGLCapability,
  profileSupportsWebGL,
  resolveQualityProfile,
  sceneDiagnostic,
} from './qualityProfile.js';
import { createSceneStateStore, SCENE_STATUS } from './sceneState.js';
import { createScrollTimeline } from './scrollTimeline.js';

const DEFERRED_SCENE_START_MS = 12_000;

function scheduleAfterFirstPaint(task) {
  let firstFrame = 0;
  let secondFrame = 0;
  let timeoutHandle = 0;
  let started = false;
  const interactionEvents = ['keydown', 'pointerdown', 'scroll', 'touchstart', 'wheel'];

  const start = () => {
    if (started) return;
    started = true;
    interactionEvents.forEach((eventName) => window.removeEventListener(eventName, start));
    window.clearTimeout(timeoutHandle);
    task();
  };

  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      if (window.__AFFLATUS_E2E__) start();
      else timeoutHandle = window.setTimeout(start, DEFERRED_SCENE_START_MS);
    });
  });
  interactionEvents.forEach((eventName) => window.addEventListener(eventName, start, { passive: true }));

  return () => {
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
    window.clearTimeout(timeoutHandle);
    interactionEvents.forEach((eventName) => window.removeEventListener(eventName, start));
  };
}

function baseProfile(experienceMode, motionEnabled, webglAvailable = true) {
  return resolveQualityProfile({
    ...collectQualitySignals(window, webglAvailable),
    experienceMode,
    motionEnabled,
  });
}

const STATIC_JOURNEY_FRAMES = Object.freeze([
  Object.freeze({ id: 'bow', src: '/assets/showcase/static-journey/bow-approach.avif' }),
  Object.freeze({ id: 'drift', src: '/assets/showcase/static-journey/parallel-drift.avif' }),
  Object.freeze({ id: 'departure', src: '/assets/showcase/static-journey/engine-departure.avif' }),
]);

export function ExperienceRoot({ experienceMode, motionEnabled, onUnavailable }) {
  const rootRef = useRef(null);
  const unavailableRef = useRef(onUnavailable);
  const webglAvailableRef = useRef(null);
  const intentTimerRef = useRef(null);
  const directorRef = useRef(null);
  const sceneStateRef = useRef(null);
  const diagnosticsRef = useRef(null);
  if (!directorRef.current) directorRef.current = createFlightDirector();
  if (!sceneStateRef.current) sceneStateRef.current = createSceneStateStore();
  if (!diagnosticsRef.current) {
    diagnosticsRef.current = {
      activeRafOwners: 0,
      mainRafRunning: false,
      reactRenders: 0,
      sceneFrames: 0,
      sceneRenders: 0,
    };
  }
  diagnosticsRef.current.reactRenders += 1;

  const [capabilityReady, setCapabilityReady] = useState(false);
  const [profile, setProfile] = useState(() => baseProfile(experienceMode, motionEnabled));
  const [sceneComponent, setSceneComponent] = useState(null);
  const [status, setStatus] = useState(SCENE_STATUS.POSTER);
  const [timeline, setTimeline] = useState(null);
  const [deferredFramesReady, setDeferredFramesReady] = useState(false);

  useEffect(() => { unavailableRef.current = onUnavailable; }, [onUnavailable]);

  const reportUnavailable = useCallback(() => {
    setSceneComponent(null);
    setStatus(SCENE_STATUS.FALLBACK);
    unavailableRef.current?.();
  }, []);

  const reportReady = useCallback(() => setStatus(SCENE_STATUS.READY), []);

  useEffect(() => {
    const director = directorRef.current;
    const sceneState = sceneStateRef.current;
    const publishSceneState = (snapshot) => {
      const root = rootRef.current;
      if (!root) return;
      root.dataset.currentChapter = snapshot.chapterId;
      root.dataset.activeSystem = snapshot.activeSystem;
      root.dataset.loadingState = snapshot.loadingState;
    };
    const nextTimeline = createScrollTimeline({
      documentScope: document,
      windowScope: window,
      onChapterChange: (timelineFrame) => {
        const flight = director.update(timelineFrame);
        sceneState.update({
          activeSystem: flight.activeSystem,
          chapterId: flight.chapterCue,
        });
      },
    });
    const unsubscribe = sceneState.subscribe(publishSceneState);
    publishSceneState(sceneState.getSnapshot());
    setTimeline(nextTimeline);

    const diagnosticsApi = window.__AFFLATUS_E2E__
      ? Object.freeze({
        getFlight: () => director.getSnapshot(),
        getMetrics: () => Object.freeze({
          ...diagnosticsRef.current,
          samplePerformance: undefined,
          timeline: nextTimeline.getDiagnostics(),
        }),
        samplePerformance: (frameMs, now) => diagnosticsRef.current.samplePerformance?.(frameMs, now),
        getSceneState: () => sceneState.getSnapshot(),
        getTimeline: () => nextTimeline.getSnapshot(),
      })
      : null;
    if (diagnosticsApi) {
      window.__AFFLATUS_M07__ = diagnosticsApi;
      window.__AFFLATUS_M08__ = diagnosticsApi;
      window.__AFFLATUS_M09__ = diagnosticsApi;
      window.__AFFLATUS_M10__ = diagnosticsApi;
      window.__AFFLATUS_M11__ = diagnosticsApi;
      window.__AFFLATUS_M12__ = diagnosticsApi;
      window.__AFFLATUS_M13__ = diagnosticsApi;
    }

    return () => {
      unsubscribe();
      nextTimeline.destroy();
      if (window.__AFFLATUS_M07__ === diagnosticsApi) delete window.__AFFLATUS_M07__;
      if (window.__AFFLATUS_M08__ === diagnosticsApi) delete window.__AFFLATUS_M08__;
      if (window.__AFFLATUS_M09__ === diagnosticsApi) delete window.__AFFLATUS_M09__;
      if (window.__AFFLATUS_M10__ === diagnosticsApi) delete window.__AFFLATUS_M10__;
      if (window.__AFFLATUS_M11__ === diagnosticsApi) delete window.__AFFLATUS_M11__;
      if (window.__AFFLATUS_M12__ === diagnosticsApi) delete window.__AFFLATUS_M12__;
      if (window.__AFFLATUS_M13__ === diagnosticsApi) delete window.__AFFLATUS_M13__;
    };
  }, []);

  useEffect(() => {
    sceneStateRef.current.update({ loadingState: status });
  }, [status]);

  useEffect(() => {
    directorRef.current.setProfile(profile);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    setCapabilityReady(false);
    setSceneComponent(null);
    setStatus(SCENE_STATUS.POSTER);

    const preliminary = baseProfile(experienceMode, motionEnabled);
    setProfile(preliminary);
    if (!profileSupportsWebGL(preliminary)) return undefined;

    setStatus(SCENE_STATUS.SCHEDULED);
    const cancelSchedule = scheduleAfterFirstPaint(async () => {
      if (cancelled) return;
      const diagnostic = sceneDiagnostic(window.location);
      if (diagnostic === 'unavailable') {
        reportUnavailable();
        return;
      }

      const available = probeWebGLCapability(document);
      webglAvailableRef.current = available;
      setCapabilityReady(true);
      if (!available) {
        reportUnavailable();
        return;
      }
      const resolved = baseProfile(experienceMode, motionEnabled, available);
      setProfile(resolved);
      if (!profileSupportsWebGL(resolved)) {
        setStatus(SCENE_STATUS.FALLBACK);
        return;
      }

      setStatus(SCENE_STATUS.LOADING);
      try {
        const module = await import('./SignatureScene.jsx');
        if (!cancelled) setSceneComponent(() => module.SignatureScene);
      } catch {
        if (!cancelled) reportUnavailable();
      }
    });
    return () => {
      cancelled = true;
      cancelSchedule();
    };
  }, [experienceMode, motionEnabled, reportUnavailable]);

  useEffect(() => {
    if (deferredFramesReady) return undefined;
    const loadDeferredFrames = () => setDeferredFramesReady(true);
    window.addEventListener('scroll', loadDeferredFrames, { once: true, passive: true });
    window.addEventListener('pointerdown', loadDeferredFrames, { once: true, passive: true });
    window.addEventListener('touchstart', loadDeferredFrames, { once: true, passive: true });
    return () => {
      window.removeEventListener('scroll', loadDeferredFrames);
      window.removeEventListener('pointerdown', loadDeferredFrames);
      window.removeEventListener('touchstart', loadDeferredFrames);
    };
  }, [deferredFramesReady]);

  useEffect(() => {
    if (!capabilityReady || webglAvailableRef.current === null) return undefined;
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        setProfile(baseProfile(experienceMode, motionEnabled, webglAvailableRef.current));
      }, 80);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, [capabilityReady, experienceMode, motionEnabled]);

  useEffect(() => {
    if (!profileSupportsWebGL(profile)) setStatus(SCENE_STATUS.POSTER);
  }, [profile]);

  useEffect(() => {
    const onSceneSignal = (event) => {
      if (!rootRef.current || !event.detail?.signal) return;
      rootRef.current.dataset.sceneIntent = event.detail.signal;
      window.clearTimeout(intentTimerRef.current);
      intentTimerRef.current = window.setTimeout(() => {
        rootRef.current?.removeAttribute('data-scene-intent');
      }, 480);
    };
    document.addEventListener(AFFLATUS_SCENE_SIGNAL_EVENT, onSceneSignal);
    return () => {
      document.removeEventListener(AFFLATUS_SCENE_SIGNAL_EVENT, onSceneSignal);
      window.clearTimeout(intentTimerRef.current);
    };
  }, []);

  const assetHref = sceneDiagnostic(window.location) === 'resource-error'
    ? '/assets/showcase/missing-m06-poster.jpg'
    : '/assets/showcase/blackhole-hero.jpg';
  const SceneComponent = sceneComponent;
  const sceneSnapshot = sceneStateRef.current.getSnapshot();
  const debugEnabled = flightDebugEnabled({
    development: import.meta.env.DEV,
    search: window.location.search,
  });

  return (
    <div
      className="signature-experience"
      ref={rootRef}
      aria-hidden="true"
      data-quality-profile={profile}
      data-scene-status={status}
      data-current-chapter={sceneSnapshot.chapterId}
      data-active-system={sceneSnapshot.activeSystem}
      data-loading-state={sceneSnapshot.loadingState}
      data-flight-debug={debugEnabled ? 'enabled' : undefined}
    >
      <div className="chapter-poster static-journey" data-renderer="poster">
        {STATIC_JOURNEY_FRAMES.map((frame, index) => (
          <img
            alt=""
            aria-hidden="true"
            className="static-journey__frame"
            data-static-frame={frame.id}
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'low'}
            key={frame.id}
            src={index === 0 || deferredFramesReady ? frame.src : undefined}
          />
        ))}
      </div>
      {SceneComponent && timeline && profileSupportsWebGL(profile) ? (
        <SceneComponent
          assetHref={assetHref}
          diagnostics={diagnosticsRef.current}
          debugEnabled={debugEnabled}
          director={directorRef.current}
          profile={profile}
          sceneState={sceneStateRef.current}
          timeline={timeline}
          onReady={reportReady}
          onStatus={setStatus}
          onUnavailable={reportUnavailable}
        />
      ) : null}
      <div className="signature-experience__shade" />
    </div>
  );
}
