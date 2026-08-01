import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { courseStageForProgress } from '../src/lib/courseNarrative.js';

describe('course narrative progression', () => {
  it('maps reading progress to five monotonic stages', () => {
    expect([0, .2, .5, .7, 1].map(courseStageForProgress)).toEqual([0, 1, 2, 3, 4]);
    expect(courseStageForProgress(-1)).toBe(0);
    expect(courseStageForProgress(9)).toBe(4);
  });

  it('ships a connected surveillance atlas and reduced-motion fallback', () => {
    const html = readFileSync('course.html', 'utf8');
    const css = readFileSync('public/styles/course.css', 'utf8');
    expect(html).toContain('id="atlasViewport"');
    expect(html).toContain('id="fdeReviewForm"');
    expect((html.match(/class="map-node /g) || []).length).toBe(33);
    expect((html.match(/class="microfiche /g) || []).length).toBe(7);
    expect(html).toContain('id="filmLoader"');
    expect(html).toContain('id="signalTimecode"');
    expect(css).toContain('--map-scale');
    expect(css).toContain('.atlas-board::before');
    expect(css).toContain('body[data-course-stage="4"]');
    expect(css).toContain('@keyframes gate-open');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
