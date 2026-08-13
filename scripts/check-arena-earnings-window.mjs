#!/usr/bin/env node
import { assessArenaEarningsWindow } from '../src/lib/arenaEarningsDigest.js';

const gate = assessArenaEarningsWindow(new Date());
console.log(JSON.stringify(gate));
if (!gate.due) process.exitCode = 3;
