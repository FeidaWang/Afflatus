const MODEL_IDS = ['S', 'P', 'T'];

export function arenaBootSummary(data) {
  const models = MODEL_IDS.map((id) => ({ id, equity: data?.models?.[id]?.equity }));
  if (models.some((model) => !Number.isFinite(model.equity))) {
    throw new Error('Arena Season 2 ledger requires finite S/P/T equity values');
  }
  if (!Number.isInteger(data?.day) || !Number.isInteger(data?.season)) {
    throw new Error('Arena ledger requires integer day and season values');
  }
  if (!Number.isFinite(data.models.S.startEquity)) {
    throw new Error('Arena Season 2 ledger requires a finite start equity');
  }
  return {
    primary: models[0],
    secondary: models.slice(1),
    day: data.day,
    season: data.season,
    startEquity: data.models.S.startEquity,
  };
}
