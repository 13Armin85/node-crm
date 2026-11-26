import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Card from 'components/card/Card';
import { getApi } from 'services/api';
import { useLanguage } from 'i18n';
import { filterAgendaTasks, groupAgendaTasks, initialsOf, taskWhen } from 'utils/taskAgenda';
import 'assets/css/TaskAgenda.css';

const LOCALES = { fa: 'fa-IR', tr: 'tr-TR', en: 'en-GB' };
const LIMIT = 6;
const idOf = value => String(value?._id || value || '');

// Dashboard summary of today's tasks: ordinary users see their own, administrators see everyone's.
export default function TodayTasks({ user, isAdmin = false }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const locale = LOCALES[language] || 'en-GB';
  const [tasks, setTasks] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getApi('api/task').then(result => {
      if (!active) return;
      if (result?.status === 200) setTasks((result.data || []).map(task => ({ ...task, assignedToUser: idOf(task.assignedToUser), createBy: idOf(task.createBy) })));
      else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const visible = filterAgendaTasks(tasks || [], { scope: isAdmin ? 'all' : 'mine', userId: user?._id });
    return groupAgendaTasks(visible, new Date());
  }, [tasks, isAdmin, user?._id]);
  const count = new Intl.NumberFormat(locale);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = groups.today;
  const overdue = groups.overdue.length;

  return (
    <Card className="crm-dashboard-panel crm-today-tasks" mb="12px" dir={language === 'fa' ? 'rtl' : 'ltr'}>
      <div className="crm-today-tasks__header">
        <div>
          <h2 className="crm-today-tasks__title">{t(isAdmin ? 'taskAgenda.todayTeam' : 'taskAgenda.todayMine')}</h2>
          {tasks && (
            <p className="crm-today-tasks__summary">
              <span>{count.format(today.length)} {t('taskAgenda.todayCount')}</span>
              {overdue > 0 && <span className="crm-today-tasks__overdue">{count.format(overdue)} {t('taskAgenda.overdueCount')}</span>}
            </p>
          )}
        </div>
        <RouterLink className="crm-today-tasks__all" to="/task">{t('taskAgenda.viewAll')}</RouterLink>
      </div>
      {failed ? (
        <p className="crm-today-tasks__empty" role="alert">{t('Failed to fetch data')}</p>
      ) : !tasks ? (
        <p className="crm-today-tasks__empty">…</p>
      ) : !today.length ? (
        <p className="crm-today-tasks__empty">{t('taskAgenda.noToday')}</p>
      ) : (
        <ul className="crm-today-tasks__list">
          {today.slice(0, LIMIT).map(task => {
            const when = taskWhen(task);
            const assignee = task.assignedToUserName || '';
            return (
              <li key={task._id}>
                <button type="button" className="crm-today-tasks__row" onClick={() => navigate(`/view/${task._id}`)}>
                  <span className="crm-today-tasks__time">{when?.hasTime ? time.format(when.date) : t('taskAgenda.allDay')}</span>
                  <span className="crm-today-tasks__task">{task.title || '—'}</span>
                  {task.assignToName && <span className="crm-today-tasks__related">{task.assignToName}</span>}
                  {isAdmin && <span className="crm-agenda-row__avatar crm-today-tasks__avatar" title={assignee} aria-label={assignee ? `${t('taskAgenda.assignee')}: ${assignee}` : undefined}>{initialsOf(assignee)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {today.length > LIMIT && (
        <RouterLink className="crm-today-tasks__more" to="/task">+{count.format(today.length - LIMIT)} {t('taskAgenda.more')}</RouterLink>
      )}
    </Card>
  );
}
