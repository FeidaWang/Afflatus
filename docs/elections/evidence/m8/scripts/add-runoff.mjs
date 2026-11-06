// Marks LA-01 in the synthetic US snapshots as a runoff on an invented date, to show the H4 label.
// The date is not Louisiana's real runoff date. node add-runoff.mjs <scratchpad>
import { readFileSync, writeFileSync } from 'node:fs';
const [scratch] = process.argv.slice(2);
for (const name of ['vic-live', 'vic-error']) {
  const root = `${scratch}/stores/${name}/us-2026/`;
  const pointer = JSON.parse(readFileSync(`${root}latest.json`, 'utf8'));
  const file = `${root}snapshots/${pointer.snapshotId}.json`;
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  Object.assign(snapshot.races.find((race) => race.seatIds[0] === 'LA-01'), { contestKind: 'runoff', electionDate: '2026-12-05' });
  writeFileSync(file, JSON.stringify(snapshot));
}
