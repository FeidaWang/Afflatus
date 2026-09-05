import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('portfolio.html', 'utf8');
const content = readFileSync('src/data/content.js', 'utf8');
const cruise = readFileSync('src/cic-hud.css', 'utf8');
const heroStyles = readFileSync('src/home-visual-upgrade.css', 'utf8');

describe('home presentation contract', () => {

  it('uses Chinese company brands in the Chinese allocation model', () => {
    ['英伟达（NVIDIA）', '博通（Broadcom）', '超威半导体（AMD）', '甲骨文（Oracle）',
      '亚马逊（Amazon）', '微软（Microsoft）', '台积公司（TSMC）', 'Alphabet（谷歌母公司）',
      '美光科技（Micron）', '维谛技术（Vertiv）'].forEach(name => expect(content).toContain(name));
    expect(content).toContain("s3num:'03 · <span>美股十大配置</span>'");
    expect(html).not.toContain('data-zh="绝对收益率"');
    expect(html).toContain('data-zh="年波动率"');
  });

  it('keeps the cruise sensor compact and localized', () => {
    expect(html).toContain('data-zh="巡航 / 传感器静默监听"');
    expect(html).toContain('data-zh="航向"');
    expect(cruise).toContain('width: min(760px, calc(100vw - 32px))');
    expect(cruise).toContain('clip-path: polygon(12px 0');
  });

  it('art-directs one gravity-well focal point with explicit hero actions', () => {
    expect(html).toContain('class="hero-observatory"');
    expect(html).toContain('class="hero-lens-reticle"');
    expect(html).toContain('class="scroll-hint hero-record-cta" href="#fy2026Performance"');
    expect(html).toContain('id="heroCommandCta"');
    expect(heroStyles).toContain('.hero-lens-reticle');
    expect(heroStyles).toContain('.hero-record-cta');
  });

  it('uses a dedicated battleship favicon on the home page', () => {
    expect(html).toContain('/favicons/home.svg?v=20260808');
    expect(readFileSync('public/favicons/home.svg', 'utf8')).toContain('<path');
  });
});
