/* ============================================================
   LOGIC QUIZ (V23 follow-up) — original ~16-question puzzle bank:
   number sequences, verbal analogies, odd-one-out, short logic
   puzzles. Playful, NOT a clinically validated or norm-referenced
   IQ instrument, and no such claim is made anywhere on the page —
   same entertainment-only posture as persona.js's MBTI clone.

   Each question: 4 options, one correct index. Score = correct count,
   mapped to a playful band. A "for-fun" numeric score is also derived
   (never called a real IQ score) purely for the same shareable flavour
   the MBTI quiz already has.
   ============================================================ */

// q/opts: [en, zh]. correct: index into opts (0-3).
export const LOGIC_QUESTIONS = [
  // ---- number sequences ----
  { q: ['2, 4, 8, 16, ?', '2, 4, 8, 16, ?'], opts: [['24', '24'], ['32', '32'], ['30', '30'], ['20', '20']], correct: 1, t: 40 },
  { q: ['1, 1, 2, 3, 5, 8, ?', '1, 1, 2, 3, 5, 8, ?'], opts: [['11', '11'], ['13', '13'], ['15', '15'], ['21', '21']], correct: 1, t: 40 },
  { q: ['3, 6, 11, 18, 27, ?', '3, 6, 11, 18, 27, ?'], opts: [['36', '36'], ['38', '38'], ['40', '40'], ['34', '34']], correct: 1, t: 45 },
  { q: ['5, 10, 9, 18, 17, ?', '5, 10, 9, 18, 17, ?'], opts: [['34', '34'], ['33', '33'], ['35', '35'], ['32', '32']], correct: 0, t: 45 },
  { q: ['2, 3, 5, 9, 17, ?', '2, 3, 5, 9, 17, ?'], opts: [['33', '33'], ['31', '31'], ['35', '35'], ['29', '29']], correct: 0, t: 50 },
  // ---- verbal analogies ----
  { q: ['Book is to Library as Painting is to ?', '书之于图书馆，如同画之于？'], opts: [['Frame', '画框'], ['Gallery', '美术馆'], ['Wall', '墙'], ['Artist', '画家']], correct: 1, t: 25 },
  { q: ['Doctor is to Hospital as Teacher is to ?', '医生之于医院，如同老师之于？'], opts: [['Book', '书'], ['School', '学校'], ['Student', '学生'], ['Class', '班级']], correct: 1, t: 25 },
  { q: ['Pen is to Write as Knife is to ?', '笔之于写字，如同刀之于？'], opts: [['Cut', '切'], ['Kitchen', '厨房'], ['Sharp', '锋利'], ['Metal', '金属']], correct: 0, t: 25 },
  { q: ["What means the opposite of 'Abundant'?", "哪个词与「充裕」意思相反？"], opts: [['Plentiful', '富足'], ['Scarce', '匮乏'], ['Ample', '充足'], ['Generous', '慷慨']], correct: 1, t: 25 },
  // ---- odd one out ----
  { q: ['Which one does not belong: Triangle, Square, Circle, Cube', '哪个不属于同类：三角形、正方形、圆形、立方体'], opts: [['Triangle', '三角形'], ['Square', '正方形'], ['Circle', '圆形'], ['Cube', '立方体']], correct: 3, t: 30 },
  { q: ['Which one does not belong: Salmon, Trout, Dolphin, Cod', '哪个不属于同类：鲑鱼、鳟鱼、海豚、鳕鱼'], opts: [['Salmon', '鲑鱼'], ['Trout', '鳟鱼'], ['Dolphin', '海豚'], ['Cod', '鳕鱼']], correct: 2, t: 30 },
  { q: ['Which one does not belong: 3, 5, 7, 10, 11', '哪个不属于同类：3, 5, 7, 10, 11'], opts: [['3', '3'], ['5, 7', '5, 7'], ['10', '10'], ['11', '11']], correct: 2, t: 35 },
  // ---- logic puzzles ----
  { q: ['All Zibs are Morks. All Morks are Fenz. So all Zibs are ?', '所有 Zib 都是 Mork，所有 Mork 都是 Fenz，那么所有 Zib 都是？'], opts: [['Fenz', 'Fenz'], ['Only Morks', '只是 Mork'], ['Neither', '都不是'], ['Cannot tell', '无法判断']], correct: 0, t: 45 },
  { q: ['Amy is taller than Ben. Ben is taller than Cara. Who is shortest?', 'Amy 比 Ben 高，Ben 比 Cara 高，谁最矮？'], opts: [['Amy', 'Amy'], ['Ben', 'Ben'], ['Cara', 'Cara'], ['Cannot tell', '无法判断']], correct: 2, t: 40 },
  { q: ['A, C, E, G, ?', 'A, C, E, G, ?'], opts: [['H', 'H'], ['I', 'I'], ['J', 'J'], ['K', 'K']], correct: 1, t: 35 },
  { q: ['If today is Monday, what day is it in 100 days?', '今天是周一，100 天后是周几？'], opts: [['Tuesday', '周二'], ['Wednesday', '周三'], ['Thursday', '周四'], ['Friday', '周五']], correct: 1, t: 45 },
];

// min correct → band, checked from highest to lowest.
export const LOGIC_BANDS = [
  { key: 'blaze', min: 14, en: 'Blazing', zh: '思维如电', dEn: 'You tore through pattern after pattern. Whatever this measures, you\'ve got it warmed up.', dZh: '一路势如破竹地拆解每道题——不管这测的是什么，你今天状态在线。' },
  { key: 'quick', min: 11, en: 'Quick', zh: '反应敏捷', dEn: 'Solid, fast pattern-spotting with only the odd stumble. Nicely done.', dZh: '找规律又快又稳，偶尔小失误无伤大雅，表现不错。' },
  { key: 'sharp', min: 7, en: 'Warming Up', zh: '渐入佳境', dEn: 'A respectable run — some clicked instantly, some needed a second look. That\'s normal.', dZh: '整体不错——有些题一眼看穿，有些多想了一下，都很正常。' },
  { key: 'start', min: 0, en: 'Just Getting Started', zh: '刚刚上手', dEn: 'These puzzle types take a little warm-up. A second attempt almost always goes better.', dZh: '这类谜题需要一点热身，再玩一次通常会顺很多。' },
];

// answers: array of chosen option-index, same length/order as LOGIC_QUESTIONS.
// A null/undefined entry means the per-question timer (q.t seconds, U3)
// expired — it scores as wrong, and the timeout count is reported so the
// result screen can show it.
// Returns { correct, total, timeouts, band:{key,en,zh,dEn,dZh}, funScore } or null.
// funScore: a playful 70-150-ish number in real-IQ-scale shape, purely for
// entertainment flavour — never presented as an actual measured IQ.
export function scoreLogic(answers) {
  if (!Array.isArray(answers) || answers.length !== LOGIC_QUESTIONS.length) return null;
  let correct = 0, timeouts = 0;
  LOGIC_QUESTIONS.forEach((q, i) => {
    if (answers[i] === q.correct) correct++;
    else if (answers[i] == null) timeouts++;
  });
  const band = LOGIC_BANDS.find((b) => correct >= b.min);
  return { correct, total: LOGIC_QUESTIONS.length, timeouts, band, funScore: 70 + correct * 5 };
}
