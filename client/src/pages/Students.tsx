import { useMemo, useState } from 'react';
import { ArrowUpCircle, Download, GraduationCap, Search } from 'lucide-react';
import { Badge, Card, PageHeader } from '../components/ui';
import { useStore } from '../data/store';
import { STATUS_HE, type StudentStatus } from '../lib/types';
import { download, toCsv } from '../lib/integrations';

const TONE: Record<StudentStatus, 'green' | 'amber' | 'slate' | 'brand'> = { active: 'green', waiting: 'amber', paused: 'slate', finished: 'brand' };

export default function Students() {
  const { data, today, promoteFromWaitlist } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StudentStatus | 'all'>('all');

  const rows = useMemo(() => data.students
    .map(s => {
      const fam = data.families.find(f => f.id === s.familyId)!;
      const siblings = data.students.filter(x => x.familyId === s.familyId).length;
      const age = Math.floor((today.getTime() - new Date(s.birthDate).getTime()) / (365.25 * 86400000));
      return { s, fam, siblings, age };
    })
    .filter(r => (status === 'all' || r.s.status === status) && `${r.s.firstName} ${r.fam.lastName} ${r.s.instrument} ${r.fam.phone}`.includes(q)), [data, q, status, today]);

  const exportCsv = () => download('akord-students.csv', toCsv(rows.map(r => ({
    'שם פרטי': r.s.firstName, 'משפחה': r.fam.lastName, 'כלי': r.s.instrument, 'רמה': r.s.level, 'גיל': r.age, 'סטטוס': STATUS_HE[r.s.status], 'טלפון': r.fam.phone, 'מייל': r.fam.email,
  }))), 'text/csv');

  return (
    <>
      <PageHeader title="תלמידים ומשפחות" subtitle={`${data.students.length} תלמידים · ${data.families.length} משפחות`} icon={<GraduationCap />}
        actions={<button className="btn-ghost" onClick={exportCsv}><Download size={16} /> ייצוא לאקסל</button>} />

      {data.waitlist.length > 0 && (
        <Card title={`רשימת המתנה (${data.waitlist.length})`} className="mb-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.waitlist.sort((a, b) => b.priority - a.priority).map(w => {
              const s = data.students.find(x => x.id === w.studentId)!;
              const f = data.families.find(x => x.id === s.familyId)!;
              return (
                <div key={w.id} className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
                  <div>
                    <div className="font-medium">{s.firstName} {f.lastName}</div>
                    <div className="text-xs text-slate-500">{data.courses.find(c => c.id === w.courseId)?.name} · ממתין מ-{w.requestedAt}</div>
                  </div>
                  <button className="btn-primary px-3 py-1.5" onClick={() => promoteFromWaitlist(w.id)} title="רישום ושיבוץ אוטומטי במערכת"><ArrowUpCircle size={14} /> רישום ושיבוץ</button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-56">
            <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
            <input className="input pr-9" placeholder="חיפוש לפי שם, כלי או טלפון…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="input w-40" value={status} onChange={e => setStatus(e.target.value as StudentStatus | 'all')}>
            <option value="all">כל הסטטוסים</option>
            {(Object.keys(STATUS_HE) as StudentStatus[]).map(k => <option key={k} value={k}>{STATUS_HE[k]}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">תלמיד/ה</th><th className="th">גיל</th><th className="th">כלי</th><th className="th">רמה</th><th className="th">אחים</th><th className="th">טלפון</th><th className="th">סטטוס</th></tr></thead>
            <tbody>
              {rows.map(({ s, fam, siblings, age }) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td font-medium">{s.firstName} {fam.lastName}</td>
                  <td className="td">{age}</td>
                  <td className="td">{s.instrument}</td>
                  <td className="td">{'★'.repeat(s.level)}<span className="text-slate-300">{'★'.repeat(5 - s.level)}</span></td>
                  <td className="td">{siblings > 1 ? <Badge tone="brand">{siblings} במשפחה</Badge> : '—'}</td>
                  <td className="td" dir="ltr">{fam.phone}</td>
                  <td className="td"><Badge tone={TONE[s.status]}>{STATUS_HE[s.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
