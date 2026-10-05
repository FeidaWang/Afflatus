import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CornersOut, CornersIn, ArrowClockwise, ArrowCounterClockwise, Pause, Play, SpeakerHigh, PictureInPicture, Minus, X } from '@phosphor-icons/react';
import { createFilmDrag, createFilmPlayback, createFilmStretch, lockFilmPlaybackRate } from './filmMotion.js';

export const FILM_SOURCE = '/film/claude_clawd_pv/r07-mv/review/r07-stream-film-1080p-16x9.mp4';
export const FILM_POSTER = '/assets/film/afflatus-r07-poster.jpg';
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function FilmPlayer({ language }) {
  const zh = language === 'zh';
  const video = useRef(null), stage = useRef(null), frame = useRef(null), player = useRef(null);
  const playback = useRef(null), dialog = useRef(null), cinema = useRef(null), cinemaStart = useRef(0);
  const miniPosition = useRef(null), miniButton = useRef(null), miniControlsTimer = useRef(null), audibleVolume = useRef(1);
  const [playing, setPlaying] = useState(false), [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1), [miniControls, setMiniControls] = useState(false);
  const [elapsed, setElapsed] = useState(0), [duration, setDuration] = useState(213);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false), [mini, setMini] = useState(false);
  const [compact, setCompact] = useState(false);
  const [autoplay] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ctl = createFilmPlayback(video.current, { autoplay, onBlocked: () => setBlocked(true) });
    const unlockInlineRate = lockFilmPlaybackRate(video.current), unlockCinemaRate = lockFilmPlaybackRate(cinema.current);
    playback.current = ctl;
    const preference = () => { if (reduced.matches) ctl.pause(); };
    const full = () => setFullscreen(document.fullscreenElement === player.current);
    reduced.addEventListener('change', preference); document.addEventListener('fullscreenchange', full);
    return () => { reduced.removeEventListener('change', preference); document.removeEventListener('fullscreenchange', full); unlockInlineRate(); unlockCinemaRate(); ctl.destroy(); playback.current = null; };
  }, [autoplay]);
  useEffect(() => {
    if (!mini && !fullscreen) return createFilmStretch(stage.current, frame.current);
  }, [mini, fullscreen]);
  useLayoutEffect(() => {
    if (!mini || fullscreen) return;
    const drag = createFilmDrag(player.current, { position: miniPosition.current, onPosition: point => { miniPosition.current = point; } });
    return () => drag.destroy();
  }, [mini, fullscreen]);
  useEffect(() => {
    const hide = () => setMiniControls(false);
    window.addEventListener('blur', hide);
    return () => { window.removeEventListener('blur', hide); clearTimeout(miniControlsTimer.current); };
  }, []);
  const revealMiniControls = event => {
    if (!mini) return;
    clearTimeout(miniControlsTimer.current); setMiniControls(true);
    if (event.pointerType !== 'mouse') miniControlsTimer.current = setTimeout(() => setMiniControls(false), 2800);
  };
  const leaveMini = event => {
    if (event.pointerType === 'touch') return;
    clearTimeout(miniControlsTimer.current); setMiniControls(false);
  };
  const returnToPage = () => {
    clearTimeout(miniControlsTimer.current); setMiniControls(false); setMini(false); setCompact(false); playback.current?.setFloating(false);
    requestAnimationFrame(() => miniButton.current?.focus({ preventScroll: true }));
  };
  const toggleMini = async () => {
    if (mini) { returnToPage(); return; }
    if (document.fullscreenElement) await document.exitFullscreen();
    miniPosition.current = null; setMiniControls(false); playback.current?.setFloating(true); setMini(true);
  };
  const togglePlayback = () => {
    if (video.current.paused) { setBlocked(false); playback.current?.play(); }
    else playback.current?.pause();
  };
  const retryFilm = () => {
    setFailed(false); setReady(false); setBlocked(false);
    video.current.load(); playback.current?.play();
  };
  const seek = time => {
    if (!ready || failed) return;
    const next = Math.max(0, Math.min(duration, time));
    video.current.currentTime = next; setElapsed(next);
  };
  const changeVolume = value => {
    video.current.volume = Number(value); video.current.muted = Number(value) === 0;
  };
  const toggleSound = () => {
    if (video.current.muted && video.current.volume === 0) video.current.volume = audibleVolume.current;
    video.current.muted = !video.current.muted;
  };
  const openCinema = () => {
    cinemaStart.current = video.current.currentTime;
    playback.current?.suspend(true); dialog.current.showModal();
    if (cinema.current.readyState >= 1) cinema.current.currentTime = cinemaStart.current;
    cinema.current.volume = video.current.volume; cinema.current.muted = video.current.muted;
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
  <div className={`film-player${mini ? ' film-player--mini' : ''}${compact ? ' film-player--compact' : ''}${miniControls ? ' film-player--controls' : ''}`} ref={player} id="film" aria-label={zh ? 'AFFLATUS 宣传片播放器' : 'AFFLATUS film player'} onContextMenu={event => event.preventDefault()} onPointerEnter={revealMiniControls} onPointerDown={revealMiniControls} onPointerLeave={leaveMini}>
    <div className="film-stage" ref={stage}><div className="film-frame" ref={frame}>
      <video ref={video} className="premiere-film" src={FILM_SOURCE} poster={FILM_POSTER} width="1920" height="1080"
        autoPlay={autoplay} muted={muted} playsInline loop preload="metadata" controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture disableRemotePlayback aria-label={zh ? 'AFFLATUS 宣传片' : 'The AFFLATUS film'}
        onPlay={() => { setPlaying(true); setBlocked(false); }} onPause={() => setPlaying(false)}
        onVolumeChange={() => { setMuted(video.current.muted); setVolume(video.current.volume); if (video.current.volume > 0) audibleVolume.current = video.current.volume; }} onTimeUpdate={() => setElapsed(Math.floor(video.current.currentTime))}
        onLoadedMetadata={() => { if (Number.isFinite(video.current.duration)) { setDuration(video.current.duration); setReady(true); } }} onError={() => { setFailed(true); setPlaying(false); }} />
    <div className="film-mini-shade" aria-hidden="true" />
    {mini && !fullscreen && <div className="film-mini-toolbar">
      <button className="film-drag-handle film-brand" type="button" aria-label={zh ? 'rsiagent.app · 拖动或使用方向键移动小窗' : 'rsiagent.app · Move mini player with drag or arrow keys'} title={zh ? '拖动或使用方向键移动' : 'Drag or use arrow keys to move'}><img className="film-brand-mark" src="/assets/film/rsiagent-mark.png" width="32" height="32" alt="" /><span>rsiagent.app</span></button>
      <div className="film-window-actions">
        <button className="icon-button" type="button" onClick={() => setCompact(value => !value)} aria-pressed={compact} aria-label={compact ? (zh ? '展开小窗' : 'Expand mini player') : (zh ? '缩小小窗' : 'Minimize mini player')}><Minus weight="bold" /></button>
        <button className="icon-button" type="button" onClick={returnToPage} aria-label={zh ? '返回页面播放' : 'Return film to page'} title={zh ? '返回页面播放' : 'Return film to page'}><img className="film-pip-restore" src="/assets/film/player-back-to-tab.svg" width="24" height="24" alt="" /></button>
        <button className="icon-button" type="button" onClick={returnToPage} aria-label={zh ? '关闭小窗并返回页面' : 'Close mini player and return to page'}><X weight="bold" /></button>
      </div>
    </div>}
    <div className="film-mini-playback" hidden={!mini || fullscreen}>
      <button className="icon-button film-skip" type="button" onClick={() => seek(video.current.currentTime - 10)} disabled={!ready || failed} aria-label={zh ? '后退 10 秒' : 'Rewind 10 seconds'}><ArrowCounterClockwise weight="bold" aria-hidden="true" /><span aria-hidden="true">10</span></button>
      <button className="icon-button film-center-play" type="button" onClick={togglePlayback} disabled={failed} aria-label={playing ? (zh ? '暂停影片' : 'Pause film') : (zh ? '播放影片' : 'Play film')}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button>
      <button className="icon-button film-skip" type="button" onClick={() => seek(video.current.currentTime + 10)} disabled={!ready || failed} aria-label={zh ? '快进 10 秒' : 'Forward 10 seconds'}><ArrowClockwise weight="bold" aria-hidden="true" /><span aria-hidden="true">10</span></button>
    </div>
    <div className="film-controls">
      <button className="icon-button film-inline-play" type="button" onClick={togglePlayback} disabled={failed} aria-label={playing ? (zh ? '暂停影片' : 'Pause film') : (zh ? '播放影片' : 'Play film')}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button>
      <span className="film-time"><span>{clock(elapsed)}</span> / {clock(duration)}</span>
      <div className="film-volume-control">
        <button className="icon-button film-volume" type="button" onClick={toggleSound} disabled={failed} aria-label={muted ? (zh ? '开启声音' : 'Turn sound on') : (zh ? '静音' : 'Mute film')} aria-pressed={!muted}>{muted ? <img className="film-control-glyph" src="/assets/film/player-volume-off.svg" width="24" height="24" alt="" /> : <SpeakerHigh weight="fill" />}</button>
        <div className="film-volume-panel"><input className="film-volume-seek" type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} style={{ '--film-volume': `${muted ? 0 : volume * 100}%` }} disabled={failed} aria-label={zh ? '影片音量' : 'Film volume'} aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`} onChange={event => changeVolume(event.target.value)} /></div>
      </div>
      <button className="icon-button film-mini-toggle" ref={miniButton} type="button" onClick={toggleMini} aria-pressed={mini} aria-label={mini ? (zh ? '返回页面播放' : 'Return film to page') : (zh ? '小窗播放' : 'Open mini player')} title={mini ? (zh ? '返回页面播放' : 'Return film to page') : (zh ? '小窗播放' : 'Open mini player')}><PictureInPicture /></button>
      <button className="icon-button film-fullscreen" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? (zh ? '退出全屏' : 'Exit fullscreen') : (zh ? '进入全屏' : 'Enter fullscreen')}>{fullscreen ? <CornersIn weight="bold" /> : <CornersOut weight="bold" />}</button>
      <input className="film-seek" type="range" min="0" max={duration} step="1" value={elapsed} style={{ '--film-progress': `${elapsed / duration * 100}%`, '--film-progress-ratio': elapsed / duration }} disabled={!ready || failed} aria-label={zh ? '影片播放进度' : 'Seek film'} aria-valuetext={`${clock(elapsed)} / ${clock(duration)}`} onChange={event => seek(Number(event.target.value))} />
    </div>
    </div></div>
    {(failed || blocked) && <p className="film-status" role="status">{failed ? (zh ? '影片暂时无法加载。' : 'The film could not be loaded.') : (zh ? '点击播放即可开始观看。' : 'Press play to start the film.')}{failed && <button type="button" onClick={retryFilm}>{zh ? '重试播放' : 'Retry playback'}</button>}</p>}
    <dialog className="film-dialog" ref={dialog} aria-labelledby="cinema-title" onClose={closeCinema} onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}>
      <div className="cinema-heading"><h2 id="cinema-title">{zh ? 'AFFLATUS 宣传片' : 'The AFFLATUS film'}</h2><button className="icon-button" type="button" autoFocus onClick={() => dialog.current.close()} aria-label={zh ? '关闭影片' : 'Close film'}><X /></button></div>
      <video ref={cinema} src={FILM_SOURCE} poster={FILM_POSTER} controls playsInline preload="none" controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture disableRemotePlayback aria-label={zh ? '完整影片' : 'Full film'} onLoadedMetadata={() => { cinema.current.currentTime = cinemaStart.current; }} />
    </dialog>
  </div>
  <div className="film-inline-placeholder" hidden={!mini}>
    <div className="film-stage"><button type="button" onClick={returnToPage} title={zh ? '返回页面播放' : 'Return film to page'}>{zh ? '正在小窗播放' : 'Playing in picture-in-picture'}</button></div>
  </div>
  </div>;
}
