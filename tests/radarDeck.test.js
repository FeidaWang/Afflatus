import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  classifyRadarProjectile,
  collectRadarContacts,
  createRadarDeck,
  projectRadarContact,
  radarFrameInterval,
  radarScanPhase,
} from '../src/ui/radarDeck.js';

function createContext() {
  const gradient = { addColorStop: vi.fn() };
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    rect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    globalAlpha: 1,
  };
}

function createSnapshot(overrides = {}) {
  return {
    target: null,
    escorts: [],
    projectiles: [],
    events: [],
    fireControl: { activeWeapon: 'cannon' },
    telemetry: { viewportWidth: 1000, viewportHeight: 500 },
    solution: { valid: false, aimPoint: null, lockQuality: 0 },
    ...overrides,
  };
}

describe('V-SCAN radar data model', () => {
  it('keeps CIWS independent from missile and nuclear tracks', () => {
    expect(classifyRadarProjectile('phalanx')).toBe('ciws');
    expect(classifyRadarProjectile('missile')).toBe('missile');
    expect(classifyRadarProjectile('nuke')).toBe('nuke');

    const contacts = collectRadarContacts(createSnapshot({
      projectiles: [
        { id: 'p', type: 'phalanx', x: 10, y: 20 },
        { id: 'm', type: 'missile', x: 30, y: 40 },
        { id: 'n', type: 'nuke', x: 50, y: 60 },
      ],
    }));
    expect(contacts.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'n', kind: 'nuke' },
      { id: 'm', kind: 'missile' },
      { id: 'p', kind: 'ciws' },
    ]);
  });

  it('bounds dense projectile packets and preserves strategic contacts first', () => {
    const projectiles = Array.from({ length: 90 }, (_, index) => ({
      id: `p-${index}`,
      type: 'phalanx',
      x: index * 10,
      y: index * 5,
    }));
    projectiles.push({ id: 'nuke-1', type: 'nuke', x: 500, y: 250 });
    const contacts = collectRadarContacts(createSnapshot({
      target: { id: 'halley', x: 500, y: 120, collisionRisk: 0.8 },
      projectiles,
    }));
    expect(contacts).toHaveLength(48);
    expect(contacts[0]).toMatchObject({ id: 'halley', kind: 'comet' });
    expect(contacts[1]).toMatchObject({ id: 'nuke-1', kind: 'nuke' });
  });

  it('projects authoritative visual-space coordinates into the vertical strip', () => {
    const projected = projectRadarContact(
      { x: 750, y: 125, vx: 4, vy: -2 },
      { viewportWidth: 1000, viewportHeight: 500 },
      { width: 80, height: 180, left: 8, right: 72, top: 10, bottom: 170 },
    );
    expect(projected.x).toBe(56);
    expect(projected.y).toBe(50);
    expect(projected.xNorm).toBe(0.75);
    expect(projected.yNorm).toBe(0.25);

    const clamped = projectRadarContact(
      { x: 3000, y: -100 },
      { viewportWidth: 1000, viewportHeight: 500 },
      { width: 80, height: 180, left: 8, right: 72, top: 10, bottom: 170 },
    );
    expect(clamped.x).toBe(72);
    expect(clamped.y).toBe(10);
  });

  it('uses time-based scan motion with tiered 30fps maximum and a reduced-motion hold', () => {
    expect(radarScanPhase(1300)).toBe(0.5);
    expect(radarScanPhase(3900)).toBe(0.5);
    expect(radarScanPhase(700, { reducedMotion: true })).toBe(0.5);
    expect(radarFrameInterval({ qualityTier: 'high' })).toBeCloseTo(1000 / 30);
    expect(radarFrameInterval({ qualityTier: 'medium' })).toBeCloseTo(1000 / 24);
    expect(radarFrameInterval({ qualityTier: 'low' })).toBeCloseTo(1000 / 15);
    expect(radarFrameInterval({ qualityTier: 'high', reducedMotion: true })).toBe(125);
  });
});

describe('V-SCAN radar surface', () => {
  it('renders in CSS coordinates at bounded DPR, observes local resize, and reports real draw time', () => {
    const ctx = createContext();
    let rect = { width: 80, height: 160 };
    const canvas = {
      width: 0,
      height: 0,
      dataset: {},
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
    };
    const reportFrame = vi.fn();
    const unregister = vi.fn();
    const computeDpr = vi.fn((_width, _height, limits) => limits.maxDpr);
    const policy = {
      qualityTier: 'high',
      reducedMotion: false,
      computeDpr,
    };
    const renderCoordinator = {
      getPolicy: vi.fn(() => policy),
      register: vi.fn((spec) => {
        spec.onQualityChange(policy);
        spec.onResize();
        spec.onResume();
        return { reportFrame, unregister };
      }),
    };
    let observer = null;
    class FakeResizeObserver {
      constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observer = this;
      }
    }
    let measurement = 0;
    const deck = createRadarDeck(canvas, {
      renderCoordinator,
      ResizeObserverClass: FakeResizeObserver,
      measureNow: () => { measurement += 0.2; return measurement; },
    });

    expect(canvas.width).toBe(140);
    expect(canvas.height).toBe(280);
    expect(ctx.setTransform).toHaveBeenCalledWith(1.75, 0, 0, 1.75, 0, 0);
    expect(observer.observe).toHaveBeenCalledWith(canvas);
    expect(computeDpr).toHaveBeenCalledWith(80, 160, { minDpr: 0.75, maxDpr: 1.75 });

    expect(deck.render(0, createSnapshot())).toBe(true);
    expect(deck.render(16, createSnapshot())).toBe(false);
    expect(deck.render(34, createSnapshot())).toBe(true);
    expect(reportFrame).toHaveBeenCalledTimes(2);
    expect(reportFrame.mock.calls.every(([duration]) => duration > 0)).toBe(true);

    rect = { width: 60, height: 120 };
    observer.callback();
    expect(canvas.width).toBe(105);
    expect(canvas.height).toBe(210);

    deck.destroy();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
  });

  it('loads the final radar override lazily and keeps the mobile scan visible', async () => {
    const [experience, css, deck] = await Promise.all([
      readFile(new URL('../src/homeExperience.js', import.meta.url), 'utf8'),
      readFile(new URL('../src/cic-radar-vscan.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/ui/radarDeck.js', import.meta.url), 'utf8'),
    ]);
    expect(experience.startsWith("import './cic-radar-vscan.css';")).toBe(true);
    expect(experience).toContain('drawRadar(now,state);');
    expect(experience).not.toContain("style.setProperty('--hud-sweep-x'");
    expect(css).toContain('height: clamp(150px, 20svh, 218px);');
    expect(css).toMatch(/@media \(max-width: 520px\)[\s\S]*?\.cic-radar-dock \{[\s\S]*?display: block;/);
    expect(css).not.toContain('!important');
    expect(deck).toContain("if (type === 'phalanx') return 'ciws';");
    expect(deck).toContain('renderSurface?.reportFrame(measureNow() - drawStartedAt);');
    expect(deck).toContain('new ResizeObserverClass(() => resize())');
  });
});
