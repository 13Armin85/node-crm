import { normalizeSearchText } from './searchText';

// Groups tasks into the agenda buckets shown on the task page:
// overdue, today, tomorrow, this week (next 7 days), later, no date and done.
export const AGENDA_GROUPS = ['overdue', 'today', 'tomorrow', 'week', 'later', 'undated', 'done'];

const idOf = value => String(value?._id || value || '');
const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const DAY = 24 * 60 * 60 * 1000;

// Accepts "YYYY-MM-DD", "YYYY-MM-DD HH:mm" (local time, as the task form saves) or ISO strings.
export const parseTaskDate = value => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : { date: value, hasTime: true };
  const text = String(value).trim();
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (local) {
    const [, y, m, d, hh, mm] = local;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh || 0), Number(mm || 0));
    return Number.isNaN(date.getTime()) ? null : { date, hasTime: hh !== undefined };
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : { date, hasTime: true };
};

export const taskWhen = task => {
  const parsed = parseTaskDate(task?.start) || parseTaskDate(task?.end);
  if (!parsed) return null;
  return { ...parsed, hasTime: parsed.hasTime && !(task?.allDay === true || task?.allDay === 'Yes') };
};

export const agendaGroupOf = (task, now = new Date()) => {
  if (task?.status === 'completed') return 'done';
  const when = taskWhen(task);
  if (!when) return 'undated';
  const days = Math.round((startOfDay(when.date) - startOfDay(now)) / DAY);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return 'week';
  return 'later';
};

export const filterAgendaTasks = (tasks, { scope = 'mine', userId, advisorId } = {}) => tasks.filter(task => {
  if (advisorId) return idOf(task.assignedToUser) === String(advisorId);
  if (scope === 'mine') return idOf(task.assignedToUser) === String(userId) || (!task.assignedToUser && idOf(task.createBy) === String(userId));
  return true;
});

export const groupAgendaTasks = (tasks, now = new Date()) => {
  const groups = Object.fromEntries(AGENDA_GROUPS.map(key => [key, []]));
  tasks.forEach(task => groups[agendaGroupOf(task, now)].push(task));
  const time = task => taskWhen(task)?.date.getTime() ?? 0;
  const done = task => new Date(task.updatedDate || task.createdDate || 0).getTime();
  groups.overdue.sort((a, b) => time(b) - time(a));
  ['today', 'tomorrow', 'week', 'later'].forEach(key => groups[key].sort((a, b) => time(a) - time(b)));
  groups.undated.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  groups.done.sort((a, b) => done(b) - done(a));
  return groups;
};

// The title describes the action; incidental wording in notes must not replace it.
export const taskKind = task => {
  const patterns = [
    ['visit', /بازدید|visit|ziyaret|viewing/i],
    ['meeting', /جلسه|meeting|toplanti|ملاقات/i],
    ['mail', /ایمیل|email|e-posta|mail|پیام|message|واتساپ|whatsapp|sms/i],
    ['payment', /پرداخت|واریز|تسویه|قسط|payment|invoice|odeme|taksit/i],
    ['document', /مدارک|سند|قرارداد|document|contract|tapu|sozlesme|belge/i],
    ['call', /تماس|زنگ|\bcall\b|phone|ara(ma|y)/i],
    ['followup', /پیگیری|follow[- ]?up|takip/i],
    ['reminder', /یاداور|remind|hatirlat/i],
  ];
  for (const value of [task?.title, task?.description]) {
    const text = normalizeSearchText(value);
    const match = patterns.find(([, pattern]) => pattern.test(text));
    if (match) return match[0];
  }
  return task?.leadCallFor ? 'call' : 'task';
};

export const initialsOf = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
  .map(part => part[0]).join('').toUpperCase() || '?';
