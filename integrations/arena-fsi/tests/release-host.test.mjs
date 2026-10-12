import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentUrl } from '../scripts/deployment-url.mjs';

const staged='https://afflatus-629joz3rz-feidawangs-projects.vercel.app';
// Captured from Vercel CLI 63 `deploy --prod --skip-domain --yes` with a piped stdout: the URL is only on stderr.
const cli63Stderr=[
  '  Inspect         https://vercel.com/feidawangs-projects/afflatus/9e4pcDXMtKjdRowinkTz31w891RX',
  `▲ Production      ${staged}`,
  'Completing…',
  `\u001b[2K\u001b[1A\u001b[2K\u001b[G▲ Production      ${staged}`,
  '▲ Aliased         https://afflatus-feidawangs-projects.vercel.app',
].join('\n');

test('deployment URL comes from the CLI 63 Production line, never the project alias',()=>{
  assert.equal(deploymentUrl('',cli63Stderr),staged);
});

test('deployment URL still accepts the bare stdout URL printed in quiet mode',()=>{
  assert.equal(deploymentUrl(staged,''),staged);
  assert.equal(deploymentUrl(`${staged}/`,cli63Stderr),staged);
});

test('deployment URL refuses missing or conflicting candidates',()=>{
  assert.equal(deploymentUrl('','▲ Aliased         https://afflatus-feidawangs-projects.vercel.app'),null);
  assert.equal(deploymentUrl('https://other-abc123-feidawangs-projects.vercel.app',cli63Stderr),null);
  assert.equal(deploymentUrl('',`Production ${staged}\nProduction https://other-abc123-feidawangs-projects.vercel.app`),null);
});
