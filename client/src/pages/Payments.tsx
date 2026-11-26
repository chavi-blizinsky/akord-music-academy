import { useState } from 'react';
import { CheckCircle2, CreditCard, MessageCircle, Printer } from 'lucide-react';
import { Badge, Card, PageHeader, Stat } from '../components/ui';
import { ils, useStore } from '../data/store';
import { whatsappReminder } from '../lib/integrations';
import { monthKey } from '../data/seed';

const METHOD_HE = { credit: 'אשראי', transfer: 'העברה', cash: 'מזומן', check: 'צ׳ק' } as const;

export default function Payments() {
  const { data, today, markPaid } = useStore();
  const months = [...new Set(data.payments.map(p => p.month))].sort().reverse();
  const [month, setMonth] = useState(monthKey(today));
  const rows = data.payments.filter(p => p.month === month);
  const paid = rows.filter(p => p.paidAt);
  const total = rows.reduce((a, p) => a + p.amount, 0);
  const got = paid.reduce((a, p) => a + p.amount, 0);

  const receipt = (id: string) => {
    const p = data.payments.find(x => x.id === id)!;
    const f = data.families.find(x => x.id === p.familyId)!;
    const w = window.open('', '_blank', 'width=480,height=640');
    w?.document.write(`<html dir="rtl"><body style="font-family:Arial;padding:32px"><h2>🎹 אקורד – בית ספר למוזיקה</h2><h3>קבלה מס׳ ${p.id.slice(1)}</h3><p>התקבל ממשפחת ${f.lastName} סך ${ils(p.amount)}</p><p>עבור שכר לימוד לחודש ${p.month}</p><p>אמצעי תשלום: ${METHOD_HE[p.method]} · תאריך ${p.paidAt}</p><hr/><small>מסמך הדגמה</small><script>print()</script></body></html>`);
  };

  return (
    <>
      <PageHeader title="תשלומים" subtitle="גבייה חודשית, תזכורות בוואטסאפ וקבלות" icon={<CreditCard />}
        actions={<select className="input w-40" value={month} onChange={e => setMonth(e.target.value)}>{months.map(m => <option key={m}>{m}</option>)}</select>} />
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <Stat label="צפי החודש" value={ils(total)} icon={<CreditCard />} />
        <Stat label="נגבה" value={ils(got)} hint={`${paid.length}/${rows.length} משפחות`} icon={<CheckCircle2 />} tone="green" />
        <Stat label="פתוח" value={ils(total - got)} hint={`${rows.length - paid.length} משפחות`} icon={<MessageCircle />} tone="red" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">משפחה</th><th className="th">סכום</th><th className="th">סטטוס</th><th className="th">אמצעי</th><th className="th">פעולות</th></tr></thead>
            <tbody>
              {rows.sort((a, b) => Number(!!a.paidAt) - Number(!!b.paidAt)).map(p => {
                const f = data.families.find(x => x.id === p.familyId)!;
                return (
                  <tr key={p.id}>
                    <td className="td font-medium">משפחת {f.lastName}</td>
                    <td className="td">{ils(p.amount)}</td>
                    <td className="td">{p.paidAt ? <Badge tone="green">שולם {p.paidAt.slice(8, 10)}/{p.paidAt.slice(5, 7)}</Badge> : <Badge tone="red">פתוח</Badge>}</td>
                    <td className="td">{p.paidAt ? METHOD_HE[p.method] : '—'}</td>
                    <td className="td">
                      <div className="flex gap-2">
                        {!p.paidAt && <>
                          <button className="btn-primary px-3 py-1" onClick={() => markPaid(p.id)}>סימון כשולם</button>
                          <a className="btn px-3 py-1 bg-emerald-600 text-white" href={whatsappReminder(f.phone, f.lastName, p.amount, p.month)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> תזכורת</a>
                        </>}
                        {p.paidAt && <button className="btn-ghost px-3 py-1" onClick={() => receipt(p.id)}><Printer size={14} /> קבלה</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
