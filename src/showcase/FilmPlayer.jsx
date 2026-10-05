import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowsOut, ArrowsIn, Pause, Play, SpeakerSlash, SpeakerHigh, PictureInPicture, DotsSix, X } from '@phosphor-icons/react';
import { createFilmDrag, createFilmPlayback, createFilmStretch } from './filmMotion.js';

export const FILM_SOURCE = '/assets/film/afflatus-r07-1080p.mp4';
export const FILM_POSTER = '/assets/film/afflatus-r07-poster.jpg';
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function FilmPlayer({ language }) {
  const zh = language === 'zh';
  const video = useRef(null), stage = useRef(null), frame = useRef(null), player = useRef(null);
  const playback = useRef(null), dialog = useRef(null), cinema = useRef(null), cinemaStart = useRef(0);
  const miniPosition = useRef(null), miniButton = useRef(null);
  const [playing, setPlaying] = useState(false), [muted, setMuted] = useState(true);
  const [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState(213);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false), [mini, setMini] = useState(false);
  const [autoplay] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ctl = createFilmPlayback(video.current, { autoplay, onBlocked: () => setBlocked(true) });
    playback.current = ctl;
    const preference = () => { if (reduced.matches) ctl.pause(); };
    const full = () => setFullscreen(document.fullscreenElement === player.current);
    reduced.addEventListener('change', preference); document.addEventListener('fullscreenchange', full);
    return () => { reduced.removeEventListener('change', preference); document.removeEventListener('fullscreenchange', full); ctl.destroy(); playback.current = null; };
  }, [autoplay]);
  useEffect(() => {
    if (!mini && !fullscreen) return createFilmStretch(stage.current, frame.current);
  }, [mini, fullscreen]);
  useLayoutEffect(() => {
    if (!mini || fullscreen) return;
    const drag = createFilmDrag(player.current, { position: miniPosition.current, onPosition: point => { miniPosition.current = point; } });
    return () => drag.destroy();
  }, [mini, fullscreen]);
  const returnToPage = () => {
    setMini(false); playback.current?.setFloating(false);
    requestAnimationFrame(() => miniButton.current?.focus({ preventScroll: true }));
  };
  const toggleMini = async () => {
    if (mini) { returnToPage(); return; }
    if (document.fullscreenElement) await document.exitFullscreen();
    miniPosition.current = null; playback.current?.setFloating(true); setMini(true);
  };
  const togglePlayback = () => {
    if (video.current.paused) { setBlocked(false); playback.current?.play(); }
    else playback.current?.pause();
  };
  const openCinema = () => {
    cinemaStart.current = video.current.currentTime;
    playback.current?.suspend(true); dialog.current.showModal();
    if (cinema.current.readyState >= 1) cinema.current.currentTime = cinemaStart.current;
    cinema.current.muted = false;
    void cinema.current.play().catch(() => {});
  };
  const closeCinema = () => {
    if (cinema.current.readyState >= 1 && video.current.readyState >= 1) video.current.currentTime = cinema.current.currentTime;
    cinema.current.pause(); playback.current?.suspend(false);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    try {
      if (!player.current.requestFullscreen) { openCinema(); return; }
      await player.current.requestFullscreen();
      if (document.fullscreenElement !== player.current) openCinema();
    } catch { openCinema(); }
  };
  return <div className="film-shell">
  <div className={`film-player${mini ? ' film-player--mini' : ''}`} ref={player} id="film" aria-label={zh ? 'AFFLATUS 宣传片播放器' : 'AFFLATUS film player'}>
    <div className="film-mini-toolbar" hidden={!mini || fullscreen}>
      <button className="film-drag-handle" type="button" aria-label={zh ? '移动小窗，支持拖动或方向键' : 'Move mini player with drag or arrow keys'} title={zh ? '拖动或使用方向键移动' : 'Drag or use arrow keys to move'}><DotsSix aria-hidden="true" /><span>{zh ? '小窗播放' : 'Mini player'}</span></button>
      <button className="icon-button" type="button" onClick={returnToPage} aria-label={zh ? '关闭小窗并返回页面' : 'Close mini player and return to page'}><X /></button>
    </div>
    <div className="film-stage" ref={stage}><div className="film-frame" ref={frame}>
      <video ref={video} className="premiere-film" src={FILM_SOURCE} poster={FILM_POSTER} width="1616" height="1080"
        autoPlay={autoplay} muted={muted} playsInline loop preload="metadata" aria-label={zh ? 'AFFLATUS 宣传片' : 'The AFFLATUS film'}
        onPlay={() => { setPlaying(true); setBlocked(false); }} onPause={() => setPlaying(false)}
        onVolumeChange={() => setMuted(video.current.muted)} onTimeUpdate={() => setElapsed(Math.floor(video.current.currentTime))}
        onLoadedMetadata={() => { setDuration(video.current.duration); setReady(true); }} onError={() => { setFailed(true); setPlaying(false); }} />
    </div></div>
    <div className="film-controls">
      <button className="icon-button" type="button" onClick={togglePlayback} disabled={failed} aria-label={playing ? (zh ? '暂停影片' : 'Pause film') : (zh ? '播放影片' : 'Play film')}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button>
      <button className="icon-button" type="button" onClick={() => { video.current.muted = !video.current.muted; }} disabled={failed} aria-label={muted ? (zh ? '开启声音' : 'Turn sound on') : (zh ? '静音' : 'Mute film')} aria-pressed={!muted}>{muted ? <SpeakerSlash /> : <SpeakerHigh />}</button>
      <span className="film-time"><span>{clock(elapsed)}</span> / {clock(duration)}</span>
      <input className="film-seek" type="range" min="0" max={duration} step="1" value={elapsed} disabled={!ready || failed} aria-label={zh ? '影片播放进度' : 'Seek film'} aria-valuetext={`${clock(elapsed)} / ${clock(duration)}`} onChange={event => { const time = Number(event.target.value); video.current.currentTime = time; setElapsed(time); }} />
      <button className="icon-button film-fullscreen" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? (zh ? '退出全屏' : 'Exit fullscreen') : (zh ? '进入全屏' : 'Enter fullscreen')}>{fullscreen ? <ArrowsIn /> : <ArrowsOut />}</button>
      <button className="icon-button film-mini-toggle" ref={miniButton} type="button" onClick={toggleMini} aria-pressed={mini} aria-label={mini ? (zh ? '返回页面播放' : 'Return film to page') : (zh ? '小窗播放' : 'Open mini player')} title={mini ? (zh ? '返回页面播放' : 'Return film to page') : (zh ? '小窗播放' : 'Open mini player')}><PictureInPicture /></button>
    </div>
    {(failed || blocked) && <p className="film-status" role="status">{failed ? (zh ? '影片暂时无法加载。' : 'The film could not be loaded.') : (zh ? '点击播放即可开始观看。' : 'Press play to start the film.')}{failed && <a href={FILM_SOURCE}>{zh ? '直接打开影片' : 'Open the film directly'}</a>}</p>}
    <dialog className="film-dialog" ref={dialog} aria-labelledby="cinema-title" onClose={closeCinema} onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}>
      <div className="cinema-heading"><h2 id="cinema-title">{zh ? 'AFFLATUS 宣传片' : 'The AFFLATUS film'}</h2><button className="icon-button" type="button" autoFocus onClick={() => dialog.current.close()} aria-label={zh ? '关闭影片' : 'Close film'}><X /></button></div>
      <video ref={cinema} src={FILM_SOURCE} poster={FILM_POSTER} controls playsInline preload="none" aria-label={zh ? '完整影片' : 'Full film'} onLoadedMetadata={() => { cinema.current.currentTime = cinemaStart.current; }} />
      <a href={FILM_SOURCE}>{zh ? '直接打开影片' : 'Open the film directly'}</a>
    </dialog>
  </div>
  <div className="film-inline-placeholder" hidden={!mini}>
    <div className="film-stage"><img className="film-poster" src={FILM_POSTER} width="1616" height="1080" alt="" /><button type="button" onClick={returnToPage}>{zh ? '影片已移至小窗 · 返回页面' : 'Film is in the mini player · Return to page'}</button></div>
  </div>
  </div>;
}
