import { courseNodes } from '../data/courseNodes.js';
import { COURSE_PROGRESS_KEY, COURSE_REVIEW_KEY, courseNodeIds, migrateCourseProgress, recordEvidence, nextCourseNode, isNodeComplete } from '../lib/courseProgress.js';

export function initCourseProgress({ lang, openPacket }) {
  const $ = id => document.getElementById(id);
  if (!$('courseLearningControls')) return null;
  const T = (en, zh) => lang() === 'zh' ? zh : en;
  const mapNodes = new Map([...document.querySelectorAll('.map-node')].map(node => [node.dataset.node, node]));
  const title = id => mapNodes.get(id)?.querySelector('strong')?.getAttribute(`data-${lang()}`) || id;
  let storageFailed = false;
  let rawProgress = null;
  let review = null;
  try {
    rawProgress = localStorage.getItem(COURSE_PROGRESS_KEY);
    const legacy = localStorage.getItem(COURSE_REVIEW_KEY);
    try { review = JSON.parse(legacy); } catch { review = legacy; }
  } catch { storageFailed = true; }
  let parsed = null;
  try { parsed = JSON.parse(rawProgress); } catch { parsed = rawProgress; }
  const migrated = migrateCourseProgress(parsed, review);
  let state = migrated.state;
  let currentId = null;
  const list = $('courseList');
  const atlas = $('atlas');
  const evidence = $('nodeEvidence');
  const attest = $('nodeAttest');
  const rows = new Map();

  function storageMessage() {
    $('courseStorageMessage').textContent = migrated.readOnly
      ? T('Saved progress has an unsupported format. It is preserved unchanged; export it before making changes.', '已存进度格式暂不支持，原数据保持不变；请先导出留存。')
      : storageFailed ? T('Browser storage is unavailable. Changes last only in this tab; export before leaving.', '浏览器存储不可用。更改仅在当前标签页有效，离开前请导出。')
      : state.migratedFrom ? T('Previous weekly review retained. It does not mark any task complete.', '已保留旧版每周复盘，不会据此标记任何任务完成。') : '';
  }
  function persist() {
    if (migrated.readOnly) return;
    try { localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(state)); storageFailed = false; }
    catch { storageFailed = true; }
    storageMessage();
  }
  function renderSummary() {
    const count = courseNodeIds.filter(id => isNodeComplete(state, id)).length;
    $('courseProgressCount').textContent = T(`${count} / 36 self-assessed complete`, `${count} / 36 项自评完成`);
    const next = nextCourseNode(state);
    $('courseResume').disabled = !next;
    $('courseResume').textContent = next ? T(`Continue ${next} · ${title(next)}`, `继续 ${next} · ${title(next)}`) : T('All 36 tasks self-assessed complete', '36 项任务均已自评完成');
    for (const [id, row] of rows) {
      row.button.textContent = `${id} · ${title(id)}`;
      row.meta.textContent = courseNodes[id].meta[lang()] || courseNodes[id].meta.en;
      row.build.textContent = courseNodes[id].build[lang()] || courseNodes[id].build.en;
      row.status.textContent = isNodeComplete(state, id) ? T('Self-assessed complete', '已自评完成') : state.nodes[id]?.evidence ? T('Draft', '草稿') : T('Not started', '未开始');
      row.item.dataset.complete = String(isNodeComplete(state, id));
      const previous = courseNodeIds[courseNodeIds.indexOf(id) - 1];
      row.prerequisite.textContent = previous ? T(`Suggested prerequisite: ${previous} · ${title(previous)}`, `建议前置：${previous} · ${title(previous)}`) : T('Starting point · no prerequisite', '起点 · 无前置任务');
    }
    storageMessage();
  }
  for (const id of courseNodeIds) {
    const item = document.createElement('li');
    const meta = document.createElement('small');
    const button = document.createElement('button'); button.type = 'button'; button.dataset.courseNode = id;
    button.addEventListener('click', () => openPacket(mapNodes.get(id)));
    const build = document.createElement('p');
    const prerequisite = document.createElement('p'); prerequisite.className = 'course-prerequisite';
    const status = document.createElement('span'); status.className = 'course-task-status';
    item.append(meta, button, build, prerequisite, status); list.append(item);
    rows.set(id, { item, meta, button, build, prerequisite, status });
  }
  function setView(view, save = true) {
    const map = view === 'map';
    state = { ...state, view: map ? 'map' : 'list' };
    list.hidden = map; atlas.hidden = !map;
    atlas.classList.add('course-map-view');
    $('courseMapView').setAttribute('aria-pressed', String(map));
    $('courseListView').setAttribute('aria-pressed', String(!map));
    if (save) persist();
    // Re-measure the existing atlas after its hidden layout is restored.
    if (map) requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  function openNode(id) {
    currentId = id;
    evidence.value = typeof state.nodes[id]?.evidence === 'string' ? state.nodes[id].evidence : '';
    attest.checked = isNodeComplete(state, id);
    const previous = courseNodeIds[courseNodeIds.indexOf(id) - 1];
    $('nodePrerequisites').textContent = previous ? T(`Suggested prerequisite: ${previous} · ${title(previous)}. All tasks remain available.`, `建议前置：${previous} · ${title(previous)}。所有任务仍可自由查看。`) : T('Starting point · no prerequisite.', '起点 · 无前置任务。');
    $('nodeProgressMessage').textContent = attest.checked ? T('Self-assessed complete. Save as draft to reopen.', '已自评完成。保存为草稿可重新开启。') : '';
  }
  function saveEvidence(complete) {
    if (!currentId || migrated.readOnly) return;
    if (complete && (!evidence.value.trim() || !attest.checked)) {
      $('nodeProgressMessage').textContent = T('Add evidence and confirm your self-assessment first.', '请先填写证据，并勾选自评确认。');
      (evidence.value.trim() ? attest : evidence).focus(); return;
    }
    state = recordEvidence(state, currentId, evidence.value, complete);
    if (!complete) attest.checked = false;
    persist(); renderSummary();
    $('nodeProgressMessage').textContent = storageFailed ? T('Kept in this tab only. Export before leaving.', '仅暂存于当前标签页，离开前请导出。') : complete ? T('Saved · self-assessed complete.', '已保存 · 自评完成。') : T('Saved · draft.', '已保存 · 草稿。');
  }
  evidence.addEventListener('input', () => saveEvidence(false));
  attest.addEventListener('change', () => { if (!attest.checked && isNodeComplete(state, currentId)) saveEvidence(false); });
  $('nodeSaveDraft').addEventListener('click', () => saveEvidence(false));
  $('nodeComplete').addEventListener('click', () => saveEvidence(true));
  $('courseResume').addEventListener('click', () => { const id = nextCourseNode(state); if (id) openPacket(mapNodes.get(id)); });
  $('courseListView').addEventListener('click', () => setView('list'));
  $('courseMapView').addEventListener('click', () => setView('map'));
  $('courseExport').addEventListener('click', () => {
    let weeklyReview = review;
    try { const raw = localStorage.getItem(COURSE_REVIEW_KEY); try { weeklyReview = JSON.parse(raw); } catch { weeklyReview = raw; } } catch { /* Export the review read at startup when storage is unavailable. */ }
    const data = { version: 2, exportedAt: new Date().toISOString(), progress: state, weeklyReview, ...(migrated.readOnly ? { preservedRawProgress: rawProgress } : {}) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'afflatus-course-progress.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const input of [evidence, attest, $('nodeSaveDraft'), $('nodeComplete')]) input.disabled = migrated.readOnly;
  $('courseStaticHelp').hidden = true;
  $('courseLearningControls').hidden = false; $('courseEvidence').hidden = false;
  setView(state.view, false); renderSummary(); persist();
  // Preserve incoming map bookmarks even when the reader last chose the list.
  const revealMapHash = () => { if (location.hash === '#atlas') setView('map'); };
  window.addEventListener('hashchange', revealMapHash); revealMapHash();
  window.addEventListener('afflatus-lang', renderSummary);
  return { openNode };
}
