import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const sql=neon(process.env.DATABASE_URL);
const statement=await readFile(new URL('../config/001-arena-state.sql',import.meta.url),'utf8');
await sql.query(statement,[]);
console.log('Arena schema migration completed: arena_state (additive).');
