export const JOURNAL_KEY = 'afflatus-horo:journal:v1';
export const DRAW_VERSION = 1;

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDay(day, amount) {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + amount, 12));
}
export function dayIndex(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / 86400000);
}

// Original editorial prompts. Neither random draws nor calendar rotation are
// evidence of personality, compatibility, health or future events.
export const DAILY_PROMPTS = [
  ['把心事放轻。', '写下一件你可以暂时放下的事。', 'Let the day feel lighter.', 'Write down one thing you can set aside for now.'],
  ['慢一点，也在向前。', '给一件重要的小事，留十分钟。', 'Slow is still forward.', 'Give one small, important thing ten minutes.'],
  ['不必一次想明白。', '把大问题，写成一个可以开始的小问题。', 'You can take your time.', 'Turn a big question into one small place to start.'],
  ['留一点时间给自己。', '找一个安静的位置，停留片刻。', 'Leave room for yourself.', 'Find a quiet place and stay for a moment.'],
  ['先听见，再回答。', '今天的一次对话，试着多听一句。', 'Listen before you answer.', 'In one conversation today, listen a little longer.'],
  ['把注意力放回眼前。', '写下此刻最值得你照顾的一件事。', 'Come back to what is here.', 'Name one thing that deserves your attention now.'],
  ['允许今天有留白。', '不用填满所有空闲，给自己一段没有任务的时间。', 'Let there be some space.', 'Leave a little time without a task attached.'],
  ['让小小的喜欢发生。', '记录一个今天让你微笑的细节。', 'Make room for small joys.', 'Notice one detail that made you smile today.'],
  ['不着急证明自己。', '今天做成的一件小事，已经值得记下。', 'Nothing to prove right now.', 'Write down one small thing you managed today.'],
  ['给关系一点温度。', '向一个你在意的人，发出真诚的问候。', 'Bring some warmth.', 'Offer someone you care about a sincere hello.'],
  ['向自己的节奏靠近。', '回想今天什么时候，你最像自己。', 'Find your own pace.', 'When did you feel most like yourself today?'],
  ['未完成，也可以暂停。', '写好下一步，然后安心离开一会儿。', 'Unfinished can still rest.', 'Write down the next step, then take a break.'],
  ['把感受说得具体。', '从“我现在感到……”开始写一句话。', 'Give a feeling a name.', 'Begin one sentence with “Right now, I feel…”.'],
  ['为明天留一点余地。', '选一件明天想继续的小事，其余的先放下。', 'Leave room for tomorrow.', 'Choose one thing to continue tomorrow; set the rest aside.'],
];

export const LIFE_AREAS = [
  { id:'wellbeing', zh:'身心', en:'Wellbeing', title:['照顾自己的节奏','Care for your pace'], action:['离开屏幕，活动片刻。为今晚留一段不被打扰的休息时间。','Step away from the screen for a moment. Leave some uninterrupted time to rest.'], question:['你此刻需要的是休息、陪伴，还是一点独处？','Do you need rest, company, or a little time alone?'] },
  { id:'wealth', zh:'财富', en:'Money', title:['看清自己的选择','Notice your choices'], action:['回顾一笔最近的支出，想想它是否符合你真正重视的事情。','Look back at one recent expense. Did it support something you actually value?'], question:['有什么消费，是可以先想一想再决定的？','Is there a purchase you would like more time to consider?'] },
  { id:'career', zh:'事业', en:'Work', title:['让下一步更具体','Make the next step small'], action:['从待办中选一件重要的事，写下一个可以在十分钟内开始的步骤。','Choose one important task and a first step you can start in ten minutes.'], question:['哪些事情需要今天完成，哪些可以重新安排？','What needs doing today, and what can be rescheduled?'] },
  { id:'friendship', zh:'友情', en:'Friendship', title:['在倾听里靠近','Make room to listen'], action:['想起一个朋友。可以问问对方最近怎么样，也给回复留一点空间。','Think of a friend. Ask how they have been, and give them room to reply.'], question:['哪一段友谊，让你感到自在而被理解？','Which friendship lets you feel at ease and understood?'] },
  { id:'love', zh:'爱情', en:'Love', title:['把需要说清楚','Give your needs a voice'], action:['用“我希望……”表达一个具体需要。单身时，也可以写给自己。','Use “I would like…” to express one specific need. You can also write this to yourself.'], question:['你想在亲密关系里保留什么，又愿意分享什么？','What do you want to keep for yourself, and what are you ready to share?'] },
];

function validDay(day) { return /^\d{4}-\d{2}-\d{2}$/.test(day || '') && shiftDay(day, 0) === day; }
function cleanRecord(record) {
  if (!record || typeof record !== 'object') return {};
  const clean = { note: typeof record.note === 'string' ? record.note.slice(0, 2000) : '' };
  if (Number.isInteger(record.draw) && record.draw >= 0 && record.draw < DAILY_PROMPTS.length) {
    clean.draw = record.draw;
    clean.drawVersion = DRAW_VERSION;
  }
  clean.timezone = typeof record.timezone === 'string' ? record.timezone.slice(0, 80) : '';
  return clean;
}

export function createDailyJournal(storage) {
  let records = {};
  try {
    const parsed = JSON.parse(storage.getItem(JOURNAL_KEY) || '{}');
    if (parsed.version === 1 && parsed.records && typeof parsed.records === 'object') {
      records = Object.fromEntries(Object.entries(parsed.records).filter(([day]) => validDay(day)).map(([day, record]) => [day, cleanRecord(record)]));
    }
  } catch { /* A blocked or corrupt store still allows this visit's journal. */ }
  function persist() {
    try { const value = JSON.stringify({version:1, records}); storage.setItem(JOURNAL_KEY, value); return storage.getItem(JOURNAL_KEY) === value; }
    catch { return false; }
  }
  return {
    get(day) { return { ...(records[day] || {}) }; },
    entries() { return Object.entries(records).sort(([a], [b]) => b.localeCompare(a)).map(([day, record]) => ({day, ...record})); },
    saveNote(day, note, timezone = '') {
      if (!validDay(day)) return false;
      records[day] = cleanRecord({...records[day], note, timezone});
      return persist();
    },
    draw(day, randomValue, timezone = '') {
      if (!validDay(day)) throw new Error('Invalid journal date');
      if (records[day]?.draw != null) return {index: records[day].draw, persisted: persist()};
      const index = Math.min(DAILY_PROMPTS.length - 1, Math.floor(Math.max(0, Math.min(1, randomValue)) * DAILY_PROMPTS.length));
      records[day] = cleanRecord({...records[day], draw:index, timezone});
      return {index, persisted:persist()};
    },
    export() { return JSON.stringify({version:1, records}, null, 2); },
  };
}
