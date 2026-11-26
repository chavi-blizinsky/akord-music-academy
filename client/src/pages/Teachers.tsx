import { Mail, Phone, Users } from 'lucide-react';
import { Badge, Card, PageHeader } from '../components/ui';
import { ils, useStore } from '../data/store';
import { DAYS_HE } from '../lib/types';

export default function Teachers() {
  const { data } = useStore();
  return (
    <>
      <PageHeader title="מורים וקורסים" subtitle="עומס, זמינות ושכר לכל מורה · מחירון הקורסים" icon={<Users />} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {data.teachers.map(t => {
          const lessons = data.lessons.filter(l => l.teacherId === t.id);
          const capacity = t.availability.reduce((a, w) => a + (w.to - w.from), 0);
          const load = lessons.length / Math.max(1, capacity);
          return (
            <Card key={t.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className="grid place-items-center w-12 h-12 rounded-full text-white font-bold" style={{ background: t.color }}>{t.firstName[0]}{t.lastName[0]}</div>
                <div>
                  <div className="font-semibold">{t.firstName} {t.lastName}</div>
                  <div className="flex gap-1 mt-1">{t.instruments.map(i => <Badge key={i} tone="brand">{i}</Badge>)}</div>
                </div>
              </div>
              <div className="text-sm space-y-1 text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2"><Phone size={14} /> <span dir="ltr">{t.phone}</span></div>
                <div className="flex items-center gap-2"><Mail size={14} /> {t.email}</div>
                <div>זמינות: {t.availability.map(w => `${DAYS_HE[w.day]} ${w.from}–${w.to}`).join(' · ')}</div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1"><span>תפוסה {lessons.length}/{capacity} שעות</span><span>{ils(lessons.length * t.hourlyRate * 4.3)} לחודש</span></div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, load * 100)}%`, background: t.color }} /></div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card title="קורסים">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {data.courses.map(c => (
            <div key={c.id} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex justify-between"><b>{c.name}</b><span className="text-brand-600 font-semibold">{ils(c.monthlyPrice)}</span></div>
              <p className="text-xs text-slate-500 mt-1">{c.description}</p>
              <p className="text-xs text-slate-400 mt-2">{c.durationMin} דק׳ · גילאי {c.fromAge}+ · {data.enrollments.filter(e => e.courseId === c.id).length} רשומים</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
