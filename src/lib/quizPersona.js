/* ============================================================
   SIXTEEN-TYPE PREFERENCE EXPLORER

   An original, non-diagnostic self-reflection quiz. It borrows only the
   public four-preference vocabulary (E/I, S/N, T/F, J/P) and the useful
   modern idea that a broad preference can contain several, sometimes
   contradictory, behavioural facets. It is not the MBTI® instrument,
   does not reproduce its items or scoring, and is not a clinical or
   employment assessment.

   Design:
   - 48 bilingual statements: 12 per axis, 4 per original facet.
   - A five-point response scale preserves "it depends" instead of forcing
     every person into a false either/or answer.
   - Half of every facet's items are reverse keyed to reduce acquiescence.
   - Results report continuous percentages and explicitly flag close axes.
   - The four-letter code is a best-fit shorthand, not an identity verdict.
   ============================================================ */

export const AXIS_LETTERS = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];

export const AXIS_META = [
  {
    key: 'energy',
    en: 'Energy & attention', zh: '能量与注意力',
    firstEn: 'Outward exchange', firstZh: '外部互动',
    secondEn: 'Inner reflection', secondZh: '内部沉淀',
  },
  {
    key: 'information',
    en: 'Information lens', zh: '信息取向',
    firstEn: 'Observable detail', firstZh: '可见事实',
    secondEn: 'Pattern & possibility', secondZh: '模式与可能',
  },
  {
    key: 'decisions',
    en: 'Decision lens', zh: '决策取向',
    firstEn: 'Consistency & logic', firstZh: '一致性与逻辑',
    secondEn: 'Values & impact', secondZh: '价值与影响',
  },
  {
    key: 'structure',
    en: 'Structure & pace', zh: '结构与节奏',
    firstEn: 'Plan & closure', firstZh: '计划与收束',
    secondEn: 'Options & adaptation', secondZh: '开放与应变',
  },
];

export const FACET_META = {
  reach: { axis: 0, firstEn: 'Reach out', firstZh: '主动连接', secondEn: 'Wait for invitation', secondZh: '等待邀请' },
  process: { axis: 0, firstEn: 'Think aloud', firstZh: '边说边想', secondEn: 'Think within', secondZh: '先想后说' },
  circle: { axis: 0, firstEn: 'Social breadth', firstZh: '关系广度', secondEn: 'Relational depth', secondZh: '关系深度' },
  evidence: { axis: 1, firstEn: 'What is observable', firstZh: '可观察事实', secondEn: 'What it implies', secondZh: '背后含义' },
  learning: { axis: 1, firstEn: 'Worked example', firstZh: '实例切入', secondEn: 'Underlying model', secondZh: '原理切入' },
  novelty: { axis: 1, firstEn: 'Proven route', firstZh: '成熟路径', secondEn: 'Original route', secondZh: '原创路径' },
  criteria: { axis: 2, firstEn: 'Consistent criteria', firstZh: '一致标准', secondEn: 'Human context', secondZh: '人的处境' },
  feedback: { axis: 2, firstEn: 'Direct correction', firstZh: '直接纠偏', secondEn: 'Supportive framing', secondZh: '支持性表达' },
  conflict: { axis: 2, firstEn: 'Principle first', firstZh: '原则优先', secondEn: 'Relationship first', secondZh: '关系优先' },
  planning: { axis: 3, firstEn: 'Planful', firstZh: '预先规划', secondEn: 'Open-ended', secondZh: '保持开放' },
  pace: { axis: 3, firstEn: 'Early start', firstZh: '提前启动', secondEn: 'Pressure burst', secondZh: '临界爆发' },
  change: { axis: 3, firstEn: 'Closure', firstZh: '确认收束', secondEn: 'Adaptation', secondZh: '灵活转向' },
};

export const RESPONSE_OPTIONS = [
  { value: 1, en: 'Not like me', zh: '很不像我' },
  { value: 2, en: 'Rarely', zh: '比较少' },
  { value: 3, en: 'It depends', zh: '看情境' },
  { value: 4, en: 'Often', zh: '经常如此' },
  { value: 5, en: 'Very like me', zh: '很像我' },
];

const q = (axis, facet, dir, en, zh) => ({ axis, facet, dir, q: [en, zh] });

export const PERSONA_QUESTIONS = [
  // E / I · reaching out
  q(0, 'reach', 1, 'In an unfamiliar group, I usually introduce myself rather than wait.', '进入陌生群体时，我通常会先自我介绍，而不是等别人来找我。'),
  q(0, 'reach', -1, 'I prefer to see a clear sign of welcome before joining a conversation.', '我更愿意先看到明确的欢迎信号，再加入一段对话。'),
  q(0, 'reach', 1, 'If a room goes quiet, I am comfortable starting the next conversation.', '场面安静下来时，我通常不介意主动开启下一段话题。'),
  q(0, 'reach', -1, 'Being invited into an exchange feels more natural than initiating it.', '相比主动发起交流，被邀请加入会让我感觉更自然。'),
  // E / I · processing
  q(0, 'process', 1, 'Talking with someone helps me discover what I think.', '和别人边聊边想，常能帮助我发现自己真正的想法。'),
  q(0, 'process', -1, 'I like to formulate an idea privately before saying it aloud.', '我喜欢先在心里把想法组织好，再说出来。'),
  q(0, 'process', 1, 'When an idea stalls, my first move is often a real-time conversation.', '思路卡住时，我的第一反应往往是找人实时讨论。'),
  q(0, 'process', -1, 'Writing or quiet reflection usually gives me my clearest thinking.', '写下来或安静独处，通常最能让我想清楚。'),
  // E / I · social range
  q(0, 'circle', 1, 'I enjoy keeping many lighter connections active at once.', '我享受同时维持许多轻量但活跃的联系。'),
  q(0, 'circle', -1, 'A few relationships with long, uninterrupted conversations suit me best.', '少数几段能长时间深入交谈的关系最适合我。'),
  q(0, 'circle', 1, 'After a people-filled day, another social plan can still energise me.', '一整天都在和人相处之后，下一场社交活动仍可能让我更有精神。'),
  q(0, 'circle', -1, 'After group time, quiet recovery is important before I feel fully myself.', '集体活动之后，我需要一段安静恢复，才会重新找回完整状态。'),

  // S / N · evidence
  q(1, 'evidence', 1, 'I tend to notice exact wording, numbers or observable details first.', '我通常会先注意精确措辞、数字或可以观察到的细节。'),
  q(1, 'evidence', -1, 'I tend to notice the pattern or future implication before the particulars.', '相比具体细节，我往往先看到其中的模式或未来含义。'),
  q(1, 'evidence', 1, 'When retelling an event, I naturally follow what happened in sequence.', '复述一件事时，我会自然地按事情发生的顺序讲。'),
  q(1, 'evidence', -1, 'I often compress many details into the one idea they seem to point toward.', '我常把许多细节压缩成它们共同指向的一个核心含义。'),
  // S / N · learning
  q(1, 'learning', 1, 'A worked example helps me learn before a broad theory does.', '学习新内容时，一个完整实例通常比宏观理论更能帮助我入门。'),
  q(1, 'learning', -1, 'I want the underlying model before I practise the individual steps.', '练习具体步骤前，我想先理解背后的整体模型。'),
  q(1, 'learning', 1, 'I trust a method more after seeing it work in a concrete case.', '看到一种方法在具体案例中奏效后，我会更信任它。'),
  q(1, 'learning', -1, 'Exploring hypothetical possibilities is one of my fastest ways to learn.', '探索假设和各种可能性，是我学习新事物最快的方式之一。'),
  // S / N · novelty
  q(1, 'novelty', 1, 'I would rather refine a proven approach than replace it too quickly.', '相比过早推翻成熟方法，我更愿意先把它打磨得更好。'),
  q(1, 'novelty', -1, 'An untested original route can be more appealing than the established one.', '一条未经验证的原创路径，有时比既有路径更吸引我。'),
  q(1, 'novelty', 1, 'Clear instructions are a useful starting constraint, not an obstacle.', '清楚的说明是一种有用的起点约束，而不是妨碍。'),
  q(1, 'novelty', -1, 'Routine tasks quickly make me imagine how the whole system could be different.', '面对重复任务时，我很快就会开始设想整个系统还能怎样重做。'),

  // T / F · criteria
  q(2, 'criteria', 1, 'I compare difficult options using the same criteria wherever possible.', '面对困难选择时，我会尽量用同一套标准比较不同选项。'),
  q(2, 'criteria', -1, 'Individual circumstances can justify treating similar cases differently.', '即使案例看似相似，个人处境也可能足以支持不同处理方式。'),
  q(2, 'criteria', 1, 'In a hard trade-off, I first ask which choice is most defensible.', '面对艰难取舍时，我首先会问哪个选择最站得住脚。'),
  q(2, 'criteria', -1, 'In a hard trade-off, I first ask who will carry the cost.', '面对艰难取舍时，我首先会问代价最终由谁承担。'),
  // T / F · feedback
  q(2, 'feedback', 1, 'When giving feedback, I prefer to name the gap clearly and then solve it.', '给反馈时，我更愿意先明确指出差距，再一起解决。'),
  q(2, 'feedback', -1, 'Before correcting something, I make room for context and emotional impact.', '纠正问题前，我会先为具体语境和情绪影响留出空间。'),
  q(2, 'feedback', 1, 'I value precise criticism even when its delivery is not especially warm.', '即使表达不算温和，我仍会重视足够精准的批评。'),
  q(2, 'feedback', -1, 'I hear criticism best when the speaker also acknowledges intent or strengths.', '当对方也承认我的出发点或已有优点时，我最能听进去批评。'),
  // T / F · conflict
  q(2, 'conflict', 1, 'I can protect a principle even when doing so raises the tension.', '即使会让气氛变紧张，我也能继续维护重要原则。'),
  q(2, 'conflict', -1, 'Restoring enough trust comes before debating every disputed fact.', '在争论全部事实之前，我更重视先恢复足够的信任。'),
  q(2, 'conflict', 1, 'I can usually separate criticism of an idea from criticism of its author.', '我通常能把对观点的批评和对提出者的批评分开。'),
  q(2, 'conflict', -1, 'Relational consequences are part of what makes a decision reasonable.', '一项决定是否合理，本来就应该包含它对关系造成的后果。'),

  // J / P · planning
  q(3, 'planning', 1, 'I feel better when the route and schedule are decided early.', '路线和时间表尽早确定，会让我感觉更踏实。'),
  q(3, 'planning', -1, 'I leave deliberate space because new information may improve the plan.', '我会有意留出空间，因为新信息可能让计划变得更好。'),
  q(3, 'planning', 1, 'Reservations, calendars and checklists reduce my mental load.', '预约、日历和清单能明显减轻我的心理负担。'),
  q(3, 'planning', -1, 'Too much structure at the beginning can make a project feel constrained.', '一开始结构太多，会让我觉得项目被限制住了。'),
  // J / P · pace
  q(3, 'pace', 1, 'I prefer to begin while a deadline is still comfortably far away.', '我更喜欢在离截止日期还很宽裕时就开始行动。'),
  q(3, 'pace', -1, 'A near deadline often focuses my attention better than an early start.', '相比提前开始，临近截止日期往往更能集中我的注意力。'),
  q(3, 'pace', 1, 'Breaking a long project into visible milestones keeps me moving.', '把长期项目拆成清晰可见的里程碑，会让我持续推进。'),
  q(3, 'pace', -1, 'I tend to explore broadly and converge closer to the finish.', '我倾向先广泛探索，到接近终点时再快速收敛。'),
  // J / P · change
  q(3, 'change', 1, 'Once a decision is complete, I enjoy moving my attention fully onward.', '一项决定完成后，我喜欢把注意力完整地转向下一件事。'),
  q(3, 'change', -1, 'Keeping several viable options open feels useful rather than unfinished.', '保留多个可行选项会让我觉得有用，而不是悬而未决。'),
  q(3, 'change', 1, 'After a last-minute change, I want a revised plan before I can relax.', '遇到临时变化后，我需要先重新形成计划，才能真正放松。'),
  q(3, 'change', -1, 'I can pivot quickly without needing to formalise a new plan first.', '我可以很快转向，不一定要先正式制定一套新计划。'),
];

export const PERSONA_TYPES = {
  INTJ: { en: 'Systems Architect', zh: '系统布局者', dEn: 'You tend to protect reflection time, look for underlying patterns, test decisions for internal coherence and turn complexity into a deliberate route.', dZh: '你倾向保护独立思考时间、寻找底层模式、检验决策是否自洽，并把复杂问题收束成一条深思熟虑的路径。' },
  INTP: { en: 'Model Explorer', zh: '模型探索者', dEn: 'You tend to follow questions beneath the surface, keep conclusions revisable and enjoy improving the model more than defending the first answer.', dZh: '你倾向追问表象之下的问题，让结论保持可修订，并且常常更享受改进模型，而不是维护第一个答案。' },
  ENTJ: { en: 'Strategic Mobiliser', zh: '战略推进者', dEn: 'You tend to externalise a long-range idea quickly, apply consistent criteria and organise people or resources around a defined outcome.', dZh: '你倾向迅速把长期想法外化，用一致标准做取舍，并围绕明确结果组织人与资源。' },
  ENTP: { en: 'Possibility Challenger', zh: '可能性挑战者', dEn: 'You tend to think through exchange, question inherited assumptions and keep several inventive routes alive until one proves worth building.', dZh: '你倾向在交流中思考、挑战既有假设，并同时保留多条原创路线，直到其中一条值得真正落地。' },
  INFJ: { en: 'Pattern Counsellor', zh: '洞察引路者', dEn: 'You tend to read quiet patterns in people and systems, connect choices to human meaning and give those insights an intentional structure.', dZh: '你倾向读出人与系统中的细微模式，把选择和人的意义联系起来，再为这些洞察建立清晰结构。' },
  INFP: { en: 'Values Cartographer', zh: '价值绘图者', dEn: 'You tend to explore inwardly, follow possibilities and use a personal values compass while leaving room for a truer route to emerge.', dZh: '你倾向向内探索、追随可能性，用个人价值罗盘辨别方向，同时给更真实的路径留下浮现空间。' },
  ENFJ: { en: 'People Catalyst', zh: '人群催化者', dEn: 'You tend to create connection, notice how decisions land on people and bring a shared purpose into an organised, forward-moving form.', dZh: '你倾向主动建立连接、察觉决策如何落在人身上，并把共同目标组织成可以向前推进的形式。' },
  ENFP: { en: 'Possibility Spark', zh: '可能性火花', dEn: 'You tend to gain momentum through people and new ideas, connect widely separated patterns and adapt the route around what feels meaningful.', dZh: '你倾向从人与新想法中获得动力，连接彼此遥远的模式，并围绕真正有意义的事灵活调整路径。' },
  ISTJ: { en: 'Dependable Steward', zh: '可靠守序者', dEn: 'You tend to verify the facts, think before speaking and create dependable structure through preparation, continuity and follow-through.', dZh: '你倾向核实事实、先思考再表达，并通过准备、延续性和落实能力建立可靠秩序。' },
  ISFJ: { en: 'Attentive Keeper', zh: '细致守护者', dEn: 'You tend to notice concrete needs, remember quiet commitments and build predictable care around the people and work that matter.', dZh: '你倾向注意具体需要、记住不声张的承诺，并为重要的人与事建立可预期的照顾和支持。' },
  ESTJ: { en: 'Execution Anchor', zh: '执行锚点', dEn: 'You tend to make expectations visible, use practical evidence and convert decisions into schedules, ownership and completed work.', dZh: '你倾向让预期清晰可见、依据实际证据，并把决定转化成时间表、责任归属和真正完成的工作。' },
  ESFJ: { en: 'Community Weaver', zh: '关系编织者', dEn: 'You tend to keep people connected through concrete action, social awareness and enough structure for everyone to know what comes next.', dZh: '你倾向通过具体行动、社交觉察和适度结构维系连接，让每个人都知道接下来会发生什么。' },
  ISTP: { en: 'Adaptive Troubleshooter', zh: '灵活解题者', dEn: 'You tend to observe before acting, isolate the working mechanism and stay open enough to change tactics as reality changes.', dZh: '你倾向先观察再行动、找到真正运作的机制，并保持足够开放，随现实变化及时调整战术。' },
  ISFP: { en: 'Sensory Creator', zh: '感知创造者', dEn: 'You tend to read the immediate environment closely, protect personal values and respond with a flexible, quietly individual touch.', dZh: '你倾向细致感受当下环境、守护个人价值，并以灵活而安静独特的方式作出回应。' },
  ESTP: { en: 'Live Operator', zh: '现场行动者', dEn: 'You tend to engage the situation directly, read concrete feedback quickly and choose the tactic that works in the changing moment.', dZh: '你倾向直接进入现场、迅速读取具体反馈，并在变化之中选择此刻真正有效的做法。' },
  ESFP: { en: 'Experience Maker', zh: '体验营造者', dEn: 'You tend to animate the present through people, sensory detail and humane choices, adapting in real time to keep the experience alive.', dZh: '你倾向通过人与具体体验点亮当下，以有人情味的选择实时调整，让整个体验保持鲜活。' },
};

function preferenceBand(clarity) {
  if (clarity < 12) return 'balanced';
  if (clarity < 30) return 'slight';
  if (clarity < 55) return 'clear';
  return 'pronounced';
}

export function scorePersona(answers) {
  if (!Array.isArray(answers) || answers.length !== PERSONA_QUESTIONS.length) return null;
  if (answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5)) return null;

  const axisTotals = [0, 0, 0, 0];
  const axisCounts = [0, 0, 0, 0];
  const facetTotals = Object.fromEntries(Object.keys(FACET_META).map((key) => [key, 0]));
  const facetCounts = Object.fromEntries(Object.keys(FACET_META).map((key) => [key, 0]));

  PERSONA_QUESTIONS.forEach((item, index) => {
    const contribution = (answers[index] - 3) * item.dir;
    axisTotals[item.axis] += contribution;
    axisCounts[item.axis] += 1;
    facetTotals[item.facet] += contribution;
    facetCounts[item.facet] += 1;
  });

  const axes = axisTotals.map((total, axis) => {
    const max = axisCounts[axis] * 2;
    const pctA = Math.round(((total + max) / (max * 2)) * 100);
    const pctB = 100 - pctA;
    const clarity = Math.round(Math.abs(pctA - 50) * 2);
    return {
      a: pctA,
      b: pctB,
      pctA,
      pctB,
      letter: total === 0 ? 'X' : AXIS_LETTERS[axis][total > 0 ? 0 : 1],
      clarity,
      balanced: clarity < 12,
      band: preferenceBand(clarity),
    };
  });

  const facets = Object.entries(FACET_META).map(([key, meta]) => {
    const total = facetTotals[key];
    const max = facetCounts[key] * 2;
    const pctFirst = Math.round(((total + max) / (max * 2)) * 100);
    return {
      key,
      axis: meta.axis,
      pctFirst,
      pctSecond: 100 - pctFirst,
      leaning: total > 0 ? 'first' : total < 0 ? 'second' : 'balanced',
      clarity: Math.round(Math.abs(pctFirst - 50) * 2),
    };
  });

  return {
    version: 2,
    type: axes.map((axis) => axis.letter).join(''),
    axes,
    facets,
    answered: answers.length,
  };
}
