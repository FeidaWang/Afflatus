import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('combat presentation contract', () => {
  it('ships a bounded glTF 2.0 command model', async () => {
    const data = await readFile(new URL('../public/assets/combat/afflatus-command.glb', import.meta.url));
    expect(data.toString('ascii', 0, 4)).toBe('glTF');
    expect(data.readUInt32LE(4)).toBe(2);
    expect(data.readUInt32LE(8)).toBe(data.length);
    expect(data.length).toBeLessThan(180_000);
  });

  it('keeps Three.js weapon and camera cues event-driven', async () => {
    const source = await readFile(new URL('../src/scene/topdownCombat.js', import.meta.url), 'utf8');
    expect(source).toContain("event.type === 'weapon:fire'");
    expect(source).toContain("event.type === 'flight:launch'");
    expect(source).toContain('/assets/combat/afflatus-command.glb');
    expect(source).not.toMatch(/\blast(?:Fire|Missile|Laser|Orb|Chase)\b/);
    expect(source).not.toContain('now - last');
  });

  it('keeps the new CIC stylesheet free of priority escalation', async () => {
    const css = await readFile(new URL('../src/cic-hud.css', import.meta.url), 'utf8');
    expect(css).not.toContain('!important');
  });
});
