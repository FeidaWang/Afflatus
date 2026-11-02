import { useEffect, useRef, useState } from 'react';
import { TOPICS, TOPIC_GROUPS } from '../../config/topics.js';
import { RelatedMenu, Text } from '../../showcase/RelatedPopover.jsx';
import { navigationHref } from '../../lib/siteNavigation.js';
import { entryHref, loadTopicsIndex, topicEntries, topicHref } from '../../showcase/topicsIndex.js';
import { parseSearchQuery, searchEntries } from './topicQuery.js';

const COPY = {
  overview: { en: 'Topic overview', zh: '专题总览' },
  allTopics: { en: 'All topics', zh: '全部专题' },
  unknown: { en: 'That topic does not exist. Choose one of these instead.', zh: '没有这个专题，可以从下面选择一个。' },
  failed: { en: 'The topic list could not be loaded. Please reload the page.', zh: '专题列表暂时无法加载，请刷新页面重试。' },
  loadMore: { en: 'Load more', zh: '加载更多' },
  searchLabel: { en: 'Search this site', zh: '搜索本站' },
  searchPlaceholder: { en: 'Search titles and summaries', zh: '搜索标题和摘要' },
  searchButton: { en: 'Search', zh: '搜索' },
  searchResults: { en: 'Search results', zh: '搜索结果' },
  searchScope: { en: 'Searches page titles and summaries, not the full text of chapters.', zh: '搜索范围是页面标题和摘要，不含章节正文。' },
  noResults: { en: 'Nothing matched. Try another word, or choose a topic below.', zh: '没有找到相关内容。可以换个词，或从下面选择一个专题。' },
};
const PAGE_SIZE = 10;
const resultCount = (count) => ({ en: `${count} ${count === 1 ? 'result' : 'results'}`, zh: `${count} 条结果` });

// Cover positions by centre point and base size, ordered so a short topic still spreads out.
const MOSAIC_SLOTS = [[48, 48, 96, 72], [62, 12, 80, 60], [14, 78, 84, 62], [84, 78, 62, 62], [14, 14, 72, 86], [78, 50, 66, 84], [40, 86, 60, 76], [88, 18, 60, 78], [36, 20, 64, 64], [62, 84, 72, 54], [18, 46, 58, 58]];
const mosaicScale = (count) => (count === 1 ? 3 : count <= 3 ? 2.2 : count <= 6 ? 1.7 : 1.3);

function TopicMosaic({ entries, language }) {
  // Oldest first, so a long course shows its companion pages rather than only its weeks.
  const covers = entries.filter((entry) => entry.cover).reverse().slice(0, MOSAIC_SLOTS.length);
  const scale = mosaicScale(covers.length);
  return <div className="topic-mosaic" aria-hidden="true">
    {covers.map((entry, index) => {
      const [x, y, width, height] = MOSAIC_SLOTS[index];
      return <img
        key={entry.id}
        src={entry.cover[language]}
        alt=""
        width={Math.round(width * scale)}
        height={Math.round(height * scale)}
        decoding="async"
        style={{ left: `${x}%`, top: `${y}%`, '--tile-width': width * scale, '--tile-height': height * scale, objectPosition: `${(index * 37) % 100}% 50%` }}
      />;
    })}
  </div>;
}

function TopicResult({ entry, topicId, groups, language }) {
  return <article className="topic-result">
    <p className="topic-result-meta"><Text copy={groups[entry.group]} language={language} />{entry.date && <Text as="time" dateTime={entry.date.iso} copy={entry.date.label} language={language} />}</p>
    <h2><a href={entryHref(entry.url, language)}><Text copy={entry.title} language={language} /></a></h2>
    <Text as="p" className="topic-result-summary" copy={entry.summary} language={language} />
    <RelatedMenu url={entry.url} topicId={topicId} label={entry.title} language={language} />
  </article>;
}

function TopicDirectory({ index, language }) {
  return TOPICS.map((topic) => <article key={topic.id} className="topic-result">
    <p className="topic-result-meta"><Text copy={TOPIC_GROUPS[topic.group]} language={language} /><Text copy={resultCount(topicEntries(index, topic.id).length)} language={language} /></p>
    <h2><a href={topicHref(topic.id, language)}><Text copy={topic.title} language={language} /></a></h2>
    <Text as="p" className="topic-result-summary" copy={topic.summary} language={language} />
  </article>);
}

// A plain form: submitting loads /search.html?q=, which keeps the URL the single source of state.
function SearchForm({ q, language }) {
  const input = useRef(null);
  // The header's search link lands on #q, ready to type.
  useEffect(() => { if (window.location.hash === '#q') input.current.focus(); }, []);
  return <form className="topic-search" role="search" action={navigationHref('/search.html', language)} method="get">
    <Text as="label" htmlFor="q" copy={COPY.searchLabel} language={language} />
    <div className="topic-search-row">
      <input ref={input} id="q" name="q" type="search" defaultValue={q} placeholder={COPY.searchPlaceholder[language]} data-en-ph={COPY.searchPlaceholder.en} data-zh-ph={COPY.searchPlaceholder.zh} />
      <button type="submit"><Text copy={COPY.searchButton} language={language} /></button>
    </div>
  </form>;
}

export function SearchApp({ language }) {
  const [query] = useState(() => parseSearchQuery(window.location.search, TOPICS.map((topic) => topic.id)));
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);
  const results = useRef(null);
  const topic = query.kind === 'topic' ? TOPICS.find((item) => item.id === query.topic) : null;

  useEffect(() => { loadTopicsIndex().then(setIndex, () => setFailed(true)); }, []);
  const q = query.kind === 'query' ? query.q : null;
  useEffect(() => {
    const title = topic ? topic.title[language] : q;
    if (title) document.title = `${title} · AFFLATUS`;
  }, [topic, q, language]);
  // The button goes away with the last page, so focus moves on to the first new result.
  useEffect(() => {
    if (shown > PAGE_SIZE) results.current.children[shown - PAGE_SIZE].querySelector('a').focus({ preventScroll: true });
  }, [shown]);

  const hits = index && q ? searchEntries(index, q) : [];
  const entries = !index ? [] : topic ? topicEntries(index, topic.id) : hits.length ? hits : [...topicEntries(index, 'about'), ...topicEntries(index, 'labs')];
  const listed = topic || hits.length > 0;
  return <>
    <TopicMosaic entries={entries} language={language} />
    <section className="topic-panel">
      <Text as="p" className="topic-eyebrow" copy={q ? COPY.searchResults : COPY.overview} language={language} />
      <Text as="h1" copy={q ? { en: `“${q}”`, zh: `“${q}”` } : topic ? topic.title : COPY.allTopics} language={language} />
      {topic && <Text as="p" className="topic-summary" copy={topic.summary} language={language} />}
      <SearchForm q={q} language={language} />
      {query.unknownTopic && <Text as="p" className="topic-note" role="status" copy={COPY.unknown} language={language} />}
      {failed && <Text as="p" className="topic-note" role="alert" copy={COPY.failed} language={language} />}
      {index && q && !hits.length && <Text as="p" className="topic-note" role="status" copy={COPY.noResults} language={language} />}
      {index && listed && <>
        <Text as="p" className="topic-count" role={q ? 'status' : undefined} copy={resultCount(entries.length)} language={language} />
        {q && <Text as="p" className="topic-note" copy={COPY.searchScope} language={language} />}
        <div className="topic-results" ref={results}>{entries.slice(0, shown).map((entry) => <TopicResult key={entry.id} entry={entry} topicId={topic?.id} groups={index.groups} language={language} />)}</div>
        {shown < entries.length && <button type="button" className="topic-more" onClick={() => setShown(shown + PAGE_SIZE)}><Text copy={COPY.loadMore} language={language} /></button>}
      </>}
      {index && !listed && <div className="topic-results"><TopicDirectory index={index} language={language} /></div>}
    </section>
  </>;
}
