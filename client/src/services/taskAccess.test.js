import { canManageTask } from './taskAccess';
const user = { _id: 'first', role: 'user' };
test('ordinary users cannot manage assigned, own, legacy, or generally visible tasks', () => {
  for (const moduleVisibility of [{}, { Tasks: true }, { Tasks: false }]) {
    for (const task of [{ createBy: 'first' }, { assignedToUser: 'first' }, { createBy: 'second', assignedToUser: { _id: 'first' } }]) {
      expect(canManageTask(task, { ...user, moduleVisibility })).toBe(false);
    }
  }
});
test('administrative roles retain task management', () => {
  for (const role of ['admin', 'developer']) {
    expect(canManageTask({ assignedToUser: 'second' }, { ...user, role })).toBe(true);
    expect(canManageTask(null, { ...user, role })).toBe(false);
  }
});
