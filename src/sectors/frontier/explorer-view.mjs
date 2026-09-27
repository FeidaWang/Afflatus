const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const explorerCopy = {
  en: {
    minimum:'Minimum measured score', budget:'Maximum AA task cost · USD', context:'Required declared context · tokens', unlimited:'No limit',
    constraintsNote:'Five requirements: metric, score, AA cost budget, open-weight constraint and declared context. Geography narrows the cohort separately. Open weights do not guarantee a deployment license or hosted availability. Context capacity is not measured long-context quality. The score floor is inactive in cost-only view; its plot explicitly uses Intelligence Index quality.',
    reasons:{provisional_conflict:'Source conflict; unranked',not_retrieved:'Not retrieved',context_missing:'Context capacity not retrieved',context_limit:'Below required context',score_limit:'Below minimum score',cost_missing:'Comparable cost unavailable',cost_limit:'Above cost budget'},
    lenses:'Three conditional lenses', premium:'Frontier premium', routing:'Efficient multi-model routing', supply:'Supply-constrained expansion',
    premiumText:'Compare the chosen task score with the published AA cost. A premium is justified only if actual completion or review savings offset it; this snapshot contains no such operational logs.',
    routingText:'The shortlist shows eligible configurations and their Pareto trade-offs. Lower AA cost does not establish the cheapest successful production route. Escalation assignments and traffic shares require task logs.',
    supplyText:'Declared context and open weights narrow possible deployment choices. Capacity, delivery dates, hosting, licensing and serving efficiency remain separate constraints; benchmark gains do not measure available supply.',
    distributions:'Distribution of eligible configurations', open:'Open weights', closed:'Closed weights', unknown:'Openness unknown', empty:'No matching observations. Constraints have not been relaxed.',
    summary:'eligible · Pareto configurations', note:'Each mark is one configuration, not market share. Panels use the same score axis. Negative indices remain negative. Missing and provisional observations are excluded.',
    gaps:'What this snapshot cannot measure', routingGap:'Workload routing: no logged task assignments. No traffic allocation or transition widths are inferred.', failureGap:'Failures / retries / review: no attempt-level outcomes or denominators. Composite scores are not success rates.', historyGap:'Historical change: only one selected snapshot. No trend is drawn; a future index rebase must start a separate history.', valueGap:'Value capture: the bill above adds disjoint token buckets only. Model, cloud and hardware revenues overlap and cannot form a market-share pie.',
  },
  zh: {
    minimum:'最低实测分数',budget:'AA 任务成本上限 · 美元',context:'所需声明上下文 · token',unlimited:'不限',
    constraintsNote:'五项要求：评测维度、分数、AA 成本预算、开放权重限制和声明上下文。所在地另行缩小样本。开放权重不保证部署许可或托管可用；上下文容量不代表实测长文本能力。仅看成本时停用最低分数；图表明确使用综合能力指数作为纵轴。',
    reasons:{provisional_conflict:'来源冲突，未排名',not_retrieved:'尚未取得',context_missing:'上下文容量尚未取得',context_limit:'低于所需上下文',score_limit:'低于最低分数',cost_missing:'缺少可比成本',cost_limit:'超过成本预算'},
    lenses:'三种条件视角',premium:'前沿溢价',routing:'高效多模型路由',supply:'供给受限的扩张',
    premiumText:'将所选任务分数与公布的 AA 成本并列。只有实际完成率或复核节省足以抵销溢价时，额外费用才有依据；当前快照没有这些运行日志。',
    routingText:'候选集合展示满足条件的配置及其 Pareto 取舍。AA 成本较低不等于真实业务的成功任务成本最低；升级分派与流量占比需要任务日志。',
    supplyText:'声明上下文和开放权重缩小部署候选范围。容量、交付时间、托管、许可证和服务效率仍是独立条件；评测进步不等于供给增加。',
    distributions:'符合条件的配置分布',open:'开放权重',closed:'非开放权重',unknown:'开放状态未知',empty:'没有匹配的观测，未放宽任何条件。',summary:'个满足条件 · Pareto 配置数',note:'每个标记代表一个配置，不是市场份额。各面板使用同一分数轴，负指数保留负值；缺失与有冲突的观测不计入。',
    gaps:'当前快照无法测量的内容',routingGap:'工作负载分流：缺少按任务记录的分派日志，不推断流量分配或流线宽度。',failureGap:'失败／重试／复核：缺少逐次尝试结果与分母，综合指数不能换算成成功率。',historyGap:'历史变化：只有一期选定快照，不绘制趋势；今后指数版本变化必须分开历史序列。',valueGap:'价值归属：上方账单仅相加互斥的 token 计费项。模型、云与硬件收入可能重复计算，不能拼成市场份额饼图。',
  },
};
export function lensMarkup(lang, lens, explanationOnly=false) {
  const t=explorerCopy[lang];
  const explanation=`<p>${t[`${lens}Text`]}</p><a href="#frontierTaskText">${lang==='zh'?'查看有日期与来源的依赖关系':'Dated dependency evidence'}</a>`;
  if (explanationOnly) return explanation;
  return `<h3>${t.lenses}</h3><div class="fc-lens-buttons">${['premium','routing','supply'].map(key=>`<button type="button" data-lens="${key}" aria-pressed="${key===lens}">${t[key]}</button>`).join('')}</div><div data-lens-explanation aria-live="polite">${explanation}</div>`;
}
export function distributionMarkup(result,lang,data,constraints) {
  const t=explorerCopy[lang],metric=result.metric;
  const rows=result.ranked;
  const lo=metric.min??Math.min(0,...rows.map(r=>r.value));
  const hi=metric.max??Math.max(lo+1,...rows.map(r=>r.value));
  const unit={index_points:lang==='zh'?'指数分':'index points',percent:'%',rating_points:lang==='zh'?'评分点':'rating points',USD_per_evaluation_task:lang==='zh'?'美元／评测任务':'USD / evaluation task'}[metric.unit];
  const source=data.sources.find(s=>s.id===metric.source_ids[0]);
  const requirements=constraints?`${t.minimum}: ${constraints.metric==='cost_task'?'—':constraints.minScore??t.unlimited} · ${t.budget}: ${constraints.maxCost??t.unlimited} · ${t.context}: ${constraints.context} · ${constraints.openOnly?t.open:(lang==='zh'?'权重不限':'Any weight status')} · ${constraints.geography}`:'';
  const groups=[[true,t.open],[false,t.closed],[null,t.unknown]];
  // Keep the quantitative x position exact; stack close marks vertically so
  // tied/nearby configurations remain countable at phone widths.
  const dotPlot=(cohort,label)=>{
    const lanes=[];
    const dots=cohort.slice().sort((a,b)=>a.value-b.value).map(row=>{
      const x=20+280*(row.value-lo)/(hi-lo);
      let lane=lanes.findIndex(last=>x-last>=14);
      if(lane<0)lane=lanes.length;
      lanes[lane]=x;
      return {row,x,lane};
    });
    const baseline=Math.max(42,18+lanes.length*14);
    return `<svg viewBox="0 0 320 ${baseline+38}" role="img" aria-label="${esc(label)}: ${cohort.map(r=>esc(r.model.name)+': '+r.value).join('; ')}"><line class="fc-distribution-axis" x1="20" x2="300" y1="${baseline}" y2="${baseline}" stroke="currentColor"/>${dots.map(({row,x,lane})=>`<circle cx="${x}" cy="${baseline-10-lane*14}" r="5" fill="currentColor" stroke="currentColor"><title>${esc(row.model.name)}: ${row.value}</title></circle>`).join('')}<text x="20" y="${baseline+26}" fill="currentColor">${lo}</text><text x="300" y="${baseline+26}" text-anchor="end" fill="currentColor">${hi}</text></svg>`;
  };
  return `<h3>${t.distributions}</h3><p class="fc-plot-note">${esc(requirements)}</p><p class="fc-result-summary" role="status">${rows.length} ${t.summary}: ${result.pareto.frontier.length}</p><p>${esc(metric.label[lang])} · ${unit} · ${esc(metric.version)} · 2026-09-27 · <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.id)}</a></p><p class="fc-plot-note">${t.note}</p>${rows.length?`<div class="fc-distribution-panels">${groups.map(([value,label])=>{const cohort=rows.filter(r=>r.model.open_weights===value);return `<section><h4>${label} · N=${cohort.length}</h4>${dotPlot(cohort,label)}<ul>${cohort.map(r=>`<li>${esc(r.model.name)}: ${r.value} ${unit}</li>`).join('')||'<li>—</li>'}</ul></section>`;}).join('')}</div>`:`<p>${t.empty}</p>`}`;
}
export function evidenceGapsMarkup(lang) {
 const t=explorerCopy[lang];
 return `<section class="fc-evidence-gaps"><h3>${t.gaps}</h3>${['routingGap','failureGap','historyGap','valueGap'].map(key=>`<p>${t[key]}</p>`).join('')}</section>`;
}
