import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('production stylesheet inlining', () => {
  it('preserves nested cascade order, media conditions, and relative image URLs', () => {
    const dir=mkdtempSync(join(tmpdir(),'afflatus-css-'));
    try {
      mkdirSync(join(dir,'styles/nested'),{recursive:true});
      writeFileSync(join(dir,'index.html'),'<html><head><link rel="stylesheet" href="/styles/main.css" media="screen"></head><body><h1>Visible</h1></body></html>');
      writeFileSync(join(dir,'styles/main.css'),'@import url("nested/base.css"); h1{color:green}');
      writeFileSync(join(dir,'styles/nested/base.css'),'h1{color:red;background:url(art.png)}');
      execFileSync(process.execPath,[resolve('scripts/optimize-static-output.mjs'),dir]);
      const html=readFileSync(join(dir,'index.html'),'utf8');
      expect(html).toContain('media="screen"');
      expect(html).toContain('url(/styles/nested/art.png)');
      expect(html.indexOf('color:red')).toBeLessThan(html.indexOf('color:green'));
      expect(html).not.toContain('@import');
      expect(html).toContain('<h1>Visible</h1>');
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
});
