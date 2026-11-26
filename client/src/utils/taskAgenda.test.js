import { agendaGroupOf, filterAgendaTasks, groupAgendaTasks, initialsOf, parseTaskDate, taskKind } from './taskAgenda';

const now = new Date(2026, 10, 13, 10, 0); // 13 Nov 2026, 10:00 local
const task = (start, extra = {}) => ({ _id: start + (extra.title || ''), title: 'Task', status: 'todo', start, ...extra });

test('form dates are read as local time, with and without a time', () => {
  expect(parseTaskDate('2026-11-13 14:30')).toEqual({ date: new Date(2026, 10, 13, 14, 30), hasTime: true });
  expect(parseTaskDate('2026-11-13')).toEqual({ date: new Date(2026, 10, 13), hasTime: false });
  expect(parseTaskDate('not a date')).toBeNull();
  expect(parseTaskDate('')).toBeNull();
});

test('tasks fall into overdue, today, tomorrow, this week, later, undated and done', () => {
  expect(agendaGroupOf(task('2026-11-12 09:00'), now)).toBe('overdue');
  expect(agendaGroupOf(task('2026-11-13 08:00'), now)).toBe('today');
  expect(agendaGroupOf(task('2026-11-14'), now)).toBe('tomorrow');
  expect(agendaGroupOf(task('2026-11-19'), now)).toBe('week');
  expect(agendaGroupOf(task('2026-11-20'), now)).toBe('later');
  expect(agendaGroupOf(task(''), now)).toBe('undated');
  expect(agendaGroupOf(task('2026-11-01', { status: 'completed' }), now)).toBe('done');
});

test('groups are ordered: overdue newest first, upcoming soonest first', () => {
  const groups = groupAgendaTasks([
    task('2026-11-01', { title: 'old' }), task('2026-11-12', { title: 'yesterday' }),
    task('2026-11-13 17:00', { title: 'late' }), task('2026-11-13 10:30', { title: 'early' }),
  ], now);
  expect(groups.overdue.map(item => item.title)).toEqual(['yesterday', 'old']);
  expect(groups.today.map(item => item.title)).toEqual(['early', 'late']);
});

test('my tasks shows only tasks assigned to me; an advisor filter shows that user', () => {
  const tasks = [
    { _id: 1, assignedToUser: 'me' }, { _id: 2, assignedToUser: 'other' },
    { _id: 3, assignedToUser: '', createBy: 'me' },
  ];
  expect(filterAgendaTasks(tasks, { scope: 'mine', userId: 'me' }).map(item => item._id)).toEqual([1, 3]);
  expect(filterAgendaTasks(tasks, { scope: 'all', userId: 'me' })).toHaveLength(3);
  expect(filterAgendaTasks(tasks, { scope: 'mine', userId: 'me', advisorId: 'other' }).map(item => item._id)).toEqual([2]);
});

test('icons follow the task wording and initials come from the assignee name', () => {
  expect(taskKind({ title: 'تماس درباره اقامت' })).toBe('call');
  expect(taskKind({ title: 'بازدید واحد' })).toBe('visit');
  expect(taskKind({ title: 'Send email' })).toBe('mail');
  expect(taskKind({ title: 'ارسال مدارک تاپو' })).toBe('document');
  expect(taskKind({ title: 'پیگیری پیشنهاد قیمت' })).toBe('followup');
  expect(taskKind({ title: 'Something' })).toBe('task');
  expect(initialsOf('saman behjat')).toBe('SB');
  expect(initialsOf('')).toBe('?');
});

test('action icons prioritize the title and support normalized Persian and Turkish text', () => {
  expect(taskKind({ title: 'بازدید ملک', description: 'تماس با مخاطب قبل از بازدید', leadCallFor: 'lead' })).toBe('visit');
  expect(taskKind({ title: 'پرداخت قسط قرارداد' })).toBe('payment');
  expect(taskKind({ title: 'یادآوری تمدید' })).toBe('reminder');
  expect(taskKind({ title: 'پيگيري مشتري' })).toBe('followup');
  expect(taskKind({ title: 'Ödeme planı' })).toBe('payment');
  expect(taskKind({ title: 'Toplantı' })).toBe('meeting');
  expect(taskKind({ title: 'Prepare', description: 'Review contract' })).toBe('document');
  expect(taskKind({ title: 'New lead', leadCallFor: 'lead' })).toBe('call');
});
