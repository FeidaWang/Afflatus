import { describe, expect, it, vi } from 'vitest';
import { createFilmPlayback, lockFilmPlaybackRate } from '../src/showcase/filmMotion.js';

function fixture(options = {}) {
  const doc = new EventTarget();
  doc.hidden = false;
  doc.defaultView = new EventTarget();
  const video = { ownerDocument: doc, play: vi.fn().mockResolvedValue(), pause: vi.fn() };
  let visibility;
  const disconnect = vi.fn();
  class Observer {
    constructor(callback) { visibility = showing => callback([{ target: video, isIntersecting: showing }]); }
    observe() {}
    disconnect = disconnect;
  }
  const ctl = createFilmPlayback(video, { ...options, Observer });
  return { ctl, video, doc, visibility: showing => visibility(showing), disconnect };
}

describe('homepage film playback intent', () => {
  it('suspends an autoplaying film off screen and resumes on return', () => {
    const { ctl, video, visibility } = fixture();
    expect(video.play).toHaveBeenCalledTimes(1);
    visibility(false);
    expect(video.pause).toHaveBeenCalledTimes(1);
    visibility(true);
    expect(video.play).toHaveBeenCalledTimes(2);
    ctl.destroy();
  });
  it('preserves an explicit pause across scroll, tab visibility and cinema closing', () => {
    const { ctl, video, doc, visibility } = fixture();
    ctl.pause();
    visibility(false); visibility(true);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    ctl.suspend(true); ctl.suspend(false);
    expect(video.play).toHaveBeenCalledTimes(1);
    ctl.play(); expect(video.play).toHaveBeenCalledTimes(2);
    ctl.destroy();
  });
  it('lets reduced-motion or save-data visitors choose to play explicitly', () => {
    const { ctl, video, visibility } = fixture({ autoplay: false });
    visibility(true); expect(video.play).not.toHaveBeenCalled();
    ctl.play(); expect(video.play).toHaveBeenCalledTimes(1);
    ctl.destroy();
  });
  it('restores playback after cinema only when it was requested before cinema', () => {
    const { ctl, video } = fixture();
    ctl.suspend(true); expect(video.pause).toHaveBeenCalledTimes(1);
    ctl.suspend(false); expect(video.play).toHaveBeenCalledTimes(2);
    ctl.destroy();
  });
  it('keeps the floating player active while the inline position is off screen', () => {
    const { ctl, video, doc, visibility } = fixture();
    visibility(false); ctl.setFloating(true);
    expect(video.play).toHaveBeenCalledTimes(2);
    visibility(false); expect(video.play).toHaveBeenCalledTimes(3);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    expect(video.pause).toHaveBeenCalledTimes(2);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    expect(video.play).toHaveBeenCalledTimes(4);
    ctl.setFloating(false); expect(video.pause).toHaveBeenCalledTimes(3);
    ctl.destroy();
  });
  it('preserves a manual pause when entering and leaving the floating player', () => {
    const { ctl, video, visibility } = fixture();
    ctl.pause(); visibility(false); ctl.setFloating(true); visibility(true); ctl.setFloating(false);
    expect(video.play).toHaveBeenCalledTimes(1);
    ctl.destroy();
  });
  it('ignores stale autoplay rejection after teardown and releases listeners', async () => {
    const onBlocked = vi.fn();
    const { ctl, video, doc, disconnect } = fixture({ autoplay: false, onBlocked });
    let reject;
    video.play.mockReturnValue(new Promise((_, no) => { reject = no; }));
    ctl.play(); ctl.destroy(); reject(new DOMException('Denied', 'NotAllowedError'));
    await Promise.resolve();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(video.play).toHaveBeenCalledTimes(1);
  });
  it('reports denied autoplay while leaving the explicit play control usable', async () => {
    const onBlocked = vi.fn();
    const { ctl, video } = fixture({ autoplay: false, onBlocked });
    video.play.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    ctl.play(); await Promise.resolve(); expect(onBlocked).toHaveBeenCalledTimes(1);
    ctl.play(); await Promise.resolve(); expect(video.play).toHaveBeenCalledTimes(2);
    ctl.destroy();
  });
});

describe('film normal-speed policy', () => {
  function media() {
    return Object.assign(new EventTarget(), { playbackRate: 1, defaultPlaybackRate: 1, paused: true, currentTime: 30 });
  }
  it.each([0.5, 1.5, 2])('restores a requested %sx speed without changing pause or progress', rate => {
    const video = media(), unlock = lockFilmPlaybackRate(video);
    video.playbackRate = rate;
    video.dispatchEvent(new Event('ratechange'));
    expect(video.playbackRate).toBe(1);
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(30);
    unlock();
  });
  it('resets existing speed and future playback defaults on installation and rate changes', () => {
    const video = media();
    video.playbackRate = 0.5; video.defaultPlaybackRate = 2;
    const unlock = lockFilmPlaybackRate(video);
    expect([video.playbackRate, video.defaultPlaybackRate]).toEqual([1, 1]);
    video.defaultPlaybackRate = 0.5;
    video.dispatchEvent(new Event('ratechange'));
    expect(video.defaultPlaybackRate).toBe(1);
    unlock();
  });
  it('releases its listener when the player is removed', () => {
    const video = media(), unlock = lockFilmPlaybackRate(video);
    unlock();
    video.playbackRate = 2;
    video.dispatchEvent(new Event('ratechange'));
    expect(video.playbackRate).toBe(2);
  });
});
