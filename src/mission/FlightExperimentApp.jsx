import { useEffect, useState } from 'react';
import { MissionHeader, missionHref } from './MissionHeader.jsx';

const copy = {
  en: {
    eyebrow: 'Experiment / Flight Simulation',
    title: 'Flight systems, isolated.',
    intro: 'This route preserves the game-like flight and combat prototype without presenting it as real operational telemetry.',
    notice: 'Experimental simulation — not a live business, capital, weapons or safety system.',
    retained: 'Retained in the legacy simulation',
    launch: 'Launch Legacy Flight Simulation',
    migration: 'The previous Deck remains available at its original Portfolio route. This launcher keeps that route stable while public Command moves to the Mission Room.',
    command: 'Open Mission Room',
    home: 'Return Home',
  },
  zh: {
    eyebrow: '实验 / 飞行模拟',
    title: '隔离飞行系统。',
    intro: '此路由保留游戏化飞行与战斗原型，但不会把它描述成真实运营遥测。',
    notice: '实验性模拟——并非实时业务、资本、武器或安全系统。',
    retained: '旧版模拟中保留',
    launch: '启动旧版飞行模拟',
    migration: '旧版 Deck 仍保留在原 Portfolio 路由。本启动页保持旧路由稳定，同时公开 Command 已迁往 Mission Room。',
    command: '打开任务舱',
    home: '返回首页',
  },
};

const systems = [
  { name: 'NAV / COMBAT', description: { en: 'Mode switching and flight simulation', zh: '模式切换与飞行模拟' } },
  { name: 'RADAR', description: { en: 'Decorative tactical contact display', zh: '装饰性战术接触显示' } },
  { name: 'WEAPONS', description: { en: 'Simulated fire-control interactions', zh: '模拟火控交互' } },
  { name: 'SHIELDS', description: { en: 'Simulated defense state', zh: '模拟防御状态' } },
  { name: 'G-FORCE', description: { en: 'Simulated manoeuvre feedback', zh: '模拟机动反馈' } },
];

function useDebugFps(enabled) {
  const [fps, setFps] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    const sample = (now) => {
      frames += 1;
      if (now - windowStart >= 500) {
        setFps(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0;
        windowStart = now;
      }
      raf = window.requestAnimationFrame(sample);
    };
    raf = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(raf);
  }, [enabled]);
  return fps;
}

export function FlightExperimentApp() {
  const language = window.location.pathname.startsWith('/zh/') ? 'zh' : 'en';
  const t = copy[language];
  const debugEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('flight-debug') === '1';
  const fps = useDebugFps(debugEnabled);

  return (
    <div className="mission-shell mission-shell--flight">
      <div className="mission-drift" aria-hidden="true" />
      <MissionHeader language={language} routeId="flight-experiment" />
      <main className="flight-main">
        <section className="flight-hero" aria-labelledby="flight-title">
          <p className="mission-eyebrow">{t.eyebrow}</p>
          <h1 id="flight-title">{t.title}</h1>
          <p className="mission-intro">{t.intro}</p>
          <p className="experiment-notice">{t.notice}</p>
          {debugEnabled ? <output className="flight-fps-debug">FPS {fps ?? '—'} · DEV DEBUG</output> : null}
        </section>
        <section className="flight-systems" aria-labelledby="retained-title">
          <p className="mission-label" id="retained-title">{t.retained}</p>
          <div className="flight-system-list">
            {systems.map((system, index) => (
              <article key={system.name}>
                <span>0{index + 1}</span>
                <h2>{system.name}</h2>
                <p>{system.description[language]}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="flight-launch">
          <p>{t.migration}</p>
          <a className="mission-action mission-action--primary" href="/portfolio.html?mode=flight">{t.launch} <span aria-hidden="true">→</span></a>
        </section>
      </main>
      <footer className="mission-footer">
        <a href={missionHref('/', language)}>{t.home}</a>
        <a href={missionHref('/command/', language)}>{t.command}</a>
        <span>EXPERIMENT · SIMULATED SYSTEMS</span>
      </footer>
    </div>
  );
}
