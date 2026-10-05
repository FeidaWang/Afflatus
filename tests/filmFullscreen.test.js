import { describe, expect, it, vi } from 'vitest';
import { enterFilmFullscreen, unlockFilmOrientation } from '../src/showcase/filmFullscreen.js';

function fixture() {
  const doc = { fullscreenElement: null };
  const player = { ownerDocument: doc, requestFullscreen: vi.fn(async () => { doc.fullscreenElement = player; }) };
  return { player, video: {}, orientation: { lock: vi.fn().mockResolvedValue() } };
}

describe('film fullscreen across mobile browsers', () => {
  it('calls the iPhone native entry synchronously within the tap', async () => {
    const { player, video, orientation } = fixture();
    video.webkitEnterFullscreen = vi.fn();
    const result = enterFilmFullscreen(player, video, { mobile: true, orientation });
    expect(video.webkitEnterFullscreen).toHaveBeenCalledTimes(1);
    expect(await result).toBe('native');
    expect(player.requestFullscreen).not.toHaveBeenCalled();
  });
  it('locks landscape only after mobile element fullscreen succeeds', async () => {
    const { player, video, orientation } = fixture();
    orientation.lock.mockImplementation(async mode => {
      expect(player.ownerDocument.fullscreenElement).toBe(player);
      expect(mode).toBe('landscape');
    });
    expect(await enterFilmFullscreen(player, video, { mobile: true, orientation })).toBe('element');
    expect(orientation.lock).toHaveBeenCalledTimes(1);
  });
  it('retains fullscreen when the browser denies orientation locking', async () => {
    const { player, video, orientation } = fixture();
    orientation.lock.mockRejectedValue(new DOMException('Unsupported', 'NotSupportedError'));
    expect(await enterFilmFullscreen(player, video, { mobile: true, orientation })).toBe('element');
  });
  it('can exit safely when an exposed orientation unlock API is unsupported', () => {
    const orientation = { unlock: vi.fn(() => { throw new DOMException('Unsupported', 'NotSupportedError'); }) };
    expect(() => unlockFilmOrientation(orientation)).not.toThrow();
    expect(orientation.unlock).toHaveBeenCalledTimes(1);
  });
  it('tries element fullscreen when native video fullscreen is unavailable at the tap', async () => {
    const { player, video, orientation } = fixture();
    video.webkitEnterFullscreen = vi.fn(() => { throw new DOMException('Not ready', 'InvalidStateError'); });
    expect(await enterFilmFullscreen(player, video, { mobile: true, orientation })).toBe('element');
  });
  it('keeps desktop fullscreen free of orientation requests', async () => {
    const { player, video, orientation } = fixture();
    video.webkitEnterFullscreen = vi.fn();
    expect(await enterFilmFullscreen(player, video, { orientation })).toBe('element');
    expect(video.webkitEnterFullscreen).not.toHaveBeenCalled();
    expect(orientation.lock).not.toHaveBeenCalled();
  });
  it.each(['missing', 'rejected', 'no-op'])('opens the fallback for a %s fullscreen API', async failure => {
    const { player, video } = fixture();
    if (failure === 'missing') delete player.requestFullscreen;
    if (failure === 'rejected') player.requestFullscreen.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    if (failure === 'no-op') player.requestFullscreen.mockResolvedValue();
    expect(await enterFilmFullscreen(player, video)).toBe('fallback');
  });
});
