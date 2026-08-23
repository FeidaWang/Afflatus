import { CONTENT_CASES, CONTENT_COLLECTIONS, contentMigrationById } from '../config/contentMigration.js';
import { MissionHeader, missionHref } from '../mission/MissionHeader.jsx';

function languageFromPath(pathname) {
  return pathname.startsWith('/zh/') ? 'zh' : 'en';
}

function routeKey(pathname) {
  const path = String(pathname || '/').replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
  if (path === '/capital/') return 'capital';
  if (path === '/capital/fy25-26/') return 'capital-record';
  if (path === '/intelligence/') return 'intelligence';
  if (path === '/intelligence/solar-atlas/') return 'solar-atlas';
  if (path === '/field-notes/') return 'field-notes';
  return 'experiments';
}

function routePathForKey(key) {
  return {
    capital: '/capital/',
    'capital-record': '/capital/fy25-26/',
    intelligence: '/intelligence/',
    'solar-atlas': '/intelligence/solar-atlas/',
    'field-notes': '/field-notes/',
    experiments: '/experiments/',
  }[key];
}

function label(value, language) {
  return value?.[language] ?? value?.en ?? value;
}

function ContentLink({ migration, language, featured = false }) {
  return (
    <a className={featured ? 'content-feature' : 'content-index-row'} href={missionHref(migration.destination, language)}>
      <span className="content-route-type">{migration.template.replace('-', ' ')}</span>
      <strong>{label(migration.subject, language)}</strong>
      <span aria-hidden="true">→</span>
    </a>
  );
}

function CollectionIndex({ collection, language }) {
  const featured = contentMigrationById(collection.featured);
  const complete = collection.items.map(contentMigrationById).filter(Boolean);
  return (
    <main className="content-template content-template--index">
      <section className="content-hero" aria-labelledby="content-title">
        <p className="content-eyebrow">{label(collection.eyebrow, language)}</p>
        <h1 id="content-title">{label(collection.title, language)}</h1>
        <p>{label(collection.introduction, language)}</p>
      </section>
      <section className="content-feature-panel" aria-labelledby="featured-heading">
        <p className="content-section-label" id="featured-heading">{language === 'zh' ? '重点入口' : 'Featured entry'}</p>
        <ContentLink migration={featured} language={language} featured />
      </section>
      <section className="content-complete-index" aria-labelledby="complete-heading">
        <p className="content-section-label" id="complete-heading">{language === 'zh' ? '完整索引' : 'Complete index'}</p>
        <div>{complete.map((migration) => <ContentLink key={migration.id} migration={migration} language={language} />)}</div>
      </section>
    </main>
  );
}

function CaseStudy({ study, language }) {
  const migration = contentMigrationById(study.migration);
  return (
    <main className="content-template content-template--case-study">
      <section className="content-hero content-hero--wide" aria-labelledby="content-title">
        <p className="content-eyebrow">{label(study.eyebrow, language)}</p>
        <h1 id="content-title">{label(study.title, language)}</h1>
        <p>{label(study.lede, language)}</p>
      </section>
      <section className="content-case-prose" aria-label={language === 'zh' ? '阅读说明' : 'Reading note'}>
        {label(study.paragraphs, language).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>
      <section className="content-breakout" aria-label={language === 'zh' ? '范围与保留项' : 'Scope and retained material'}>
        {label(study.breakout, language).map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}
      </section>
      <a className="content-source-action" href={missionHref(migration.source, language)}>
        {language === 'zh' ? '打开原始记录与图表' : 'Open original record and charts'} <span aria-hidden="true">→</span>
      </a>
    </main>
  );
}

export function ContentApp() {
  const language = languageFromPath(window.location.pathname);
  const key = routeKey(window.location.pathname);
  const collection = CONTENT_COLLECTIONS[key];
  const study = CONTENT_CASES[key];
  const routeId = collection?.routeId || study?.routeId || 'experiments';

  return (
    <div className="content-shell">
      <MissionHeader language={language} routeId={routeId} routePath={routePathForKey(key)} />
      {collection ? <CollectionIndex collection={collection} language={language} /> : <CaseStudy study={study} language={language} />}
      <footer className="content-footer">
        <a href={missionHref('/', language)}>{language === 'zh' ? '返回首页' : 'Return Home'}</a>
        <a href={missionHref('/command/', language)}>{language === 'zh' ? '进入任务舱' : 'Enter Command'}</a>
        <span>{language === 'zh' ? '内容归档 · M15' : 'CONTENT ARCHIVE · M15'}</span>
      </footer>
    </div>
  );
}
