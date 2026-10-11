// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { mountCompanionAudio } from '../src/lib/companionAudio.js';

afterEach(()=>vi.unstubAllGlobals());
it('never autoplays a restored track and updates controls after explicit play and pause',async()=>{
  const source=readFileSync('serial.html','utf8');
  document.documentElement.innerHTML=source;
  let audio;
  class AudioMock extends EventTarget{
    paused=true;ended=false;currentTime=0;duration=120;
    constructor(){super();audio=this;}
    play=vi.fn(async()=>{this.paused=false;this.dispatchEvent(new Event('play'));});
    pause=vi.fn(()=>{this.paused=true;this.dispatchEvent(new Event('pause'));});
  }
  vi.stubGlobal('Audio',AudioMock);
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({tracks:[{src:'/one.mp3',title:'First'},{src:'/two.mp3',title:'Second'}]})})));
  await mountCompanionAudio({store:{getState:()=>({audioTrack:1}),setAudioTrack:vi.fn()}});
  expect(audio.src).toBe('/two.mp3');expect(audio.play).not.toHaveBeenCalled();
  const play=document.getElementById('plToggle');
  play.click();await Promise.resolve();
  expect(audio.play).toHaveBeenCalledOnce();expect(play.getAttribute('aria-pressed')).toBe('true');
  play.click();expect(audio.paused).toBe(true);expect(play.getAttribute('aria-pressed')).toBe('false');
  expect(document.getElementById('trackTitle').textContent).toBe('Second');
});
