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
    expect((html.match(/class="map-node /g) || []).length).toBe(36);
    expect((html.match(/class="microfiche /g) || []).length).toBe(7);
    expect(html).not.toContain('id="filmLoader"');
    expect(html).toContain('id="signalTimecode"');
    expect(html).toContain('id="agent-core"');
    expect(html).toContain('id="courseNodeDialog"');
    expect(html).toContain('id="mapZoomFit"');
    expect(html).toContain('id="atlasSticky"');
    expect(html).toContain('id="atlasClusterWires"');
    expect(html).toContain('id="atlasRelations"');
    expect(html).toContain('Six hard questions. Thirty-six transmissions. One page.');
    expect(html).toContain('class="signal-strip orientation-dossier"');
    expect(html).toContain('FOUR MARKETS HIDING UNDER ONE TITLE');
    expect(html).toContain('1,268 engineer-core postings');
    expect(html).toContain('BEST READING ORDER / AUG 2026');
    expect(html).not.toContain('SOURCE NOTES');
    expect(html).not.toContain('id="sources"');
    expect(css).toContain('--map-scale');
    expect(css).toContain('overscroll-behavior:auto');
    expect(css).toContain('touch-action:pan-y');
    expect(css).not.toContain('overscroll-behavior:contain');
    expect(css).toContain('.atlas-board::before');
    expect(css).toContain('.course-page>.nav-labs__menu');
    expect(css).not.toContain('.course-page .site-top .nav a{display:none}');
    expect(css).toContain('.orientation-theses');
    expect(css).toContain('body[data-course-stage="4"]');
    expect(css).not.toContain('@keyframes gate-open');
    expect(css).toContain('transform:translate3d(0,48px,0)');
    expect(css).not.toContain('awaiting-transmission{clip-path:inset(0 0 100% 0)');
    const script = readFileSync('src/pages/course.js', 'utf8');
    const nodePackets = readFileSync('src/data/courseNodes.js', 'utf8');
    expect((nodePackets.match(/'\d{2}': packet\(/g) || []).length).toBe(36);
    expect(nodePackets).toContain('failure, gate');
    expect(script).toContain('content must always win over its entrance effect');
    expect(script).not.toContain('filmLoader');
    expect(script).toContain("revealHashTarget({ align: true })");
    expect(script).toContain('requestAnimationFrame(stepAtlasPhysics)');
    expect(script).toContain('clusterEntries');
    expect(script).toContain('window scroll');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});
