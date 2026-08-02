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
    expect(html).toContain('id="atlas"');
    expect(html).toContain('data-zh="可恢复的智能体运行时"');
    expect(html).toContain('https://openai.com/careers/forward-deployed-engineer-dublin-dublin-ireland/');
    expect(html).toContain('https://openai.com/index/openai-launches-the-deployment-company/');
    expect(html).toContain('https://aws.amazon.com/blogs/apn/introducing-forward-deployed-engineering-for-partners-winning-the-future-of-enterprise-ai/');
    expect(html).toContain('https://a16z.com/the-palantirization-of-everything/');
    expect(html).toContain('https://x.com/mikiarlo3/status/2019662719503274036');
    expect(html).toContain('https://economicgraph.linkedin.com/content/dam/me/economicgraph');
    expect(html).toContain('https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices');
    expect(html).toContain('https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/');
    expect(html).toContain('https://a2a-protocol.org/latest/specification/');
    expect(html).toContain('https://openai.com/index/designing-agents-to-resist-prompt-injection/');
    expect(html).toContain('https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents');
  });

  it('does not pull render-blocking web fonts for the analogue terminal', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });
});
