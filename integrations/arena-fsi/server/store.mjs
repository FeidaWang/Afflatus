import { clone, ArenaError, assert } from './common.mjs';

// Mutators must be deterministic and perform NO network I/O. A failed CAS is replayed.
export class StateStore {
  constructor(adapter) { this.adapter = adapter; this.persistent = adapter.persistent; }
  async read(key) { return this.adapter.read(key); }
  async update(key, factory, mutate) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const row = await this.adapter.read(key);
      const state = row ? clone(row.document) : factory();
      const result = await mutate(state);
      assert(Buffer.byteLength(JSON.stringify(state)) < 16_000_000, 'STATE_CAPACITY', 'Archive this season before adding more records', 507);
      if (await this.adapter.cas(key, row?.version ?? null, state)) return {state: clone(state), result: clone(result), version:(row?.version ?? 0)+1};
    }
    throw new ArenaError('WRITE_CONTENTION', 'Retry with the same idempotency key', 409);
  }
}
export class MemoryAdapter {
  constructor() { this.rows = new Map(); this.persistent = false; }
  async read(key) { return clone(this.rows.get(key) || null); }
  async cas(key, version, document) {
    const row = this.rows.get(key);
    if ((row?.version ?? null) !== version) return false;
    this.rows.set(key,{version:(version ?? 0)+1,document:clone(document)}); return true;
  }
}
export class SQLiteAdapter {
  constructor(db) {
    this.db = db; this.persistent = true;
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS arena_state (id TEXT PRIMARY KEY, version INTEGER NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL)');
  }
  async read(key) {
    const r=this.db.prepare('SELECT version, document FROM arena_state WHERE id=?').get(key);
    return r ? {version:Number(r.version), document:JSON.parse(r.document)} : null;
  }
  async cas(key, version, doc) {
    const document = JSON.stringify(doc), now = new Date().toISOString();
    if(version===null) return this.db.prepare('INSERT OR IGNORE INTO arena_state(id,version,document,updated_at) VALUES(?,1,?,?)').run(key,document,now).changes===1;
    return this.db.prepare('UPDATE arena_state SET version=version+1,document=?,updated_at=? WHERE id=? AND version=?').run(document,now,key,version).changes===1;
  }
}
export class NeonAdapter {
  constructor(sql) { this.sql=sql; this.persistent=true; }
  async read(key) {
    const rows=await this.sql`SELECT version, document FROM arena_state WHERE id=${key}`;
    return rows.length ? {version:Number(rows[0].version),document:rows[0].document} : null;
  }
  async cas(key, version, document) {
    const body=JSON.stringify(document);
    const rows=version===null
      ? await this.sql`INSERT INTO arena_state(id,version,document) VALUES(${key},1,${body}::jsonb) ON CONFLICT DO NOTHING RETURNING version`
      : await this.sql`UPDATE arena_state SET version=version+1,document=${body}::jsonb,updated_at=now() WHERE id=${key} AND version=${version} RETURNING version`;
    return rows.length===1;
  }
}
export async function productionStore(env=process.env) {
  assert(env.DATABASE_URL, 'DATABASE_NOT_CONFIGURED', 'Set DATABASE_URL and run the migration', 503);
  const {neon}=await import('@neondatabase/serverless');
  return new StateStore(new NeonAdapter(neon(env.DATABASE_URL)));
}
