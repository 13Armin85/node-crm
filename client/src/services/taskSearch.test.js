import { matchesSearch, normalizeSearchText } from 'utils/searchText';
import { filterTasks, matchesAssignee } from './taskSearch';
import reducer, { getSearchData } from '../redux/slices/advanceSearchSlice';
test.each([
  ['علي كريمي', 'علی کریمی'],
  ['عَلِی کـریمی', 'علي كريمي'],
  ['محمد\u200cرضا', 'محمد رضا'],
  ['محمد رضا', 'محمد\u200cرضا'],
  ['John Smith', 'JOHN smith'],
  ['İPEK YILMAZ', 'ipek yılmaz'],
  ['IŞIK ÖZTÜRK', 'ışık öztürk'],
  ['IŞIK ÖZTÜRK', 'ISIK OZTURK'],
  ['Çağrı Şahin', 'CAGRI SAHIN'],
  ['I\u0307pek', 'İPEK'],
])('matches multilingual name %s with %s', (name, query) => {
  expect(matchesSearch([name], query)).toBe(true);
});
test('ignores extra spaces and accepts missing fields without matching unrelated names', () => {
  expect(normalizeSearchText('  İPEK  ')).toBe('ipek');
  expect(matchesSearch([null, undefined, 'John Smith'], '  john   smith ')).toBe(true);
  expect(matchesSearch(['John Smith'], 'John Brown')).toBe(false);
  expect(matchesSearch([undefined], '')).toBe(true);
});
const tasks = [
  { _id: 'fa', title: 'پیگیری', assignedToUserName: 'علي كريمي', status: 'todo' },
  { _id: 'en', title: 'Call buyer', assignedToUserName: 'John Smith', assignToName: 'Jane Doe', status: 'completed' },
  { _id: 'tr', title: 'Arama', assignedToUserName: 'İpek Yılmaz', createByName: 'Çağrı Şahin', status: 'todo' },
];
test('searches all name fields and recovers when the query is cleared', () => {
  expect(filterTasks(tasks, 'علی کریمی').map(task => task._id)).toEqual(['fa']);
  expect(filterTasks(tasks, 'jane').map(task => task._id)).toEqual(['en']);
  expect(filterTasks(tasks, 'cagri').map(task => task._id)).toEqual(['tr']);
  expect(filterTasks(tasks, 'ipek yilmaz').map(task => task._id)).toEqual(['tr']);
  expect(filterTasks(tasks, 'no such name')).toEqual([]);
  expect(filterTasks(tasks, '')).toHaveLength(3);
});
test('advanced names intersect with status using the same multilingual rules', () => {
  expect(filterTasks(tasks, '', { assignToName: 'İPEK YILMAZ', status: 'todo' }).map(task => task._id)).toEqual(['tr']);
  expect(filterTasks(tasks, '', { assignToName: 'Jane Doe', status: 'todo' })).toEqual([]);
  expect(reducer(undefined, getSearchData({ type: 'Tasks', allData: tasks, values: { assignToName: 'علی کریمی' } })).searchResult.map(task => task._id)).toEqual(['fa']);
});
test('assignee filtering searches names and account names', () => {
  expect(matchesAssignee({ firstName: 'İpek', lastName: 'Yılmaz', username: 'ipek@example.test' }, 'IPEK YILMAZ')).toBe(true);
  expect(matchesAssignee({ firstName: 'John', username: 'jsmith@example.test' }, 'jsmith')).toBe(true);
});
