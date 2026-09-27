/** Pure, dependency-free ranking and billing helpers. No network or DOM access. */
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const key = (o) => [o.cohort_id, o.model_id, o.metric_id, o.protocol_id].join('|');
export function validateSnapshot(data) {
  const errors = [];
  if (!data || data.schema_version !== 2) return ['Expected snapshot schema_version 2.'];
  for (const field of ['sources','metrics','models','observations','cohorts']) {
    if (!Array.isArray(data[field])) errors.push(`${field} must be an array.`);
  }
  if (errors.length) return errors;
  const index = (items, label) => {
    const out = new Map();
    for (const row of items) {
      if (typeof row.id !== 'string' || !row.id) errors.push(`${label}: missing id.`);
      if (out.has(row.id)) errors.push(`${label}: duplicate id ${row.id}.`);
      out.set(row.id,row);
    }
    return out;
  };
  const sources = index(data.sources,'sources');
  const metrics = index(data.metrics,'metrics');
  const models = index(data.models,'models');
  const cohorts = index(data.cohorts,'cohorts');
  const checkRefs = (ids,label) => {
    if (!Array.isArray(ids)) { errors.push(`${label}: source_ids must be an array.`); return; }
    for (const id of ids) if (!sources.has(id)) errors.push(`${label}: unknown source ${id}.`);
  };
  for (const s of data.sources) {
    try { if (new URL(s.url).protocol !== 'https:') errors.push(`${s.id}: HTTPS source required.`); }
    catch { errors.push(`${s.id}: invalid source URL.`); }
  }
  for (const m of data.metrics) {
    if (!['higher','lower'].includes(m.direction)) errors.push(`${m.id}: invalid direction.`);
    if (!m.protocol_id || !m.unit || !m.version) errors.push(`${m.id}: versioned protocol and unit required.`);
  }
  for (const m of data.models) {
    checkRefs(m.source_ids,m.id);
    if (!m.configuration) errors.push(`${m.id}: configuration required.`);
    if (![true,false,null].includes(m.open_weights)) errors.push(`${m.id}: openness must be true/false/null.`);
    if (!['reported_snapshot','provisional_conflict'].includes(m.status)) errors.push(`${m.id}: invalid status.`);
    for (const name of ['input','output','cache_read','cache_write']) {
      const value=m.prices?.[name];
      if (value !== null && (!finite(value) || value < 0)) errors.push(`${m.id}: invalid ${name} price.`);
    }
  }
  const seen = new Set();
  for (const o of data.observations) {
    const k=key(o), m=metrics.get(o.metric_id);
    if (seen.has(k)) errors.push(`Duplicate observation ${k}.`);
    seen.add(k);
    if (!models.has(o.model_id)) errors.push(`Unknown model ${o.model_id}.`);
    if (!cohorts.has(o.cohort_id)) errors.push(`Unknown cohort ${o.cohort_id}.`);
    if (!m) { errors.push(`Unknown metric ${o.metric_id}.`); continue; }
    if (o.protocol_id !== m.protocol_id) errors.push(`${k}: incompatible protocol.`);
    if (o.unit !== m.unit) errors.push(`${k}: incompatible unit.`);
    if (o.value !== null) {
      if (!finite(o.value)) errors.push(`${k}: value must be finite or null.`);
      if (m.min !== null && o.value < m.min) errors.push(`${k}: below valid range.`);
      if (m.max !== null && o.value > m.max) errors.push(`${k}: above valid range.`);
      if (!o.source_ids?.length) errors.push(`${k}: measured value without source.`);
      if (!['reported_snapshot','provisional_conflict'].includes(o.evidence_status)) errors.push(`${k}: invalid evidence status.`);
      for (const s of o.source_ids ?? []) {
        if (sources.get(s)?.evidence_type !== 'evaluator_report') errors.push(`${k}: benchmark requires an evaluator source.`);
      }
    } else if (o.evidence_status !== 'not_retrieved') errors.push(`${k}: null must be marked not_retrieved.`);
    checkRefs(o.source_ids,k);
  }
  return errors;
}
export function assertSnapshot(data) {
  const errors=validateSnapshot(data);
  if (errors.length) throw new TypeError(errors.join('\n'));
}
function resolveCohort(data,id) {
  if (!id && data.cohorts.length===1) return data.cohorts[0].id;
  if (!id || !data.cohorts.some(c=>c.id===id)) throw new TypeError('Choose an explicit valid cohort.');
  return id;
}
export function observation(data,modelId,metricId,cohortId) {
  const c=resolveCohort(data,cohortId);
  const metric=data.metrics.find(m=>m.id===metricId);
  if (!metric) throw new TypeError(`Unknown metric ${metricId}.`);
  const matches=data.observations.filter(o=>o.model_id===modelId && o.metric_id===metricId && o.cohort_id===c);
  if (matches.length>1) throw new TypeError('Duplicate observations: resolve rather than silently averaging.');
  const found=matches[0] ?? null;
  if (found && (found.protocol_id!==metric.protocol_id || found.unit!==metric.unit)) throw new TypeError('Incompatible metric protocol/unit.');
  return found;
}
export function rankMetric(data,metricId,{cohortId,geography='all',openOnly=false,includeProvisional=false}={}) {
  const c=resolveCohort(data,cohortId);
  const metric=data.metrics.find(m=>m.id===metricId);
  if (!metric) throw new TypeError(`Unknown metric ${metricId}.`);
  const scope=data.models.filter(m=>(geography==='all'||m.lab_geography===geography)&&(!openOnly||m.open_weights===true));
  const ranked=[], excluded=[];
  for (const model of scope) {
    const o=observation(data,model.id,metricId,c);
    if (!includeProvisional && (model.status==='provisional_conflict'||o?.evidence_status==='provisional_conflict')) {
      excluded.push({model,reason:'provisional_conflict'}); continue;
    }
    if (!o || !finite(o.value)) { excluded.push({model,reason:'not_retrieved'}); continue; }
    ranked.push({model,observation:o,value:o.value});
  }
  const sign=metric.direction==='higher'?-1:1;
  ranked.sort((a,b)=>sign*(a.value-b.value)||a.model.id.localeCompare(b.model.id));
  let previous=null, rank=0;
  for (let i=0;i<ranked.length;i++) {
    const row=ranked[i];
    if (i===0||row.value!==previous) rank=i+1;
    row.rank=rank; row.displayTie=ranked.filter(x=>x.value===row.value).length>1;
    previous=row.value;
  }
  return {cohortId:c,metric,ranked,excluded,scopeCount:scope.length,coverage:ranked.length,
    tieMeaning:'Equal displayed values, not a statistical equivalence finding.'};
}
/** Pareto set is descriptive within the selected cohort, never a buy/recommendation score. */
export function paretoFrontier(data,{cohortId,geography='all',openOnly=false,qualityMetric='intelligence',minQuality=-Infinity,maxCost=Infinity}={}) {
  const c=resolveCohort(data,cohortId);
  const metric=data.metrics.find(m=>m.id===qualityMetric);
  if (!metric || metric.direction!=='higher') throw new TypeError('Quality must be a higher-is-better metric.');
  if (typeof minQuality!=='number'||Number.isNaN(minQuality)||typeof maxCost!=='number'||Number.isNaN(maxCost)||maxCost<0) throw new TypeError('Invalid constraints.');
  const ranking=rankMetric(data,qualityMetric,{cohortId:c,geography,openOnly});
  const eligible=ranking.ranked.map(r=>{const o=observation(data,r.model.id,'cost_task',c);return {...r,cost:o?.evidence_status==='provisional_conflict'?null:o?.value};})
    .filter(r=>finite(r.cost)&&r.cost>0&&r.cost<=maxCost&&r.value>=minQuality);
  const frontier=eligible.filter(a=>!eligible.some(b=>b.model.id!==a.model.id && b.cost<=a.cost && b.value>=a.value && (b.cost<a.cost||b.value>a.value)))
    .sort((a,b)=>a.cost-b.cost||b.value-a.value);
  return {eligible,frontier,qualityMetric,costMetric:'cost_task',scopeCount:ranking.scopeCount,
    caveat:'Not quality-adjusted cost per successful job. Missing costs and provisional records are excluded.'};
}
/** Disjoint billable token buckets. output includes billed reasoning where the endpoint bills it as output. */
export function estimateTokenBill(rates,{uncachedInput=0,cacheRead=0,cacheWrite=0,output=0,toolFees=0}={}) {
  for (const [k,v] of Object.entries({uncachedInput,cacheRead,cacheWrite,output,toolFees})) {
    if (!finite(v)||v<0) throw new TypeError(`${k} must be a non-negative finite number.`);
  }
  const buckets=[['input',uncachedInput],['cache_read',cacheRead],['cache_write',cacheWrite],['output',output]];
  let tokenCost=0;
  for (const [name,tokens] of buckets) {
    if (tokens===0) continue;
    if (!finite(rates[name])||rates[name]<0) throw new TypeError(`A verified ${name} rate is required for nonzero usage.`);
    tokenCost += tokens * rates[name] / 1e6;
  }
  return {currency:'USD',tokenCost,toolFees,total:tokenCost+toolFees,
    note:'Illustrative bill from entered usage. Excludes unspecified hosting, review, taxes, SLA, batch and tier charges; not a model-performance estimate.'};
}
export function costPerSuccessfulTask({totalCost,successfulTasks}) {
  if (!finite(totalCost)||totalCost<0||!Number.isInteger(successfulTasks)||successfulTasks<0) throw new TypeError('Invalid realized costs or success count.');
  return successfulTasks===0?null:totalCost/successfulTasks;
}
/** Dimensionless illustrative accounting identity, not a macro/equity forecasting model. */
export function demandScenario({workloadRatio,tokensPerWorkloadRatio,servingEfficiencyRatio,realizedPriceRatio}) {
  for (const [k,v] of Object.entries({workloadRatio,tokensPerWorkloadRatio,servingEfficiencyRatio,realizedPriceRatio})) {
    if (!finite(v)||v<=0) throw new TypeError(`${k} must be positive and finite.`);
  }
  const tokenRatio=workloadRatio*tokensPerWorkloadRatio;
  return {tokenRatio,computeWorkRatio:tokenRatio/servingEfficiencyRatio,tokenRevenueRatio:tokenRatio*realizedPriceRatio,
    type:'illustrative_assumption',note:'Not a forecast, profit estimate, GPU purchase requirement or stock target.'};
}
