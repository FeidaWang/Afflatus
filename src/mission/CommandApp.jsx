import { useRef, useState } from 'react';
import { MissionHeader, missionHref } from './MissionHeader.jsx';

const OPERATING_MODES = [
  {
    id: 'observe',
    label: { en: 'Observe', zh: '观察' },
    title: { en: 'Collect the signal.', zh: '收集信号。' },
    body: {
      en: 'Read primary records, preserve provenance, and mark the review window before changing a belief.',
      zh: '阅读一手记录，保留来源，并在改变判断之前明确复核窗口。',
    },
    state: { en: 'Current signal published 2026.08.21', zh: '当前信号发布于 2026.08.21' },
  },
  {
    id: 'model',
    label: { en: 'Model', zh: '建模' },
    title: { en: 'Make the boundary explicit.', zh: '明确模型边界。' },
    body: {
      en: 'Separate evidence from inference, record uncertainty, and test whether the decision survives adverse paths.',
      zh: '区分证据与推断，记录不确定性，并检验决策能否穿越不利路径。',
    },
    state: { en: 'No live forecast feed connected', zh: '未连接实时预测数据' },
  },
  {
    id: 'commit',
    label: { en: 'Commit', zh: '执行' },
    title: { en: 'Act only when earned.', zh: '只在证据充分时行动。' },
    body: {
      en: 'Choose the smallest reversible action, name its owner, and define the condition that changes the plan.',
      zh: '选择最小且可逆的行动，明确负责人，并定义改变计划的条件。',
    },
    state: { en: 'No account or deployment control connected', zh: '未连接账户或部署控制' },
  },
];

const copy = {
  en: {
    eyebrow: 'AFFLATUS-01 / Mission Room',
    title: 'Command what is real.',
    intro: 'A quiet operating surface for the objective, the trajectory and the next evidence-backed action.',
    objective: 'Current Objective',
    objectiveValue: 'Preserve capital while maintaining optionality.',
    trajectory: 'Current Trajectory',
    next: 'Next Action',
    nextValue: 'Review long-end signal',
    dossier: 'Open Dossier',
    modes: 'Operating loop',
    unavailable: 'Unavailable state',
    unavailableBody: 'No live account values, positions, deployment health, sensor feeds or combat telemetry are connected to this public page.',
    asOf: 'Declared state · as of 2026.08.21',
    experiment: 'Open Flight Experiment',
    home: 'Return Home',
  },
  zh: {
    eyebrow: 'AFFLATUS-01 / 任务舱',
    title: '指挥真实存在的系统。',
    intro: '一个安静的运行界面，只呈现目标、轨迹与下一项有证据支持的行动。',
    objective: '当前目标',
    objectiveValue: '保存资本，同时保持选择权。',
    trajectory: '当前轨迹',
    next: '下一步行动',
    nextValue: '复核长端信号',
    dossier: '打开档案',
    modes: '运行闭环',
    unavailable: '不可用状态',
    unavailableBody: '此公开页面未连接实时账户数值、仓位、部署健康、传感器或战斗遥测。',
    asOf: '声明状态 · 截至 2026.08.21',
    experiment: '打开飞行实验',
    home: '返回首页',
  },
};

const trajectories = [
  { system: { en: 'Capital', zh: '资本' }, status: { en: 'Stable', zh: '稳定' }, note: { en: 'FY25/26 field record published; live account state unavailable.', zh: 'FY25/26 现场记录已发布；实时账户状态不可用。' } },
  { system: { en: 'Software', zh: '软件' }, status: { en: 'Building', zh: '构建中' }, note: { en: 'Site delivery and field-course work are in progress.', zh: '网站交付与实战课程仍在推进。' } },
  { system: { en: 'Intelligence', zh: '情报' }, status: { en: 'Observing', zh: '观察中' }, note: { en: 'The current long-end dossier is available for review.', zh: '当前长端档案可供复核。' } },
];

const pick = (value, language) => value[language];

export function CommandApp() {
  const language = window.location.pathname.startsWith('/zh/') ? 'zh' : 'en';
  const t = copy[language];
  const [activeMode, setActiveMode] = useState('observe');
  const tabRefs = useRef([]);
  const active = OPERATING_MODES.find((mode) => mode.id === activeMode) || OPERATING_MODES[0];

  const moveTab = (event, currentIndex) => {
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % OPERATING_MODES.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + OPERATING_MODES.length) % OPERATING_MODES.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = OPERATING_MODES.length - 1;
    else return;
    event.preventDefault();
    setActiveMode(OPERATING_MODES[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="mission-shell mission-shell--command">
      <div className="mission-drift" aria-hidden="true" />
      <MissionHeader language={language} routeId="command" />
      <main className="mission-main">
        <section className="mission-hero" aria-labelledby="command-title">
          <p className="mission-eyebrow">{t.eyebrow}</p>
          <h1 id="command-title">{t.title}</h1>
          <p className="mission-intro">{t.intro}</p>
          <p className="mission-asof">{t.asOf}</p>
        </section>

        <section className="mission-board" aria-label={t.objective}>
          <article className="mission-objective">
            <p className="mission-label">{t.objective}</p>
            <h2>{t.objectiveValue}</h2>
          </article>
          <article className="mission-next">
            <p className="mission-label">{t.next}</p>
            <h2>{t.nextValue}</h2>
            <a className="mission-action" href={missionHref('/signal.html', language)}>{t.dossier} <span aria-hidden="true">→</span></a>
          </article>
        </section>

        <section className="mission-trajectory" aria-labelledby="trajectory-title">
          <p className="mission-label" id="trajectory-title">{t.trajectory}</p>
          <div className="trajectory-list">
            {trajectories.map((item) => (
              <article className="trajectory-row" key={item.system.en}>
                <h3>{pick(item.system, language)}</h3>
                <strong>{pick(item.status, language)}</strong>
                <p>{pick(item.note, language)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="operating-loop" aria-labelledby="operating-loop-title">
          <p className="mission-label" id="operating-loop-title">{t.modes}</p>
          <div className="operating-tabs" role="tablist" aria-label={t.modes}>
            {OPERATING_MODES.map((mode, index) => (
              <button
                aria-controls={`mode-panel-${mode.id}`}
                aria-selected={activeMode === mode.id}
                className="operating-tab"
                id={`mode-tab-${mode.id}`}
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                onKeyDown={(event) => moveTab(event, index)}
                ref={(node) => { tabRefs.current[index] = node; }}
                role="tab"
                tabIndex={activeMode === mode.id ? 0 : -1}
                type="button"
              >
                <span>0{index + 1}</span>{pick(mode.label, language)}
              </button>
            ))}
          </div>
          <div className="operating-panel" id={`mode-panel-${active.id}`} role="tabpanel" aria-labelledby={`mode-tab-${active.id}`}>
            <h2>{pick(active.title, language)}</h2>
            <p>{pick(active.body, language)}</p>
            <span data-state={active.id === 'observe' ? 'available' : 'unavailable'}>{pick(active.state, language)}</span>
          </div>
        </section>

        <aside className="mission-unavailable" data-state="unavailable" aria-labelledby="unavailable-title">
          <p className="mission-label" id="unavailable-title">{t.unavailable}</p>
          <p>{t.unavailableBody}</p>
        </aside>
      </main>
      <footer className="mission-footer">
        <a href={missionHref('/', language)}>{t.home}</a>
        <a href={missionHref('/experiments/flight/', language)}>{t.experiment}</a>
        <span>MISSION ROOM · NO FICTIONAL TELEMETRY</span>
      </footer>
    </div>
  );
}
