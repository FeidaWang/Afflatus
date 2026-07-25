import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildWebVitalEvent,
  classifyDeviceTier,
  getTelemetryContext,
  normalizeTelemetryLocale,
  reportWebVital,
  resetWebVitalsForTest,
} from '../src/lib/webVitals.js';

function fakeWindow(overrides = {}) {
  return {
    innerWidth: 440,
    devicePixelRatio: 3,
    location: { pathname: '/serial.html', search: '?birth=private' },
    document: { documentElement: { lang: 'zh-CN' } },
    navigator: { hardwareConcurrency: 6, deviceMemory: 8, userAgent: 'do-not-send' },
    matchMedia: () => ({ matches: true }),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  resetWebVitalsForTest();
  vi.restoreAllMocks();
});

describe('webVitals privacy and dimensions', () => {
  it('normalizes only the supported locale buckets', () => {
    expect(normalizeTelemetryLocale('zh-CN')).toBe('zh');
    expect(normalizeTelemetryLocale('en-AU')).toBe('en');
    expect(normalizeTelemetryLocale('private-value')).toBe('en');
  });

  it('classifies coarse hardware without exposing raw values', () => {
    expect(classifyDeviceTier({
      width: 440,
      coarsePointer: true,
      hardwareConcurrency: 6,
      deviceMemory: 0,
      dpr: 3,
    })).toBe('mobile-flagship');
    expect(classifyDeviceTier({
      width: 412,
      coarsePointer: true,
      hardwareConcurrency: 4,
      deviceMemory: 2,
      dpr: 2,
    })).toBe('mobile-constrained');
    expect(classifyDeviceTier({ width: 800, coarsePointer: true })).toBe('tablet');
    expect(classifyDeviceTier({ width: 1440, coarsePointer: false })).toBe('desktop');
  });

  it('resolves a manifest route and never includes URL query or browser identity', () => {
    const context = getTelemetryContext(fakeWindow());
    expect(context).toEqual({
      route: 'serial',
      locale: 'zh',
      device_tier: 'mobile-flagship',
    });
    expect(Object.values(context).join(' ')).not.toContain('birth');
    expect(getTelemetryContext(fakeWindow({ location: { pathname: '/unknown.html' } }))).toBeNull();
  });

  it('builds an exact allowlisted metric payload without entries or attribution', () => {
    const payload = buildWebVitalEvent({
      name: 'CLS',
      value: 0.12345,
      delta: 0.02345,
      rating: 'needs-improvement',
      id: 'v6-ephemeral-id',
      entries: [{ target: '#private-input' }],
      attribution: { interactionTarget: '#private-input' },
      userText: 'secret',
    }, {
      route: 'horoscope',
      locale: 'zh',
      device_tier: 'mobile-standard',
    });

    expect(payload).toEqual({
      schema_version: 1,
      metric_name: 'CLS',
      value: 0.023,
      metric_value: 0.123,
      metric_delta: 0.023,
      metric_rating: 'needs-improvement',
      metric_id: 'v6-ephemeral-id',
      route: 'horoscope',
      locale: 'zh',
      device_tier: 'mobile-standard',
    });
    expect(payload).not.toHaveProperty('entries');
    expect(payload).not.toHaveProperty('attribution');
    expect(JSON.stringify(payload)).not.toContain('private');
  });

  it('rejects unsupported metrics and queues only until the existing gtag is ready', () => {
    const win = fakeWindow();
    expect(buildWebVitalEvent({ name: 'TTFB' }, getTelemetryContext(win))).toBeNull();
    expect(reportWebVital({
      name: 'LCP',
      value: 2488.8,
      delta: 2488.8,
      rating: 'good',
      id: 'metric-id',
    }, win)).toBe(true);
    expect(win.setTimeout).toHaveBeenCalledOnce();

    const gtag = vi.fn();
    const immediate = fakeWindow({ gtag });
    resetWebVitalsForTest(win);
    expect(reportWebVital({
      name: 'INP',
      value: 197.4,
      delta: 197.4,
      rating: 'good',
      id: 'metric-id-2',
    }, immediate)).toBe(true);
    expect(gtag).toHaveBeenCalledWith('event', 'web_vital', expect.objectContaining({
      metric_name: 'INP',
      metric_value: 197,
      route: 'serial',
    }));
  });
});
