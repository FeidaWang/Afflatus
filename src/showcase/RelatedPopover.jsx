import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, DotsThree, X } from '@phosphor-icons/react';
import { entryHref, loadTopicsIndex, relatedFor, topicHref } from './topicsIndex.js';
import './related.css';

const COPY = {
  related: { en: 'Related', zh: '相关内容' },
  relatedTo: { en: 'Related to', zh: '相关内容：' },
  close: { en: 'Close', zh: '关闭' },
  viewMore: { en: 'View more', zh: '查看更多' },
  loading: { en: 'Loading…', zh: '加载中…' },
  failed: { en: 'This could not be loaded. Browse all topics instead.', zh: '暂时无法加载，可以改为浏览全部专题。' },
  allTopics: { en: 'All topics', zh: '全部专题' },
};
const VIEWPORT_GUTTER = 16;

export function Text({ as: Tag = 'span', copy, language, ...props }) {
  return <Tag data-en={copy.en} data-zh={copy.zh} {...props}>{copy[language]}</Tag>;
}

// The current card, branching to the newest entries of its topic, newest at the top.
function BranchTree({ root, leaves, language }) {
  return <div className="related-tree">
    <Text as="p" className="related-tree-root" copy={root.title} language={language} />
    {leaves.length > 0 && <ol>{leaves.map((leaf) => <li key={leaf.id}>
      <a href={entryHref(leaf.latestUrl || leaf.url, language)}>
        <Text as="time" dateTime={leaf.date.iso} copy={leaf.date.label} language={language} />
        <Text className="related-tree-title" copy={leaf.title} language={language} />
      </a>
    </li>)}</ol>}
  </div>;
}

function RelatedBody({ index, url, topicId, language }) {
  const { entry, topic, leaves, card } = relatedFor(index, url, topicId);
  return <>
    <Text as="p" className="related-summary" copy={topic.summary} language={language} />
    <BranchTree root={entry} leaves={leaves} language={language} />
    {card && <a className="related-card" href={entryHref(card.url, language)}>
      <span className="related-card-meta"><Text copy={index.groups[card.group]} language={language} />{card.date && <Text as="time" dateTime={card.date.iso} copy={card.date.label} language={language} />}</span>
      <Text className="related-card-title" copy={card.title} language={language} />
      <Text className="related-card-summary" copy={card.summary} language={language} />
    </a>}
    <a className="related-more" href={topicHref(topic.id, language)}><Text copy={COPY.viewMore} language={language} /><ArrowRight aria-hidden="true" /></a>
  </>;
}

export function RelatedMenu({ url, topicId, label, language }) {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const panel = useRef(null);

  // The button only works once scripts run, so it stays out of the prerendered page until then.
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!open) return undefined;
    panel.current.focus({ preventScroll: true });
    let current = true;
    setFailed(false);
    loadTopicsIndex().then((data) => { if (current) setIndex(data); }, () => { if (current) setFailed(true); });
    const dismissOutside = (event) => { if (!root.current.contains(event.target)) setOpen(false); };
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      current = false;
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  // Cards near the left edge are narrower than the panel, which hangs from their right side.
  useLayoutEffect(() => {
    if (!open) return;
    const overflow = VIEWPORT_GUTTER - panel.current.getBoundingClientRect().left;
    panel.current.style.setProperty('--related-shift', `${Math.max(0, overflow)}px`);
  }, [open]);

  useEffect(() => {
    if (open) panel.current.scrollIntoView({ block: 'nearest' });
  }, [open, index, failed]);

  const close = () => {
    setOpen(false);
    trigger.current.focus();
  };

  return <div className="related" ref={root} hidden={!hydrated}>
    <button
      type="button"
      ref={trigger}
      className="related-trigger"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`${COPY.relatedTo[language]} ${label[language]}`}
      data-aria-en={`${COPY.relatedTo.en} ${label.en}`}
      data-aria-zh={`${COPY.relatedTo.zh} ${label.zh}`}
      onClick={() => setOpen(!open)}
    >{open ? <X aria-hidden="true" weight="bold" /> : <DotsThree aria-hidden="true" weight="bold" />}</button>
    {open && <div className="related-panel" ref={panel} role="dialog" tabIndex={-1} aria-label={COPY.related[language]} data-aria-en={COPY.related.en} data-aria-zh={COPY.related.zh}>
      <div className="related-heading">
        <Text as="h3" copy={COPY.related} language={language} />
        <button type="button" className="related-close" aria-label={COPY.close[language]} data-aria-en={COPY.close.en} data-aria-zh={COPY.close.zh} onClick={close}><X aria-hidden="true" /></button>
      </div>
      {index && <RelatedBody index={index} url={url} topicId={topicId} language={language} />}
      {!index && !failed && <Text as="p" className="related-summary" role="status" copy={COPY.loading} language={language} />}
      {!index && failed && <>
        <Text as="p" className="related-summary" role="alert" copy={COPY.failed} language={language} />
        <a className="related-more" href={entryHref('/search.html', language)}><Text copy={COPY.allTopics} language={language} /><ArrowRight aria-hidden="true" /></a>
      </>}
    </div>}
  </div>;
}
