// Run with: node --env-file=.env.production.local scripts/verify-redis-rate-limit.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { enforceRateLimit } from '../src/lib/distributedRateLimit.js';

const python = process.env.MODEL_TEST_PYTHON || '/tmp/afflatus-model-validation/bin/python';
process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'production';
const scope = `probe:${randomUUID()}`;
const identity = '192.0.2.123';
const limit = 7;
const windowMs = 5000;
const key = `afflatus:rl:v1:production:${scope}:${createHash('sha256').update(identity).digest('hex')}`;
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
async function redis(command) {
  const response = await fetch(url, { method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
  }, body: JSON.stringify(command), signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(!!data.error, false);
  return data.result;
}
async function nodeCheck() {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json() {} };
  const allowed = await enforceRateLimit({ headers: { 'x-vercel-forwarded-for': identity } }, res,
    'redis-verification', new Map(), scope, { limit, windowMs });
  assert.ok(allowed || res.code === 429, 'real Redis request failed');
  return allowed;
}
function pythonChecks() {
  return new Promise((resolve, reject) => {
    const source = `import importlib.util,json,concurrent.futures\ns=importlib.util.spec_from_file_location('rl','services/vibe-model/rate_limit.py')\nm=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nwith concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:\n print(json.dumps(list(pool.map(lambda _:m.check(${JSON.stringify(scope)},${JSON.stringify(identity)},${limit},${windowMs})[0],range(6)))))`;
    const child = spawn(python, ['-c', source], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', value => { out += value; });
    // Do not echo provider responses or environment on failure.
    child.on('error', () => reject(new Error('Python probe could not start')));
    child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error('Python Redis probe failed')));
  });
}
try {
  assert.equal(await redis(['PING']), 'PONG');
  const [nodes, pythons] = await Promise.all([Promise.all(Array.from({length:6}, nodeCheck)), pythonChecks()]);
  const results = [...nodes, ...pythons];
  assert.equal(results.filter(Boolean).length, limit, 'concurrent workers exceeded shared quota');
  assert.equal(Number(await redis(['GET', key])), 12);
  const ttl = await redis(['PTTL', key]);
  assert.ok(ttl > 0 && ttl <= windowMs);
  await new Promise(resolve => setTimeout(resolve, ttl + 150));
  assert.equal(await redis(['EXISTS', key]), 0);
  assert.equal(await nodeCheck(), true, 'expired quota did not recover');
  console.log(JSON.stringify({ ping: 'PONG', concurrentRequests: 12, allowed: 7, blocked: 5,
    sharedAcross: ['Node.js independent stores', 'Python concurrent workers'], expiry: 'passed', recovery: 'passed' }));
} finally {
  await redis(['DEL', key]);
}
