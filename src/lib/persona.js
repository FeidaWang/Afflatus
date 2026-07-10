/* ============================================================
   PERSONA (十六型人格速测) — V21 Phase 4.

   An ORIGINAL quick quiz in the public four-axis tradition (E/I, S/N,
   T/F, J/P). All 24 questions and all 16 type write-ups below are
   original text written for this site. "MBTI" and "Myers-Briggs Type
   Indicator" are trademarks of the Myers & Briggs Foundation; this quiz
   is not affiliated with or endorsed by them (or by 16personalities),
   and the page says so next to the quiz. Entertainment only.

   C5 note (roadmap §7.8.2): evaluated as a horoscope.html SECTION, not a
   ninth page — an Astro migration is not justified by one entertainment
   quiz, and the no-new-page rule stands.

   Scoring: 8 questions per axis (32 total), answer 'a' leans the first
   pole (E/S/T/J), 'b' the second (I/N/F/P). Ties (4-4) break toward the
   second pole — the common convention for short-form four-axis quizzes.

   MATCH_FRICTION (added alongside the 6→8-question expansion): for each
   of the 16 types, two informal "vibes well with" types and one "tends
   to friction with" type. This is pop-culture MBTI-compatibility
   folklore, not a validated instrument — presented exactly as playfully
   as the rest of this quiz, purely for entertainment.
   ============================================================ */

// axis: which pair; a = first-pole answer, b = second-pole answer.
export const PERSONA_QUESTIONS = [
  // ---- E / I ----
  { axis: 0, q: ['What recharges you on a weekend?', '周末最能给你充电的是？'], a: ['A lively day out with friends', '和朋友热闹一场'], b: ['A quiet day entirely to myself', '独处安静一天'] },
  { axis: 0, q: ['At a party you usually…', '在聚会上你通常……'], a: ['Drift around meeting new faces', '主动认识新面孔'], b: ['Find one corner and talk deep with someone I know', '和熟人待在角落聊深一点'] },
  { axis: 0, q: ['Your thoughts become clear…', '你的想法通常是……'], a: ['As I talk them out', '说着说着才清晰'], b: ['Before I say a word', '想清楚了才开口'] },
  { axis: 0, q: ['After three days of socialising…', '连续社交三天后你……'], a: ['I could keep going', '意犹未尽'], b: ['I badly need to recover alone', '急需独处回血'] },
  { axis: 0, q: ['At work you prefer…', '工作时你更喜欢……'], a: ['Open discussion, thinking together', '开放讨论边聊边做'], b: ['Digging in alone first, then presenting', '先自己钻研再汇报'] },
  { axis: 0, q: ['In a new environment you…', '到新环境里你……'], a: ['Warm up fast', '很快熟络起来'], b: ['Need a warm-up period', '需要一段预热期'] },
  { axis: 0, q: ['A group project stalls. You…', '小组项目卡住了，你……'], a: ['Call a meeting to talk it through', '拉个会一起聊透'], b: ['Message people one at a time', '一个个私聊沟通'] },
  { axis: 0, q: ['Your ideal Friday night:', '理想的周五夜晚：'], a: ['Out somewhere with people', '在外面和人一起'], b: ['In, on my own terms', '在家，按自己的节奏'] },
  // ---- S / N ----
  { axis: 1, q: ['When you read, what pulls you in?', '读东西时更吸引你的是？'], a: ['Concrete facts and details', '具体的事实与细节'], b: ['The meaning behind them, the possibilities', '背后的含义与可能性'] },
  { axis: 1, q: ['Cooking, you tend to…', '做菜你倾向……'], a: ['Follow the recipe precisely', '按菜谱精确执行'], b: ['Improvise by feel', '凭感觉即兴发挥'] },
  { axis: 1, q: ['You would rather chat about…', '聊天你更喜欢聊……'], a: ['Things that actually happened', '真实发生的事'], b: ['What-ifs and wild ideas', '假设与脑洞'] },
  { axis: 1, q: ['Learning something new, you first want…', '学新东西时你先要……'], a: ['Examples and steps', '例子和步骤'], b: ['The principle and the big picture', '原理和全貌'] },
  { axis: 1, q: ['You trust more…', '你更信任……'], a: ['Experience I have verified myself', '亲身验证过的经验'], b: ['A flash of intuition', '直觉闪现的判断'] },
  { axis: 1, q: ['Describing an event, you…', '描述一件事时你……'], a: ['Walk through the details in order', '按时间顺序讲清细节'], b: ['Jump straight to what it means', '直接讲它"意味着什么"'] },
  { axis: 1, q: ['To find your way somewhere new, you trust more…', '去陌生地方，你更信……'], a: ['A map with exact directions', '标好路线的地图'], b: ["A friend's story about the vibe of the place", '朋友讲的那地方的感觉'] },
  { axis: 1, q: ['You remember a conversation mostly by…', '你记住一段对话主要靠……'], a: ['What was actually said', '实际说过的话'], b: ['What it all added up to', '这段对话给你的整体感觉'] },
  // ---- T / F ----
  { axis: 2, q: ['A friend brings you a problem. Your first instinct:', '朋友向你倾诉困境，你的第一反应是：'], a: ['Help analyse how to fix it', '帮忙分析怎么解决'], b: ['Catch their feelings first', '先接住对方的情绪'] },
  { axis: 2, q: ['When deciding, you weigh more…', '做决定时你更看重……'], a: ['Whether it holds up logically', '逻辑上说得通'], b: ['Whether everyone involved is okay', '相关的人都舒服'] },
  { axis: 2, q: ['When criticised, you care more about…', '被批评时你更在意……'], a: ['Whether the criticism is valid', '批评有没有道理'], b: ['The tone it was delivered in', '对方的态度和语气'] },
  { axis: 2, q: ['Which is worse?', '你觉得更糟糕的是？'], a: ['Being unreasonable', '不讲道理'], b: ['Being unkind', '不近人情'] },
  { axis: 2, q: ['Judging a film, you ask…', '评价一部电影时你先问……'], a: ['Did the plot hold together?', '剧情逻辑是否自洽？'], b: ['Did it move me?', '有没有打动我？'] },
  { axis: 2, q: ['In a conflict you tend to…', '冲突发生时你倾向……'], a: ['Keep it about the facts', '就事论事讲清楚'], b: ['Repair the relationship first', '先修复关系再谈事'] },
  { axis: 2, q: ['Giving feedback, you lead with…', '给反馈时你先说……'], a: ['What needs to change', '需要改的地方'], b: ['What already works', '已经做得好的地方'] },
  { axis: 2, q: ['A rule seems unfair in one specific case. You…', '一条规矩在某个具体情况下显得不公平，你……'], a: ['Still apply it — consistency matters', '依然照章执行，一致性很重要'], b: ['Make an exception for the person', '为这个人破例'] },
  // ---- J / P ----
  { axis: 3, q: ['Before a trip you…', '旅行出发前你……'], a: ['Plan each day out', '排好每天的行程'], b: ['Book flights and wing the rest', '订好机酒剩下随缘'] },
  { axis: 3, q: ['Deadlines:', '对你来说 deadline 是……'], a: ['Finished days early or I can\'t relax', '提前几天完成才安心'], b: ['The last minute is when I catch fire', '最后一刻爆发效率最高'] },
  { axis: 3, q: ['Your desktop / folders are…', '你的桌面/文件夹是……'], a: ['Neatly organised', '分类清晰'], b: ['Chaotic, but I can find everything', '混沌但我自己找得到'] },
  { axis: 3, q: ['Plans change at the last minute. You…', '计划被临时打乱，你……'], a: ['Get antsy until I re-plan', '烦躁，需要重新排好'], b: ['Shrug and go with it', '无所谓，顺势而为'] },
  { axis: 3, q: ['Shopping, you…', '购物时你……'], a: ['Bring a list and hit the targets', '列好清单直奔目标'], b: ['Wander until it finds me', '逛着逛着就知道要什么'] },
  { axis: 3, q: ['You prefer things…', '你更喜欢的状态是……'], a: ['Settled and decided', '尘埃落定'], b: ['Open, with options alive', '保持开放选项'] },
  { axis: 3, q: ['A blank calendar for next weekend feels…', '下周末的日历一片空白，你觉得……'], a: ["Slightly stressful — let's fill it", '有点不安，得排点事'], b: ['Perfect — anything could happen', '刚好——什么都可能发生'] },
  { axis: 3, q: ['You actually start a task when…', '你真正动手做一件事，是因为……'], a: ["It's time to, per the plan", '按计划到点了'], b: ['The mood or inspiration strikes', '感觉或灵感来了'] },
];

export const AXIS_LETTERS = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];

// answers: array of 'a' | 'b', same length/order as PERSONA_QUESTIONS.
// Returns { type, axes: [{a,b,letter}] } — ties break toward the second pole.
export function scorePersona(answers) {
  if (!Array.isArray(answers) || answers.length !== PERSONA_QUESTIONS.length) return null;
  const tally = [[0, 0], [0, 0], [0, 0], [0, 0]];
  PERSONA_QUESTIONS.forEach((q, i) => {
    if (answers[i] === 'a') tally[q.axis][0]++;
    else if (answers[i] === 'b') tally[q.axis][1]++;
    else return; // unanswered guard — caller prevents this
  });
  const axes = tally.map(([a, b], k) => ({ a, b, letter: AXIS_LETTERS[k][a > b ? 0 : 1] }));
  return { type: axes.map((x) => x.letter).join(''), axes };
}

// Original one-liner + short read for each type (site's own text, healing tone).
export const PERSONA_TYPES = {
  INTJ: { zh: '沉静的布局者', en: 'The Quiet Strategist', dZh: '脑内常年运行着一张长期地图，享受把复杂的事收敛成一条清晰的路。记得偶尔把地图摊开给别人看看。', dEn: 'You carry a long-range map in your head and love collapsing complexity into one clean path. Remember to show others the map sometimes.' },
  INTP: { zh: '好奇的拆解者', en: 'The Curious Analyst', dZh: '对"为什么"上瘾，凡事都想拆到原理层。你的世界很安静，但思维从不休息。', dEn: 'Addicted to "why", you take everything apart down to first principles. Your world is quiet; your mind never is.' },
  ENTJ: { zh: '天生的推进器', en: 'The Born Driver', dZh: '看见目标就想立刻搭出路径，把混乱变成秩序是你的舒适区。留一点耐心给走得慢的人。', dEn: 'You see a goal and immediately build the road to it. Turning chaos into order is home for you — save some patience for slower walkers.' },
  ENTP: { zh: '灵感的放风筝人', en: 'The Idea Kiteflyer', dZh: '新点子像风筝一样一只接一只放上天，辩论是你的运动。偶尔也要挑一只风筝收线落地。', dEn: 'You fly new ideas like kites, one after another, and debate is your sport. Occasionally reel one in and land it.' },
  INFJ: { zh: '提灯的倾听者', en: 'The Lantern Bearer', dZh: '安静，却对他人的情绪有显微镜般的分辨率。你在乎意义多过热闹，能量珍贵，记得先照亮自己。', dEn: 'Quiet, with microscope-grade resolution for other people\'s feelings. You care about meaning over noise — your light is precious, shine it on yourself first.' },
  INFP: { zh: '温柔的理想主义者', en: 'The Gentle Idealist', dZh: '内心住着一套非常坚定的价值观和一片很大的海。世界的粗糙常让你疲惫，但你总能长出新的柔软。', dEn: 'Inside you live firm values and a very large sea. The world\'s roughness tires you, yet you keep growing new softness.' },
  ENFJ: { zh: '暖场的引路人', en: 'The Warm Guide', dZh: '天然会把一群人拧成一股绳，也天然把别人的需要排在自己前面。偶尔请把自己排进日程。', dEn: 'You naturally braid a group into one rope — and naturally put others\' needs first. Put yourself on the schedule sometimes.' },
  ENFP: { zh: '行走的小太阳', en: 'The Walking Sunbeam', dZh: '热情有传染性，对人和可能性都保持敞开。你的火花很多，能坚持给其中几颗添柴就会很惊人。', dEn: 'Your enthusiasm is contagious and you stay open to people and possibilities alike. You throw many sparks — tend a few into fires and you\'re unstoppable.' },
  ISTJ: { zh: '可靠的基石', en: 'The Steady Keystone', dZh: '说到做到，流程和承诺在你手里都很安全。变化让你皱眉，但你适应得比自己以为的好。', dEn: 'You do what you said you would; processes and promises are safe in your hands. Change makes you frown — you adapt better than you think.' },
  ISFJ: { zh: '安静的守护者', en: 'The Quiet Guardian', dZh: '记得每个人的小事，用具体的照顾表达在乎。你撑伞的样子很好看，也别忘了自己头顶的雨。', dEn: 'You remember everyone\'s small things and care through concrete acts. You hold umbrellas beautifully — mind the rain over your own head too.' },
  ESTJ: { zh: '靠谱的主理人', en: 'The Reliable Organiser', dZh: '规则、清单、执行力——事情交到你手上就会被办完。练习偶尔容忍"够好"，世界不会塌。', dEn: 'Rules, lists, follow-through: hand you a thing and it gets done. Practice tolerating "good enough" now and then — the sky will hold.' },
  ESFJ: { zh: '热心的张罗人', en: 'The Warm Host', dZh: '聚会因你成型，关系因你保温。你对气氛的经营是真本事，但不必对每个人的情绪负责。', dEn: 'Gatherings take shape around you; relationships stay warm because of you. Reading a room is a real skill — but every mood is not your job.' },
  ISTP: { zh: '冷静的巧匠', en: 'The Calm Tinkerer', dZh: '手上功夫和临场判断都稳，话不多，事很准。你的酷是真的酷，偶尔多说两句没人会嫌。', dEn: 'Steady hands, sharp in-the-moment judgement, few words, precise work. Your cool is real — a few extra sentences wouldn\'t hurt.' },
  ISFP: { zh: '采风的生活家', en: 'The Wandering Aesthete', dZh: '对美和当下的质感极其敏感，活法本身就是你的作品。别让"不争"变成"不说"。', dEn: 'Exquisitely tuned to beauty and the texture of now — your way of living is itself the artwork. Don\'t let "easygoing" become "unheard".' },
  ESTP: { zh: '破浪的行动派', en: 'The Wavebreaker', dZh: '现场感极强，越是变化越兴奋，先做再说是你的信条。大多数时候这很灵，记得系好安全绳。', dEn: 'You thrive live and in motion — the more things change, the more awake you feel. Acting first usually works; clip into the safety rope anyway.' },
  ESFP: { zh: '氛围的点灯人', en: 'The Room Brightener', dZh: '你一进门，房间的亮度先升一档。快乐在你这里是即时的、大方的、会分享的。偶尔的安静也值得体验。', dEn: 'The room brightens a notch when you walk in. Joy, for you, is immediate, generous, shared. The occasional quiet is worth tasting too.' },
};

// Pop-culture MBTI-compatibility folklore (not a validated instrument —
// same entertainment-only posture as the rest of this quiz). match: two
// types that tend to click; friction: the one that tends to spark.
export const PERSONA_MATCH = {
  INTJ: { match: ['ENFP', 'ENTP'], friction: 'ESFJ' },
  INTP: { match: ['ENTJ', 'ENFJ'], friction: 'ESFJ' },
  ENTJ: { match: ['INFP', 'INTP'], friction: 'ISFP' },
  ENTP: { match: ['INFJ', 'INTJ'], friction: 'ISFJ' },
  INFJ: { match: ['ENTP', 'ENFP'], friction: 'ESTP' },
  INFP: { match: ['ENFJ', 'ENTJ'], friction: 'ESTJ' },
  ENFJ: { match: ['INFP', 'ISFP'], friction: 'ISTP' },
  ENFP: { match: ['INTJ', 'INFJ'], friction: 'ISTJ' },
  ISTJ: { match: ['ESFP', 'ESTP'], friction: 'ENFP' },
  ISFJ: { match: ['ESFP', 'ESTP'], friction: 'ENTP' },
  ESTJ: { match: ['ISFP', 'ISTP'], friction: 'INFP' },
  ESFJ: { match: ['ISFP', 'ISTP'], friction: 'INTP' },
  ISTP: { match: ['ESTJ', 'ESFJ'], friction: 'ENFJ' },
  ISFP: { match: ['ESTJ', 'ENFJ'], friction: 'ENTJ' },
  ESTP: { match: ['ISFJ', 'ISTJ'], friction: 'INFJ' },
  ESFP: { match: ['ISTJ', 'ISFJ'], friction: 'INTJ' },
};
