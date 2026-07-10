/* ============================================================
   EQ QUIZ (V23 follow-up) — original ~15-question scenario bank
   across five widely-discussed EQ dimensions (self-awareness,
   self-regulation, motivation, empathy, social skills — Goleman's
   public framework, not a trademark, not reproduced verbatim).
   Reflective, entertainment-only; NOT a validated psychometric
   instrument, same posture as persona.js's MBTI clone and
   logicQuiz.js's puzzle set.

   Each question belongs to one dimension and offers 4 responses
   scored 0-3 (least → most emotionally-attuned for that dimension,
   by this site's own original judgment — not a clinical rubric).
   Result: a 5-dimension 0-100 score per axis (renderable with the
   existing astroChart.js renderRadar(), same shape as the L2 radar)
   plus an overall average.
   ============================================================ */

export const EQ_DIMENSIONS = [
  { key: 'awareness', en: 'Self-Awareness', zh: '自我觉察' },
  { key: 'regulation', en: 'Self-Regulation', zh: '自我调节' },
  { key: 'motivation', en: 'Motivation', zh: '内驱力' },
  { key: 'empathy', en: 'Empathy', zh: '共情力' },
  { key: 'social', en: 'Social Skills', zh: '社交技巧' },
];

// dim: index into EQ_DIMENSIONS. opts: 4 responses, scored 0/1/2/3 by index.
export const EQ_QUESTIONS = [
  // ---- Self-Awareness ----
  { dim: 0, q: ['You snap at a coworker. Minutes later, you…', '你对同事发了脾气，几分钟后你……'], opts: [
    ["Don't think about it again", '没再想这事'], ['Feel bad but can\'t say why', '心里不舒服但说不清为什么'],
    ["Realise you're stressed about something else and it leaked out", '意识到是别的压力泄漏了出来'], ['Already knew exactly what triggered it before it even happened', '事情发生前就已经清楚地知道导火索是什么'],
  ] },
  { dim: 0, q: ['Someone asks how you\'re really feeling today. You…', '有人问你今天真实感觉如何，你……'], opts: [
    ['Say "fine" on autopilot', '下意识地说「还行」'], ['Have to stop and think for a while', '得停下来想一会儿'],
    ["Can name the feeling but not always why", '能说出情绪但说不清原因'], ["Can name the feeling and its source right away", '能立刻说清情绪和它的来源'],
  ] },
  { dim: 0, q: ["When you're in a bad mood, you usually…", '心情不好的时候，你通常……'], opts: [
    ["Don't notice until someone points it out", '要别人提醒才发现'], ['Notice late, after it\'s already affected your day', '事后很久才后知后觉'],
    ['Notice once it fully arrives', '情绪完全上来后才察觉'], ['Feel it building before it fully lands', '在它真正到来之前就感觉到在酝酿'],
  ] },
  // ---- Self-Regulation ----
  { dim: 1, q: ['Someone cuts you off in traffic. Your first move:', '开车时被人别了一下，你的第一反应：'], opts: [
    ['Lay on the horn, stay annoyed for a while', '狂按喇叭，气很久'], ['Vent out loud immediately', '立刻大声抱怨'],
    ['Feel the flash of anger, let it pass in a minute', '瞬间的火气，一分钟内就过去'], ['Barely register it, back to your thoughts', '几乎没在意，思路照常'],
  ] },
  { dim: 1, q: ['A plan you cared about falls through last-minute. You…', '很在意的计划临时泡汤，你……'], opts: [
    ['Spiral for the rest of the day', '一整天都提不起劲'], ['Need real time alone to reset', '需要独处很久才能缓过来'],
    ['Feel it, then pivot within the hour', '难受一下，一小时内调整过来'], ['Adjust almost immediately and move on', '几乎立刻调整，继续往前走'],
  ] },
  { dim: 1, q: ['Mid-argument, you notice your voice rising. You…', '吵架吵到一半，你发现自己声音变大了，你……'], opts: [
    ["Don't notice until it's already loud", '已经很大声了才发现'], ['Notice but can\'t stop it in the moment', '发现了但当下停不下来'],
    ['Catch it and consciously lower it', '察觉后主动压低音量'], ['Rarely get here — you regulate before it builds', '很少走到这一步，情绪起来前就先调节了'],
  ] },
  // ---- Motivation ----
  { dim: 2, q: ['A goal is taking longer than expected. You…', '一个目标比预期花更久，你……'], opts: [
    ['Lose interest and drift to something else', '失去兴趣，转去做别的'], ['Keep going but resent it', '继续做但心里有怨气'],
    ['Adjust the plan and keep pushing', '调整计划，继续推进'], ['Get more focused, not less', '反而更专注了'],
  ] },
  { dim: 2, q: ['You hit a setback on something you care about. You…', '在很在意的事上受挫，你……'], opts: [
    ['Take it as a sign to quit', '觉得这是该放弃的信号'], ['Need a while before trying again', '要过一阵子才愿意再试'],
    ['Feel discouraged, then get back to it', '沮丧一下，然后重新开始'], ["Already looking for what to do differently", '已经在想下次该怎么不一样'],
  ] },
  { dim: 2, q: ['What gets you out of bed on a hard day?', '难熬的一天，是什么让你起床？'], opts: [
    ["Not much, some days just don't happen", '没什么特别的，有些日子就这么过去了'], ["Obligation — someone's counting on me", '责任——有人在等我'],
    ['A mix of duty and genuine want-to', '责任和真心想做的混合'], ['A clear sense of where I\'m headed', '很清楚自己要去哪儿'],
  ] },
  // ---- Empathy ----
  { dim: 3, q: ['A friend vents about a problem you think has an obvious fix. You…', '朋友倾诉一个你觉得有明显解法的问题，你……'], opts: [
    ['Tell them the fix right away', '立刻告诉对方怎么解决'], ['Half-listen while waiting to give advice', '半听半等着给建议'],
    ['Listen fully, offer the fix if they ask', '完整听完，对方问了才给建议'], ['Listen for what they actually need first — could be comfort, not answers', '先听清对方真正需要什么——也许只是想被安慰'],
  ] },
  { dim: 3, q: ['Someone in the room goes quiet during a conversation. You…', '聊天时有人突然安静下来，你……'], opts: [
    ["Don't really notice", '没太注意到'], ["Notice but assume it's nothing", '注意到了但觉得没什么'],
    ['Notice and wonder what\'s going on for them', '注意到并好奇对方怎么了'], ['Notice, and quietly check in later', '注意到，之后私下问候一下'],
  ] },
  { dim: 3, q: ['A stranger is rude to you at checkout. Your instinct:', '结账时陌生人对你很没礼貌，你的直觉：'], opts: [
    ["They're just a rude person", '这人就是没礼貌'], ['Get annoyed, move on', '生气一下，然后算了'],
    ["Wonder if they're having a hard day", '想对方是不是正过得很糟'], ['Feel for them, even mid-annoyance', '就算生气也替对方感到难过'],
  ] },
  // ---- Social Skills ----
  { dim: 4, q: ['In a group disagreement, you tend to…', '小组意见不合时，你倾向于……'], opts: [
    ['Go quiet or check out', '沉默或干脆走神'], ['Push your point until it lands', '坚持己见直到说服对方'],
    ['Find where people actually agree first', '先找到大家真正一致的地方'], ['Naturally guide the room toward a resolution', '自然地把大家引向解决方案'],
  ] },
  { dim: 4, q: ['Meeting someone new, you…', '认识新朋友时，你……'], opts: [
    ['Wait for them to start talking', '等对方先开口'], ['Make small talk but it feels effortful', '会寒暄但感觉很费劲'],
    ['Find something genuine to connect over', '找到真正能聊到一起的话题'], ['They usually leave feeling like old friends', '对方走的时候常常感觉像认识很久了'],
  ] },
  { dim: 4, q: ['You have to deliver unwelcome news to someone. You…', '要向某人传达一个不太好的消息，你……'], opts: [
    ['Avoid it as long as possible', '能拖多久拖多久'], ['Say it bluntly and move on', '直接说完就走'],
    ['Soften it but stay clear', '委婉但表达清楚'], ['Say it clearly and kindly, and read how they take it', '说得清楚又体贴，并留意对方的反应'],
  ] },
];

// answers: array of chosen option-index (0-3), same length/order as EQ_QUESTIONS.
// Returns { dims:[{key,en,zh,value}] (5, value 0-100), overall } or null.
export function scoreEQ(answers) {
  if (!Array.isArray(answers) || answers.length !== EQ_QUESTIONS.length) return null;
  const totals = EQ_DIMENSIONS.map(() => 0);
  const counts = EQ_DIMENSIONS.map(() => 0);
  EQ_QUESTIONS.forEach((q, i) => {
    const v = answers[i];
    if (typeof v !== 'number' || v < 0 || v > 3) return;
    totals[q.dim] += v;
    counts[q.dim]++;
  });
  const dims = EQ_DIMENSIONS.map((d, k) => ({ ...d, value: counts[k] ? Math.round((totals[k] / (counts[k] * 3)) * 100) : 0 }));
  const overall = Math.round(dims.reduce((s, d) => s + d.value, 0) / dims.length);
  return { dims, overall };
}
