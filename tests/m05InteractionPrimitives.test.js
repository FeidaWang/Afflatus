import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandButton,
  EditorialLink,
  getMagneticOffset,
  MotionToggle,
  TransmissionRow,
} from '../src/showcase/primitives/InteractionPrimitives.jsx';
import {
  MOTION_OFF,
  MOTION_ON,
  MOTION_STORAGE_KEY,
  persistMotionPreference,
  resolveMotionPreference,
} from '../src/lib/motionPreference.js';
import {
  AFFLATUS_SCENE_SIGNAL_EVENT,
  createSceneSignal,
  emitSceneSignal,
} from '../src/lib/sceneSignals.js';

const primitiveSource = readFileSync('src/showcase/primitives/InteractionPrimitives.jsx', 'utf8');
const showcaseCss = readFileSync('src/showcase/showcase.css', 'utf8');

describe('M05 motion preference', () => {
  it('uses a versioned stored preference before the system default', () => {
    const reduced = vi.fn(() => ({ matches: true }));
    const storage = { getItem: vi.fn(() => MOTION_ON) };
    expect(resolveMotionPreference({ storage, matchMedia: reduced })).toEqual({ enabled: true, source: 'stored' });
    expect(storage.getItem).toHaveBeenCalledWith(MOTION_STORAGE_KEY);
    expect(reduced).not.toHaveBeenCalled();
  });

  it('defaults to the system setting and lets reduced experience force motion off', () => {
    expect(resolveMotionPreference({ matchMedia: () => ({ matches: true }) })).toEqual({ enabled: false, source: 'system' });
    expect(resolveMotionPreference({ matchMedia: () => ({ matches: false }) })).toEqual({ enabled: true, source: 'system' });
    expect(resolveMotionPreference({
      storage: { getItem: () => MOTION_ON },
      forceReduced: true,
    })).toEqual({ enabled: false, source: 'experience' });
  });

  it('persists only the compact on/off schema and tolerates blocked storage', () => {
    const storage = { setItem: vi.fn() };
    expect(persistMotionPreference(storage, false)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(MOTION_STORAGE_KEY, MOTION_OFF);
    expect(persistMotionPreference({ setItem: () => { throw new Error('blocked'); } }, true)).toBe(false);
  });
});

describe('M05 scene intent boundary', () => {
  it('creates immutable scene-neutral command intent payloads', () => {
    const signal = createSceneSignal('command:open', { source: 'keyboard' });
    expect(signal).toEqual({ signal: 'command:open', phase: 'intent', source: 'keyboard' });
    expect(Object.isFrozen(signal)).toBe(true);
  });

  it('emits a bubbling custom event without importing a renderer', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    target.addEventListener(AFFLATUS_SCENE_SIGNAL_EVENT, listener);
    const event = emitSceneSignal(target, 'command:open', { source: 'pointer' });
    expect(event.detail.signal).toBe('command:open');
    expect(listener).toHaveBeenCalledOnce();
    expect(primitiveSource).not.toMatch(/three|DeckScene|Canvas/);
  });
});

describe('M05 interaction components', () => {
  it('renders explicit idle and disabled Command Button states', () => {
    const idle = renderToStaticMarkup(React.createElement(CommandButton, null, 'Enter Command'));
    const disabled = renderToStaticMarkup(React.createElement(CommandButton, { disabled: true }, 'Enter Command'));
    expect(idle).toContain('data-interaction-state="idle"');
    expect(idle).toContain('data-scene-signal="command:open"');
    expect(disabled).toContain('data-interaction-state="disabled"');
    expect(disabled).toContain('disabled=""');
  });

  it('renders semantic editorial, transmission and motion controls', () => {
    const link = renderToStaticMarkup(React.createElement(EditorialLink, { href: '/en/signal.html' }, 'Read dossier'));
    const row = renderToStaticMarkup(React.createElement(TransmissionRow, { href: '/en/arena.html', date: '2026.08.08' }, 'Risk engine'));
    const toggle = renderToStaticMarkup(React.createElement(MotionToggle, { enabled: true, language: 'en' }));
    expect(link).toContain('class="editorial-link"');
    expect(row).toContain('class="transmission-row"');
    expect(row).toContain('dateTime="2026.08.08"');
    expect(toggle).toContain('role="switch"');
    expect(toggle).toContain('aria-checked="true"');
  });

  it('clamps magnetic movement to five pixels without changing layout geometry', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 };
    expect(getMagneticOffset(500, -50, rect)).toEqual({ x: 5, y: -5 });
    expect(getMagneticOffset(200, 100, rect)).toEqual({ x: 0, y: 0 });
    expect(showcaseCss).toContain('translate3d(var(--command-x), var(--command-y), 0)');
  });

  it('defines every required state and a single-pass hover scan', () => {
    for (const state of ['idle', 'pointer-hover', 'pointer-down', 'release', 'focus', 'disabled']) {
      expect(primitiveSource).toContain(`'${state}'`);
    }
    expect(showcaseCss).toMatch(/animation:\s*command-scan[^;]*\s1\sboth;/);
    expect(showcaseCss).not.toMatch(/command-scan[^;]*infinite/);
  });

  it('limits Editorial Link motion to underline redraw and a four-pixel arrow shift', () => {
    expect(showcaseCss).toContain('background-size: 0 1px, 100% 1px');
    expect(showcaseCss).toContain('translateX(4px)');
    expect(showcaseCss).not.toMatch(/\.transmission-row[^}]*scale|\.transmission-row[^}]*rotate|\.transmission-row[^}]*box-shadow/s);
  });
});
