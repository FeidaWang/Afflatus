import { useEffect, useRef, useState } from 'react';
import { createOptionalScene } from '../lib/optionalScene.js';
import { initChapterReveals } from '../lib/chapterReveal.js';
import { isDecorativePaused, onDecorativePause, setDecorativePaused } from '../ui/homeMotionPreferences.js';

export function MediaMotion({ language }) {
  const ref = useRef(null), controller = useRef(null);
  const [state, setState] = useState('poster');
  const zh = language === 'zh';
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ctl = createOptionalScene({
      load: () => import('./posterScene.js').then(m => m.createPosterScene(ref.current.closest('.hero'))),
      onState: setState,
    });
    controller.current = ctl;
    ctl.setPaused(isDecorativePaused());
    const change = () => ctl.setReduced(reduced.matches);
    change();
    const chapters = initChapterReveals(document, { reduced, paused: isDecorativePaused });
    const unsubscribe = onDecorativePause(paused => { ctl.setPaused(paused); if (paused) chapters.cancel(); });
    reduced.addEventListener('change', change);
    return () => { reduced.removeEventListener('change', change); unsubscribe(); chapters.destroy(); ctl.destroy(); controller.current = null; };
  }, []);
  const labels = zh
    ? { poster: '开启缓慢动态', loading: '正在准备动态…', playing: '暂停动态', paused: '继续动态', failed: '重试动态', reduced: '静态海报 · 已减少动态效果' }
    : { poster: 'Enable slow motion', loading: 'Preparing motion…', playing: 'Pause motion', paused: 'Resume motion', failed: 'Retry motion', reduced: 'Static poster · reduced motion' };
  return <div className="hero-motion-control" ref={ref} data-motion-state={state}>
    <button type="button" disabled={state === 'reduced' || state === 'loading'} aria-pressed={state === 'playing'} onClick={() => {
      if (state === 'playing' || state === 'paused') setDecorativePaused(state === 'playing');
      else { setDecorativePaused(false); void controller.current?.toggle(); }
    }}>{labels[state]}</button>
    {state === 'failed' && <span role="status">{zh ? '动态暂不可用，静态海报保留。' : 'Motion unavailable. The static poster remains.'}</span>}
  </div>;
}
