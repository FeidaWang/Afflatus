import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('course.html', 'utf8');
const zhCopy = [...html.matchAll(/\bdata-zh="([^"]*)"/g)].map((match) => match[1]).join('\n');

describe('course Chinese copy', () => {
  it('avoids the machine-translated terms called out by the audit', () => {
    const banned = [
      '内容与源（一键直达）',
      '出口标准',
      'Evals 工程',
      '黄金集',
      'Context Engineering',
      'prompt engineering',
      'compaction',
      'MCP server',
      '可分发 skill',
      'Capstone',
      'eval harness',
      '实质footprint',
      'flag 隔离',
      'So you can tell AI this',
      '<b>源：</b>',
    ];

    banned.forEach((term) => expect(zhCopy, `machine-translated term: ${term}`).not.toContain(term));
  });

  it('gives readers a concise, ordered learning path with primary resources', () => {
    expect(html).toContain('id="direction"');
    expect(html).toContain('data-zh="网页基础与视觉回归"');
    expect(html).toContain('https://playwright.dev/docs/test-snapshots');
    expect(html).toContain('https://github.com/d3/d3');
    expect(html).toContain('https://modelcontextprotocol.io/docs/learn/architecture');
  });

  it('does not pull render-blocking web fonts for the analogue terminal', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });
});
