import { useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, CalendarPlus, Cpu, Sparkles } from 'lucide-react';
import { Badge, Card, PageHeader } from '../components/ui';
import { fullName, teacherName, useStore } from '../data/store';
import { findConflicts, siblingPairs, solveSchedule, teacherGaps, type ScheduleResult } from '../engine/scheduler';
import { DAYS_HE, HOURS, type Day } from '../lib/types';
import { downloadIcs } from '../lib/integrations';

export default function Schedule() {
  const { data, today, setLessons } = useStore();
  const [filter, setFilter] = useState<string>('all');
  const [last, setLast] = useState<ScheduleResult | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const run = () => {
    const res = solveSchedule(data, { today });
    setLessons(res.lessons);
    setLast(res);
  };

  const lessons = data.lessons.filter(l => filter === 'all' || l.teacherId === filter);
  const conflicts = findConflicts(data.lessons);

  const moveTo = (day: Day, hour: number) => {
    if (!drag) return;
    setLessons(data.lessons.map(l => (l.id === drag ? { ...l, day, hour } : l)));
    setDrag(null);
  };

  return (
    <>
      <PageHeader title="שיבוץ חכם" subtitle="מנוע שמשבץ את כל המערכת לבד: בלי התנגשויות, אחים ברצף, ימים קומפקטיים למורים" icon={<CalendarDays />}
        actions={<>
          <button className="btn-primary" onClick={run}><Cpu size={16} /> שיבוץ אוטומטי</button>
          <button className="btn-ghost" onClick={() => downloadIcs(data, filter === 'all' ? undefined : filter)}><CalendarPlus size={16} /> ייצוא ליומן (Google / Outlook)</button>
        </>} />

      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <Card><div className="text-2xl font-bold">{data.lessons.length}</div><div className="text-sm text-slate-500">שיעורים שובצו</div></Card>
        <Card><div className="text-2xl font-bold">{siblingPairs(data.lessons, data)}</div><div className="text-sm text-slate-500">זוגות אחים ברצף (נסיעה אחת להורים)</div></Card>
        <Card><div className="text-2xl font-bold">{teacherGaps(data.lessons)}</div><div className="text-sm text-slate-500">שעות "חלון" אצל מורים</div></Card>
        <Card><div className={clsx('text-2xl font-bold', conflicts.length ? 'text-red-600' : 'text-emerald-600')}>{conflicts.length}</div><div className="text-sm text-slate-500">התנגשויות</div></Card>
      </div>

      {last && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Sparkles className="text-brand-500" size={18} />
            המנוע בדק {last.stats.explored.toLocaleString()} אפשרויות ב-{last.stats.ms}ms.
            {last.unscheduled.length > 0
              ? <Badge tone="amber">{last.unscheduled.length} לא שובצו – {last.unscheduled[0].reason}</Badge>
              : <Badge tone="green">כל התלמידים שובצו</Badge>}
          </div>
        </Card>
      )}

      <Card title="מערכת שבועית" actions={
        <select className="input w-56" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">כל המורים</option>
          {data.teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
        </select>}>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 min-w-[900px]">
            <thead><tr><th className="th w-16">שעה</th>{DAYS_HE.slice(0, 5).map(d => <th key={d} className="th text-center">{d}</th>)}</tr></thead>
            <tbody>
              {HOURS.map(h => (
                <tr key={h}>
                  <td className="text-xs text-slate-500 align-top pt-2">{h}:00</td>
                  {[0, 1, 2, 3, 4].map(d => {
                    const cell = lessons.filter(l => l.day === d && l.hour === h);
                    return (
                      <td key={d} onDragOver={e => e.preventDefault()} onDrop={() => moveTo(d as Day, h)}
                        className={clsx('align-top rounded-xl min-h-14 p-1 bg-slate-50 dark:bg-slate-900/60', drag && 'outline-dashed outline-1 outline-brand-300')}>
                        <div className="space-y-1">
                          {cell.map(l => {
                            const t = data.teachers.find(x => x.id === l.teacherId);
                            return (
                              <div key={l.id} draggable onDragStart={() => setDrag(l.id)}
                                className="cursor-grab rounded-lg px-2 py-1 text-xs text-white shadow-sm" style={{ background: t?.color }}
                                title={`${teacherName(data, l.teacherId)} · ${data.rooms.find(r => r.id === l.roomId)?.name}`}>
                                <div className="font-medium truncate">{fullName(data, l.studentId)}</div>
                                <div className="opacity-80 truncate">{t?.firstName} · {data.rooms.find(r => r.id === l.roomId)?.name}</div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2">אפשר לגרור שיעור למשבצת אחרת – בדיקת ההתנגשויות מתעדכנת מיד.</p>
      </Card>
    </>
  );
}
