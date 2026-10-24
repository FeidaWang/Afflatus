/* ============================================================
   RELATIONSHIPS v2 · score model registry (REL-070 lands here).
   Until the six-dimension scale is implemented every dimension and the
   overall index are null with a reason — never a placeholder number.
   ============================================================ */
export const SCORE_MODEL = Object.freeze({ modelId: 'rel-six-dim', modelVersion: '0.0.0-pending' });
export const SCORE_MODEL_IDS = [SCORE_MODEL.modelId];

export function scoreReport() {
  return {
    rules: [],
    dimensions: {},
    overall: { kind: 'editorial_entertainment_index', ...SCORE_MODEL, status: 'insufficient', value: null, ruleCoverage: null, reasonKeys: ['model_not_implemented'] },
    archetypes: { A_to_B: { themeIds: [], evidenceIds: [], questionIds: [] }, B_to_A: { themeIds: [], evidenceIds: [], questionIds: [] } },
  };
}
