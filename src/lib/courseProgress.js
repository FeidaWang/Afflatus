import { courseNodes } from '../data/courseNodes.js';

export const COURSE_PROGRESS_KEY = 'afflatus:course-progress:v2';
export const COURSE_REVIEW_KEY = 'afflatus:fde-weekly-review:v1';
export const courseNodeIds = Object.keys(courseNodes).sort((a, b) => Number(a) - Number(b));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// The pre-F12 store contains weekly reviews, not node completions. Keep that
// store as the owner of review content; migrate only its provenance here.
export function migrateCourseProgress(saved, review = null) {
  const empty = { version: 2, nodes: {}, view: 'list' };
  if (saved === null) return { state: review ? { ...empty, migratedFrom: COURSE_REVIEW_KEY } : empty, readOnly: false };
  if (!object(saved) || saved.version !== 2 || !object(saved.nodes)) return { state: empty, readOnly: true };
  return { state: { ...saved, nodes: { ...saved.nodes } }, readOnly: false };
}

export function isNodeComplete(state, id) {
  const node = state.nodes[id];
  return node?.attested === true && typeof node.evidence === 'string' && node.evidence.trim().length > 0;
}

export function nextCourseNode(state) {
  return courseNodeIds.find(id => !isNodeComplete(state, id)) || null;
}

export function recordEvidence(state, id, evidence, attested, now = new Date().toISOString()) {
  if (!courseNodeIds.includes(id)) throw new Error('Unknown course node');
  if (typeof evidence !== 'string' || (attested && !evidence.trim())) throw new Error('Evidence required');
  return { ...state, nodes: { ...state.nodes, [id]: {
    ...(object(state.nodes[id]) ? state.nodes[id] : {}), evidence, attested: attested === true, updatedAt: now,
  } } };
}
