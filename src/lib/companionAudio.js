export async function mountCompanionAudio({ store }) {
  const $ = (id) => document.getElementById(id);
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = 0.32;
  let tracks = [], index = 0, sleepTimer = 0, sleepAt = 0;
  const failed = new Set();
  const time = (value) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';
  function sync() {
    const playing = !audio.paused && !audio.ended;
    $('plToggle').setAttribute('aria-pressed', String(playing));
    $('plToggle').setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
    $('plToggle').querySelector('img').src = `/assets/labs/icons/${playing ? 'pause' : 'play'}.svg`;
    $('musicSeek').disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
    $('musicSeek').value = Number.isFinite(audio.duration) && audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
    $('musicTime').textContent = `${time(audio.currentTime)} / ${time(audio.duration)}`;
    if (navigator.mediaSession) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
  function pause() { audio.pause(); sync(); }
  async function play() {
    if (failed.size === tracks.length) { failed.clear(); load(index); }
    window.dispatchEvent(new CustomEvent('afflatus-media-play', { detail: { source: 'ambient' } }));
    try { await audio.play(); $('musicStatus').textContent = ''; }
    catch (error) { if (error.name !== 'AbortError') $('musicStatus').textContent = '暂时无法播放，请检查网络后重试或切换曲目。'; }
    sync();
  }
  function load(next) {
    index = (next + tracks.length) % tracks.length;
    const track = tracks[index];
    audio.src = track.src;
    $('trackTitle').textContent = track.title || '伴读音乐';
    $('trackArtist').textContent = track.artist || 'AFFLATUS · 伴读';
    store.setAudioTrack(index);
    if (navigator.mediaSession && typeof MediaMetadata !== 'undefined') navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: 'AFFLATUS · 伴读' });
    sync();
  }
  function step(direction, resume = !audio.paused) { load(index + direction); if (resume) play(); }
  $('plToggle').addEventListener('click', () => audio.paused ? play() : pause());
  $('plPrev').addEventListener('click', () => step(-1));
  $('plNext').addEventListener('click', () => step(1));
  $('musicSeek').addEventListener('input', () => { if (Number.isFinite(audio.duration)) audio.currentTime = (Number($('musicSeek').value) / 100) * audio.duration; });
  $('musicVolume').addEventListener('input', () => { audio.volume = Number($('musicVolume').value) / 100; });
  $('musicSleep').addEventListener('change', () => {
    clearTimeout(sleepTimer);
    const minutes = Number($('musicSleep').value);
    sleepAt = minutes ? Date.now() + minutes * 60000 : 0;
    if (minutes) sleepTimer = setTimeout(endSleep, minutes * 60000);
    $('musicStatus').textContent = minutes ? `${minutes} 分钟后暂停音乐。` : '已取消睡眠定时。';
  });
  function endSleep() { pause(); sleepAt = 0; $('musicSleep').value = '0'; $('musicStatus').textContent = '睡眠定时结束，音乐已暂停。'; }
  audio.addEventListener('timeupdate', () => { if (sleepAt && Date.now() >= sleepAt) endSleep(); sync(); });
  for (const event of ['play', 'pause', 'loadedmetadata', 'durationchange']) audio.addEventListener(event, sync);
  audio.addEventListener('ended', () => step(1, true));
  audio.addEventListener('error', () => { failed.add(index); pause(); $('musicStatus').textContent = '这首曲目暂时不可用，请重试或切换下一曲。'; });
  window.addEventListener('afflatus-media-play', (event) => { if (event.detail?.source === 'narration') pause(); });
  window.addEventListener('pagehide', () => { pause(); clearTimeout(sleepTimer); });
  if (navigator.mediaSession) {
    for (const [action, handler] of Object.entries({ play, pause, previoustrack: () => step(-1), nexttrack: () => step(1), seekto: ({ seekTime }) => { if (Number.isFinite(seekTime)) audio.currentTime = seekTime; } })) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Browser lacks this optional control. */ }
    }
  }
  try {
    const response = await fetch('/audio/playlist.json');
    if (!response.ok) throw new Error('Playlist unavailable');
    const data = await response.json();
    tracks = (data.tracks || []).filter((track) => track?.src && /\.mp3(?:[?#]|$)/i.test(track.src));
    if (!tracks.length) throw new Error('Empty playlist');
    $('ambientPlayer').hidden = false;
    $('audioEmpty').hidden = true;
    load(Math.min(store.getState().audioTrack, tracks.length - 1));
  } catch { $('audioEmpty').textContent = '伴读音乐暂不可用，稍后重新打开页面即可重试。'; }
}
