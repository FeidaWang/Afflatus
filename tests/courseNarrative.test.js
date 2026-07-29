import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { courseStageForProgress } from '../src/lib/courseNarrative.js';

describe('course narrative progression', () => {
  it('maps reading progress to five monotonic stages', () => {
    expect([0, .2, .5, .7, 1].map(courseStageForProgress)).toEqual([0, 1, 2, 3, 4]);
    expect(courseStageForProgress(-1)).toBe(0);
    expect(courseStageForProgress(9)).toBe(4);
  });

  it('ships analogue surveillance primitives and reduced-motion fallback', () => {
    const html = readFileSync('course.html', 'utf8');
    const css = readFileSync('public/styles/course.css', 'utf8');
    expect(html).toContain('class="course-device"');
    expect(html).toContain('class="course-scanner"');
    expect(css).toContain('MICROFILM FRAME');
    expect(css).toContain('courseSignalSlip');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
