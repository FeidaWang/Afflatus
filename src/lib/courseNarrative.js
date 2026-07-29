export const COURSE_STAGE_COUNT = 5;

export function courseStageForProgress(progress) {
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  if (value < 0.16) return 0;
  if (value < 0.38) return 1;
  if (value < 0.62) return 2;
  if (value < 0.84) return 3;
  return 4;
}
