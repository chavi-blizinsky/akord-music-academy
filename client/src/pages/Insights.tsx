import { useMemo } from 'react';
import { Brain, TrendingUp } from 'lucide-react';
import { Badge, Card, LineChart, Meter, PageHeader } from '../components/ui';
import { fullName, ils, useStore } from '../data/store';
import { predictChurn } from '../engine/churn';
import { forecastRevenue } from '../engine/forecast';

export default function Insights() {
  const { data, today } = useStore();
  const churn = useMemo(() => predictChurn(data, today), [data, today]);
  const forecast = useMemo(() => forecastRevenue(data.payments, 6), [data.payments]);
  const next = forecast.filter(p => p.actual === undefined);
  const tone = (l: string) => (l === 'high' ? 'red' : l === 'medium' ? 'amber' : 'green') as 'red' | 'amber' | 'green';

  return (
    <>
      <PageHeader title="תובנות וחיזוי" subtitle="מודל חיזוי נטישה עם הסבר לכל תחזית, ותחזית הכנסות עונתית" icon={<Brain />} />
      <Card title="תחזית הכנסות" className="mb-4" actions={<Badge tone="amber"><TrendingUp size={12} className="ms-1" /> מגמה × עונתיות</Badge>}>
        <LineChart points={forecast.map(p => ({ ...p, label: p.month.slice(2).replace('-', '/') }))} />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4">
          {next.map(p => (
            <div key={p.month} className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
              <div className="text-xs text-slate-500">{p.month}</div>
              <div className="font-bold">{ils(p.forecast!)}</div>
              <div className="text-[10px] text-slate-400">{ils(p.low!)}–{ils(p.high!)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`סיכון עזיבה – ${churn.filter(c => c.level !== 'low').length} תלמידים דורשים תשומת לב`}>
        <div className="space-y-3">
          {churn.slice(0, 12).map(p => (
            <details key={p.student.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 open:bg-slate-50 dark:open:bg-slate-900/60">
              <summary className="flex flex-wrap items-center gap-4 cursor-pointer list-none">
                <b className="w-40">{fullName(data, p.student.id)}</b>
                <div className="flex-1 min-w-40"><Meter value={p.probability} tone={tone(p.level)} /></div>
                <Badge tone={tone(p.level)}>{Math.round(p.probability * 100)}%</Badge>
                <span className="text-sm text-slate-500">💡 {p.action}</span>
              </summary>
              <div className="grid md:grid-cols-3 gap-2 mt-3">
                {p.factors.map(f => (
                  <div key={f.label} className="flex justify-between text-sm rounded-lg bg-white dark:bg-slate-800 px-3 py-2">
                    <span>{f.label}: <b>{f.value}</b></span>
                    <span className={f.impact > 0 ? 'text-red-500' : 'text-emerald-500'}>{f.impact > 0 ? '▲' : '▼'} {Math.abs(f.impact).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Card>
    </>
  );
}
