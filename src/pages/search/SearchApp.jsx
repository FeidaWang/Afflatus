import { useEffect, useState } from 'react';
import { TOPICS, TOPIC_GROUPS } from '../../config/topics.js';
import { RelatedMenu, Text } from '../../showcase/RelatedPopover.jsx';
import { entryHref, loadTopicsIndex, topicEntries, topicHref } from '../../showcase/topicsIndex.js';
import { parseSearchQuery } from './topicQuery.js';

const COPY = {
  overview: { en: 'Topic overview', zh: '专题总览' },
  allTopics: { en: 'All topics', zh: '全部专题' },
  unknown: { en: 'That topic does not exist. Choose one of these instead.', zh: '没有这个专题，可以从下面选择一个。' },
  failed: { en: 'The topic list could not be loaded. Please reload the page.', zh: '专题列表暂时无法加载，请刷新页面重试。' },
};
const resultCount = (count) => ({ en: `${count} ${count === 1 ? 'result' : 'results'}`, zh: `${count} 条结果` });

// Cover positions by centre point and base size, ordered so a short topic still spreads out.
const MOSAIC_SLOTS = [[48, 48, 96, 72], [62, 12, 80, 60], [14, 78, 84, 62], [84, 78, 62, 62], [14, 14, 72, 86], [78, 50, 66, 84], [40, 86, 60, 76], [88, 18, 60, 78], [36, 20, 64, 64], [62, 84, 72, 54], [18, 46, 58, 58]];
const mosaicScale = (count) => (count <= 3 ? 2.2 : count <= 6 ? 1.7 : 1.3);

function TopicMosaic({ entries, language }) {
  const covers = entries.slice(0, MOSAIC_SLOTS.length);
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

export function SearchApp({ language }) {
  const [query] = useState(() => parseSearchQuery(window.location.search, TOPICS.map((topic) => topic.id)));
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const topic = query.kind === 'topic' ? TOPICS.find((item) => item.id === query.topic) : null;

  useEffect(() => { loadTopicsIndex().then(setIndex, () => setFailed(true)); }, []);
  useEffect(() => { if (topic) document.title = `${topic.title[language]} · AFFLATUS`; }, [topic, language]);

  const entries = !index ? [] : topic ? topicEntries(index, topic.id) : [...topicEntries(index, 'about'), ...topicEntries(index, 'labs')];
  return <>
    <TopicMosaic entries={entries} language={language} />
    <section className="topic-panel">
      <Text as="p" className="topic-eyebrow" copy={COPY.overview} language={language} />
      <Text as="h1" copy={topic ? topic.title : COPY.allTopics} language={language} />
      {topic && <Text as="p" className="topic-summary" copy={topic.summary} language={language} />}
      {query.unknownTopic && <Text as="p" className="topic-note" role="status" copy={COPY.unknown} language={language} />}
      {failed && <Text as="p" className="topic-note" role="alert" copy={COPY.failed} language={language} />}
      {index && topic && <>
        <Text as="p" className="topic-count" copy={resultCount(entries.length)} language={language} />
        <div className="topic-results">{entries.map((entry) => <TopicResult key={entry.id} entry={entry} topicId={topic.id} groups={index.groups} language={language} />)}</div>
      </>}
      {index && !topic && <div className="topic-results"><TopicDirectory index={index} language={language} /></div>}
    </section>
  </>;
}
