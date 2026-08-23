import { forwardRef, useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { emitSceneSignal } from '../../lib/sceneSignals.js';
import {
  persistMotionPreference,
  resolveMotionPreference,
} from '../../lib/motionPreference.js';

const MAGNETIC_LIMIT = 5;
const RELEASE_DURATION_MS = 180;

function mergeRefs(forwardedRef, localRef) {
  return (node) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };
}

function isFinePointer(event) {
  if (event.pointerType === 'touch') return false;
  try {
    return Boolean(window.matchMedia?.('(pointer: fine)')?.matches);
  } catch {
    return false;
  }
}

export function getMagneticOffset(clientX, clientY, rect, limit = MAGNETIC_LIMIT) {
  if (!rect?.width || !rect?.height) return { x: 0, y: 0 };
  const x = ((clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * limit;
  const y = ((clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * limit;
  return {
    x: Math.max(-limit, Math.min(limit, x)),
    y: Math.max(-limit, Math.min(limit, y)),
  };
}

export const CommandButton = forwardRef(function CommandButton({
  children,
  className = '',
  disabled = false,
  motionEnabled = true,
  onClick,
  onCommandIntent,
  sceneSignal = 'command:open',
  type = 'button',
  ...props
}, forwardedRef) {
  const buttonRef = useRef(null);
  const pointerActiveRef = useRef(false);
  const releaseTimerRef = useRef(null);
  const scanFrameRef = useRef(null);

  useEffect(() => () => {
    window.clearTimeout(releaseTimerRef.current);
    window.cancelAnimationFrame(scanFrameRef.current);
  }, []);

  const setState = (state) => buttonRef.current?.setAttribute('data-interaction-state', state);
  const resetMagnet = () => {
    buttonRef.current?.style.setProperty('--command-x', '0px');
    buttonRef.current?.style.setProperty('--command-y', '0px');
  };
  const startScan = () => {
    if (!motionEnabled || !buttonRef.current) return;
    buttonRef.current.removeAttribute('data-scan');
    window.cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = window.requestAnimationFrame(() => {
      buttonRef.current?.setAttribute('data-scan', 'active');
    });
  };

  const handlePointerEnter = (event) => {
    props.onPointerEnter?.(event);
    if (disabled || !isFinePointer(event)) return;
    setState('pointer-hover');
    startScan();
  };
  const handlePointerMove = (event) => {
    props.onPointerMove?.(event);
    if (disabled || !motionEnabled || !isFinePointer(event)) return;
    const offset = getMagneticOffset(event.clientX, event.clientY, buttonRef.current?.getBoundingClientRect());
    buttonRef.current?.style.setProperty('--command-x', `${offset.x.toFixed(2)}px`);
    buttonRef.current?.style.setProperty('--command-y', `${offset.y.toFixed(2)}px`);
  };
  const handlePointerLeave = (event) => {
    props.onPointerLeave?.(event);
    pointerActiveRef.current = false;
    resetMagnet();
    if (!disabled) setState('idle');
  };
  const handlePointerCancel = (event) => {
    props.onPointerCancel?.(event);
    pointerActiveRef.current = false;
    resetMagnet();
    if (!disabled) setState('idle');
  };
  const handlePointerDown = (event) => {
    props.onPointerDown?.(event);
    if (disabled || event.pointerType === 'touch') return;
    pointerActiveRef.current = true;
    setState('pointer-down');
  };
  const handlePointerUp = (event) => {
    props.onPointerUp?.(event);
    if (disabled || event.pointerType === 'touch') return;
    pointerActiveRef.current = false;
    setState('release');
    window.clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = window.setTimeout(() => {
      if (buttonRef.current?.matches(':hover')) setState('pointer-hover');
      else setState('idle');
    }, RELEASE_DURATION_MS);
  };
  const handleFocus = (event) => {
    props.onFocus?.(event);
    resetMagnet();
    if (!disabled && !pointerActiveRef.current) setState('focus');
  };
  const handleBlur = (event) => {
    props.onBlur?.(event);
    pointerActiveRef.current = false;
    resetMagnet();
    if (!disabled) setState('idle');
  };
  const handleClick = (event) => {
    if (disabled) return;
    const intent = { source: event.detail === 0 ? 'keyboard' : 'pointer' };
    onCommandIntent?.(intent);
    emitSceneSignal(buttonRef.current, sceneSignal, intent);
    onClick?.(event);
  };

  return (
    <button
      {...props}
      ref={mergeRefs(forwardedRef, buttonRef)}
      type={type}
      className={`command-button ${className}`.trim()}
      disabled={disabled}
      data-interaction-state={disabled ? 'disabled' : 'idle'}
      data-scene-signal={sceneSignal}
      data-motion-enabled={motionEnabled ? 'true' : 'false'}
      onBlur={handleBlur}
      onClick={handleClick}
      onFocus={handleFocus}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerCancel}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="command-button__surface" onAnimationEnd={() => buttonRef.current?.removeAttribute('data-scan')}>
        <span className="command-button__label">{children}</span>
      </span>
    </button>
  );
});

export function EditorialLink({
  children,
  className = '',
  href,
  onFocus,
  onPointerEnter,
  sceneSignal,
  ...props
}) {
  const emitPreview = (event, source) => {
    if (sceneSignal) emitSceneSignal(event.currentTarget, sceneSignal, { phase: 'preview', source });
  };
  return (
    <a
      {...props}
      className={`editorial-link ${className}`.trim()}
      href={href}
      data-scene-signal={sceneSignal}
      onFocus={(event) => {
        emitPreview(event, 'keyboard');
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        emitPreview(event, 'pointer');
        onPointerEnter?.(event);
      }}
    >
      <span>{children}</span>
      <ArrowRight aria-hidden="true" weight="thin" />
    </a>
  );
}

export function TransmissionRow({ children, date, href, sceneSignal }) {
  const emitPreview = (event, source) => {
    if (sceneSignal) emitSceneSignal(event.currentTarget, sceneSignal, { phase: 'preview', source });
  };
  return (
    <a
      className="transmission-row"
      href={href}
      data-scene-signal={sceneSignal}
      onFocus={(event) => emitPreview(event, 'keyboard')}
      onPointerEnter={(event) => emitPreview(event, 'pointer')}
    >
      <span>{children}</span>
      <time dateTime={date}>{date}</time>
      <ArrowRight aria-hidden="true" weight="thin" />
    </a>
  );
}

export function MotionToggle({ className = '', disabled = false, enabled, language = 'en', onToggle }) {
  const label = language === 'zh' ? '动态效果' : 'Motion';
  const state = language === 'zh'
    ? (enabled ? '开启' : '关闭')
    : (enabled ? 'On' : 'Off');

  return (
    <button
      className={`motion-toggle ${className}`.trim()}
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${label}: ${state}`}
      disabled={disabled}
      onClick={() => onToggle?.(!enabled)}
    >
      <span>{label}</span>
      <span className="motion-toggle__track" aria-hidden="true"><span /></span>
      <strong>{state}</strong>
    </button>
  );
}

export function useMotionPreference(experienceMode) {
  const forceReduced = experienceMode === 'reduced';
  const [motion, setMotion] = useState(() => resolveMotionPreference({
    storage: window.localStorage,
    matchMedia: window.matchMedia?.bind(window),
    forceReduced,
  }));

  useEffect(() => {
    document.documentElement.dataset.motion = motion.enabled && !forceReduced ? 'on' : 'off';
  }, [forceReduced, motion.enabled]);

  const setEnabled = (enabled) => {
    if (forceReduced) return;
    persistMotionPreference(window.localStorage, enabled);
    setMotion({ enabled, source: 'stored' });
  };

  return {
    enabled: motion.enabled && !forceReduced,
    locked: forceReduced,
    setEnabled,
    source: forceReduced ? 'experience' : motion.source,
  };
}
