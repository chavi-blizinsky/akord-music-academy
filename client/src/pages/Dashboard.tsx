import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Clock, CreditCard, GraduationCap, LayoutDashboard, Music, Sparkles, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Badge, Card, LineChart, PageHeader, Stat } from '../components/ui';
import { fullName, ils, teacherName, useStore } from '../data/store';
import { predictChurn } from '../engine/churn';
import { forecastRevenue } from '../engine/forecast';
import { DAYS_HE } from '../lib/types';
import { monthKey } from '../data/seed';

export default function Dashboard() {
  const { data, today } = useStore();
  const month = monthKey(today);

  const active = data.students.filter(s => s.status === 'active').length;
  const monthPays = data.payments.filter(p => p.month === month);
  const collected = monthPays.filter(p => p.paidAt).reduce((a, p) => a + p.amount, 0);
  const expected = monthPays.reduce((a, p) => a + p.amount, 0);
  const risk = useMemo(() => predictChurn(data, today).filter(p => p.level === 'high'), [data, today]);
  const forecast = useMemo(() => forecastRevenue(data.payments, 6), [data.payments]);
  // Show today's lessons, or the next school day that has lessons.
  const todayDay = Math.min(5, today.getDay());
  const shownDay = [0, 1, 2, 3, 4, 5].map(i => (todayDay + i) % 6).find(d => data.lessons.some(l => l.day === d)) ?? todayDay;
  const todays = data.lessons.filter(l => l.day === shownDay).sort((a, b) => a.hour - b.hour);

  return (
    <>
      <PageHeader title="לוח בקרה" subtitle={`שלום! היום יום ${DAYS_HE[todayDay]}, ${today.toLocaleDateString('he-IL')}`} icon={<LayoutDashboard />}
        actions={<Link to="/studio" className="btn-primary"><Music size={16} /> לסטודיו</Link>} />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat label="תלמידים פעילים" value={active} hint={`${data.waitlist.length} ברשימת המתנה`} icon={<GraduationCap />} />
        <Stat label="שיעורים בשבוע" value={data.lessons.length} hint={`${data.teachers.length} מורים · ${data.rooms.length} חדרים`} icon={<CalendarDays />} tone="gold" />
        <Stat label="נגבה החודש" value={ils(collected)} hint={`מתוך ${ils(expected)} (${Math.round((collected / Math.max(1, expected)) * 100)}%)`} icon={<CreditCard />} tone="green" />
        <Stat label="בסיכון עזיבה" value={risk.length} hint="לפי מודל החיזוי" icon={<AlertTriangle />} tone="red" />
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Card title="הכנסות ותחזית ל-6 חודשים" className="xl:col-span-2" actions={<Badge tone="amber"><TrendingUp size={12} className="ms-1" /> תחזית עונתית</Badge>}>
          <LineChart points={forecast.map(p => ({ ...p, label: p.month.slice(2).replace('-', '/') }))} />
          <div className="flex gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-brand-500 rounded" /> בפועל</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-amber-500 rounded" /> תחזית + טווח ביטחון 95%</span>
          </div>
        </Card>

        <Card title={`${shownDay === todayDay ? 'השיעורים של היום' : 'השיעורים הבאים'} – יום ${DAYS_HE[shownDay]}`} actions={<Link to="/schedule" className="text-sm text-brand-600">למערכת המלאה</Link>}>
          <ul className="space-y-2 max-h-72 overflow-auto">
            {todays.length === 0 && <li className="text-sm text-slate-400">אין שיעורים היום</li>}
            {todays.map(l => {
              const t = data.teachers.find(x => x.id === l.teacherId);
              return (
                <li key={l.id} className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 w-14 text-slate-500"><Clock size={12} />{l.hour}:00</span>
                  <span className="w-1.5 h-8 rounded-full" style={{ background: t?.color }} />
                  <div>
                    <div className="font-medium">{fullName(data, l.studentId)}</div>
                    <div className="text-xs text-slate-500">{teacherName(data, l.teacherId)} · {data.rooms.find(r => r.id === l.roomId)?.name}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="דורשים תשומת לב" className="xl:col-span-3" actions={<Link to="/insights" className="text-sm text-brand-600 flex items-center gap-1"><Sparkles size={14} /> לכל התובנות</Link>}>
          <div className="grid md:grid-cols-3 gap-3">
            {risk.slice(0, 3).map(p => (
              <div key={p.student.id} className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 p-4">
                <div className="flex justify-between"><b>{fullName(data, p.student.id)}</b><Badge tone="red">{Math.round(p.probability * 100)}%</Badge></div>
                <p className="text-xs text-slate-500 mt-1">{p.factors[0].label}: {p.factors[0].value}</p>
                <p className="text-sm mt-2">💡 {p.action}</p>
              </div>
            ))}
            {risk.length === 0 && <p className="text-sm text-slate-400">אין התראות – הכול נראה מצוין 🎵</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
