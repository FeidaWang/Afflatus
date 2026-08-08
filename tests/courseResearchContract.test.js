import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('course.html', 'utf8');
const css = readFileSync('public/styles/course.css', 'utf8');

describe('course research integration', () => {
  it('turns the uploaded FDE dossier into four field-deployment gates', () => {
    expect(html).toContain('class="fde-field-synthesis"');
    expect(html).toContain('01 / MVD');
    expect(html).toContain('02 / CONTRACT');
    expect(html).toContain('03 / BRIDGE');
    expect(html).toContain('04 / GRADUATE');
    expect(html).toContain('Read old, write new');
    expect(html).toContain('读取旧系统，写入新系统');
  });

  it('distinguishes the three publicly verifiable X-thread projects from supplements', () => {
    expect(html).toContain('https://github.com/OpenMinis/OpenMinis');
    expect(html).toContain('https://github.com/op7418/CodePilot');
    expect(html).toContain('https://github.com/ZSeven-W/openpencil');
    expect(html).toContain('https://x.com/tianyi/status/2083519855203078320');
    expect(html).toContain('login wall');
    expect(html).toContain('登录墙');
  });

  it('publishes the evidence-gated 72-week ML sequence without exposing the private source path', () => {
    expect(html).toContain('CUSTOM ML ROUTE / 72 WEEKS');
    expect(html).toContain('01 / 01–08');
    expect(html).toContain('06 / 61–72');
    expect(html).not.toMatch(new RegExp(['github\\.com/', 'Feida', 'Wang'].join(''), 'i'));
  });

  it('uses responsive research layouts instead of overflowing cards', () => {
    expect(css).toContain('.fde-synthesis-grid,.harness-projects,.ml-route-grid');
    expect(css).toMatch(/@media\(max-width:820px\)[\s\S]*?\.fde-synthesis-grid,.harness-projects,.ml-route-grid\{grid-template-columns:1fr\}/);
  });
});
