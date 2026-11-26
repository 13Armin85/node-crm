import { memo, useCallback, useMemo, useState } from 'react';
import { Box, Menu, MenuButton, MenuItemOption, MenuList, MenuOptionGroup, Portal, Select } from '@chakra-ui/react';
import {
  FiAlertCircle, FiBell, FiCalendar, FiCheck, FiCheckSquare, FiChevronDown, FiClock, FiCreditCard, FiFileText, FiFlag, FiHome, FiInbox, FiMail, FiPhone, FiRefreshCw, FiSearch, FiSun, FiUser, FiUsers, FiX,
} from 'react-icons/fi';
import { useLanguage } from 'i18n';
import { canManageTask } from 'services/taskAccess';
import { AGENDA_GROUPS, filterAgendaTasks, groupAgendaTasks, initialsOf, taskKind, taskWhen } from 'utils/taskAgenda';
import { matchesTaskSearch } from 'services/taskSearch';
import 'assets/css/TaskAgenda.css';

const KIND_ICONS = { call: FiPhone, visit: FiHome, mail: FiMail, meeting: FiUsers, document: FiFileText, payment: FiCreditCard, followup: FiRefreshCw, reminder: FiBell, task: FiCheckSquare };
const STATUSES = ['todo', 'inProgress', 'pending', 'onHold', 'completed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const OPEN_BY_DEFAULT = new Set(['overdue', 'today', 'tomorrow']);
// Every group has an icon so titles line up across the page.
const GROUP_ICONS = { overdue: FiAlertCircle, today: FiSun, tomorrow: FiCalendar, week: FiCalendar, later: FiClock, undated: FiInbox, done: FiCheck };
const LOCALES = { fa: 'fa-IR', tr: 'tr-TR', en: 'en-GB' };
const DATE_FORMATTERS = Object.fromEntries(Object.values(LOCALES).map(locale => [locale, {
  time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }),
  date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
  weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
}]));
const DAY = 24 * 60 * 60 * 1000;
export const COMPLETE_DELAY_MS = 700;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function whenLabel(task, group, locale, t, now) {
  const when = taskWhen(task);
  if (!when) return '';
  const time = DATE_FORMATTERS[locale].time.format(when.date);
  const date = DATE_FORMATTERS[locale].date.format(when.date);
  if (group === 'today' || group === 'tomorrow') return when.hasTime ? time : t('taskAgenda.allDay');
  if (group === 'overdue' && sameDay(when.date, new Date(now.getTime() - DAY))) return t('taskAgenda.yesterday');
  if (group === 'week') {
    const weekday = DATE_FORMATTERS[locale].weekday.format(when.date);
    return when.hasTime ? `${weekday} ${time}` : weekday;
  }
  return date;
}

const TaskRow = memo(function TaskRow({ task, user, group, locale, t, now, onOpen, onToggle, busy, completing }) {
  const kind = taskKind(task);
  const Icon = KIND_ICONS[kind];
  const manageable = canManageTask(task, user);
  const done = task.status === 'completed' || completing;
  const related = task.assignToName || '';
  const assignee = task.assignedToUserName || '';
  const priority = PRIORITIES.includes(task.priority) ? task.priority : 'normal';
  const status = STATUSES.includes(task.status) ? task.status : 'todo';
  const description = task.description || task.notes || '';
  return (
    <li className={`crm-agenda-row${done ? ' is-done' : ''}${completing ? ' is-completing' : ''}`} data-kind={kind} data-priority={priority}>
      <input
        type="checkbox"
        className="crm-agenda-row__check"
        checked={done}
        disabled={!manageable || busy || completing}
        aria-label={`${t(done ? 'taskAgenda.markOpen' : 'taskAgenda.markDone')}: ${task.title || ''}`}
        onChange={() => onToggle(task)}
      />
      <button type="button" className="crm-agenda-row__main" onClick={() => onOpen(task._id)}>
        <span className="crm-agenda-row__when" data-group={group}>
          <FiClock aria-hidden="true" />
          {whenLabel(task, group, locale, t, now) || t('taskAgenda.group.undated')}
        </span>
        <span className="crm-agenda-row__icon" title={t('taskAgenda.kind.' + kind)}><Icon aria-hidden="true" /></span>
        <span className="crm-agenda-row__content">
          <span className="crm-agenda-row__headline">
            <span className="crm-agenda-row__title" data-no-translate>{task.title || '—'}</span>
            <span className="crm-agenda-row__priority" data-priority={priority}><FiFlag aria-hidden="true" />{t('taskAgenda.priority.' + priority)}</span>
          </span>
          {description && <span className="crm-agenda-row__description" title={description} data-no-translate>{description}</span>}
          <span className="crm-agenda-row__details">
            <span className="crm-agenda-row__kind">{t('taskAgenda.kind.' + kind)}</span>
            <span className="crm-agenda-row__status" data-status={done ? 'completed' : status}>{t('taskAgenda.status.' + (done ? 'completed' : status))}</span>
            {related && <span className="crm-agenda-row__related" title={related}>
              <FiUser aria-hidden="true" /><span>{t(task.category === 'Lead' ? 'Lead' : 'Contact')}: <bdi data-no-translate>{related}</bdi></span>
            </span>}
          </span>
        </span>
        <span className="crm-agenda-row__person">
          <span className="crm-agenda-row__avatar" aria-hidden="true">{assignee ? initialsOf(assignee) : <FiUser />}</span>
          <span className="crm-agenda-row__assignee"><span>{t('taskAgenda.assignee')}</span><bdi data-no-translate>{assignee || t('taskAgenda.unassigned')}</bdi></span>
        </span>
      </button>
    </li>
  );
});

export default function TaskAgenda({ tasks = [], user, isAdmin = false, assignees = [], onOpen, onStatusChange, title, subtitle, actions }) {
  const { t, language } = useLanguage();
  const locale = LOCALES[language] || 'en-GB';
  const [scope, setScope] = useState('mine');
  const [advisorId, setAdvisorId] = useState('');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(() => new Set(OPEN_BY_DEFAULT));
  const [busyId, setBusyId] = useState('');
  const [completing, setCompleting] = useState(() => new Set());
  const now = useMemo(() => new Date(), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = filterAgendaTasks(tasks, { scope, userId: user?._id, advisorId });
  const visible = scoped.filter(task => matchesTaskSearch(task, query) && (!priority || (task.priority || 'normal') === priority) && (!status || task.status === status));
  const filtering = Boolean(query.trim() || priority || status);
  const groups = groupAgendaTasks(visible, now);
  const count = new Intl.NumberFormat(locale);
  const scopeCount = key => filterAgendaTasks(tasks, { scope: key, userId: user?._id }).filter(task => task.status !== 'completed').length;
  const advisor = assignees.find(item => String(item._id) === String(advisorId));
  const advisorName = advisor ? [advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.username : t('taskAgenda.advisor');
  const toggleGroup = key => setOpen(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const updateFilter = (setter, value) => {
    setter(value);
    if (value) setOpen(new Set(AGENDA_GROUPS));
  };
  // Ticking shows the check mark first, then the task moves into "Done" after a short pause.
  const toggleTask = useCallback(async task => {
    if (task.status === 'completed') {
      setBusyId(task._id);
      try { await onStatusChange(task._id, 'todo'); } finally { setBusyId(''); }
      return;
    }
    setCompleting(current => new Set(current).add(task._id));
    await new Promise(resolve => setTimeout(resolve, COMPLETE_DELAY_MS));
    try { await onStatusChange(task._id, 'completed'); } finally {
      setCompleting(current => { const next = new Set(current); next.delete(task._id); return next; });
    }
  }, [onStatusChange]);

  return (
    <Box className="crm-agenda" dir={language === 'fa' ? 'rtl' : 'ltr'}>
      {(title || actions) && (
        <header className="crm-agenda__header">
          <div className="crm-agenda__heading">
            {title && <h1 className="crm-agenda__title">{title}</h1>}
            {subtitle && <p className="crm-agenda__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="crm-agenda__actions">{actions}</div>}
        </header>
      )}
      <div className="crm-agenda__toolbar">
        <div className="crm-agenda__scopes" role="group" aria-label={t('Tasks')}>
          {['mine', 'all'].map(key => (
            <button key={key} type="button" className={`crm-agenda-segment${!advisorId && scope === key ? ' is-active' : ''}`}
              aria-pressed={!advisorId && scope === key} onClick={() => { setScope(key); setAdvisorId(''); }}>
              <span>{t('taskAgenda.' + key)}</span>
              <span className="crm-agenda-segment__count">{count.format(scopeCount(key))}</span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="crm-agenda__advisor">
          <Menu placement="bottom-end" isLazy>
            <MenuButton as="button" type="button" className={`crm-agenda-chip crm-agenda-chip--advisor${advisorId ? ' is-active' : ''}`}>
              <span>{advisorName}</span>
              <FiChevronDown aria-hidden="true" />
            </MenuButton>
            <Portal>
              <MenuList zIndex="popover" maxH="320px" overflowY="auto">
                <MenuOptionGroup type="radio" value={advisorId || 'none'} onChange={value => setAdvisorId(value === 'none' ? '' : value)}>
                  <MenuItemOption value="none">{t('taskAgenda.allAdvisors')}</MenuItemOption>
                  {assignees.map(item => (
                    <MenuItemOption key={item._id} value={String(item._id)}>
                      {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.username}
                    </MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Portal>
          </Menu>
          </div>
        )}
      </div>

      <div className="crm-agenda__filters" role="search" aria-label={t('taskAgenda.search')}>
        <label className="crm-agenda__search">
          <FiSearch aria-hidden="true" />
          <input type="search" value={query} onChange={event => updateFilter(setQuery, event.target.value)} placeholder={t('taskAgenda.search')} aria-label={t('taskAgenda.search')} />
        </label>
        <Select value={priority} onChange={event => updateFilter(setPriority, event.target.value)} aria-label={t('Priority')}>
          <option value="">{t('taskAgenda.allPriorities')}</option>
          {PRIORITIES.map(value => <option key={value} value={value}>{t('taskAgenda.priority.' + value)}</option>)}
        </Select>
        <Select value={status} onChange={event => updateFilter(setStatus, event.target.value)} aria-label={t('Status')}>
          <option value="">{t('taskAgenda.allStatuses')}</option>
          {STATUSES.map(value => <option key={value} value={value}>{t('taskAgenda.status.' + value)}</option>)}
        </Select>
        {filtering && <button type="button" className="crm-agenda__clear" onClick={() => { setQuery(''); setPriority(''); setStatus(''); }}><FiX aria-hidden="true" />{t('Clear')}</button>}
      </div>

      {!tasks.length ? (
        <div className="crm-agenda__empty"><strong>{t('taskAgenda.empty')}</strong><span>{t('taskAgenda.emptyHint')}</span></div>
      ) : !visible.length ? (
        <div className="crm-agenda__empty"><strong>{t('taskAgenda.noMatches')}</strong></div>
      ) : AGENDA_GROUPS.filter(key => groups[key].length).map(key => {
        const expanded = open.has(key);
        const GroupIcon = GROUP_ICONS[key];
        const panelId = `crm-agenda-group-${key}`;
        return (
          <section key={key} className="crm-agenda-group" data-group={key}>
            <button type="button" className="crm-agenda-group__header" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggleGroup(key)}>
              <GroupIcon className="crm-agenda-group__icon" aria-hidden="true" />
              <span className="crm-agenda-group__title">{t('taskAgenda.group.' + key)}</span>
              <span className="crm-agenda-group__count">{count.format(groups[key].length)}</span>
              <FiChevronDown className={`crm-agenda-group__chevron${expanded ? ' is-open' : ''}`} aria-hidden="true" />
            </button>
            {expanded && (
              <ul id={panelId} className="crm-agenda-group__list">
                {groups[key].map(task => (
                  <TaskRow key={task._id} task={task} user={user} group={key} locale={locale} t={t} now={now}
                    onOpen={onOpen} onToggle={toggleTask} busy={busyId === task._id} completing={completing.has(task._id)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </Box>
  );
}
