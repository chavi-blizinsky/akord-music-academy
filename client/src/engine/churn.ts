import type { AppData, Student } from '../lib/types';
import { monthKey } from '../data/seed';

/**
 * Explainable churn-risk model (logistic regression over behavioural features).
 * Every prediction comes with the contribution of each feature, so the office knows *why* a student is at risk
 * and what to do about it.
 */

export interface ChurnFactor { label: string; value: string; impact: number }
export interface ChurnPrediction {
  student: Student;
  probability: number;
  level: 'low' | 'medium' | 'high';
  factors: ChurnFactor[];
  action: string;
}

const W = { bias: -2.4, recentAbsence: 3.6, absenceTrend: 2.4, latePayments: 0.35, unpaidNow: 1.1, tenureMonths: -0.03, level: -0.15 };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predictChurn(data: AppData, today: Date): ChurnPrediction[] {
  const out: ChurnPrediction[] = [];
  const thisMonth = monthKey(today);

  for (const s of data.students.filter(x => x.status === 'active')) {
    const att = data.attendance.filter(a => a.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date));
    const recent = att.slice(-4);
    const older = att.slice(0, -4);
    const rate = (xs: typeof att) => (xs.length ? xs.filter(a => a.status === 'absent').length / xs.length : 0);
    const recentAbsence = rate(recent);
    const absenceTrend = Math.max(0, recentAbsence - rate(older));

    const famPayments = data.payments.filter(p => p.familyId === s.familyId);
    const latePayments = famPayments.slice(-6).filter(p => p.paidAt && Number(p.paidAt.slice(8, 10)) > 10).length;
    const unpaidNow = famPayments.some(p => p.month === thisMonth && !p.paidAt) ? 1 : 0;
    const tenureMonths = (today.getTime() - new Date(s.startDate).getTime()) / (30.4 * 86400000);

    const contrib = {
      recentAbsence: W.recentAbsence * recentAbsence,
      absenceTrend: W.absenceTrend * absenceTrend,
      latePayments: W.latePayments * latePayments,
      unpaidNow: W.unpaidNow * unpaidNow,
      tenureMonths: W.tenureMonths * Math.min(tenureMonths, 36),
      level: W.level * s.level,
    };
    const z = W.bias + Object.values(contrib).reduce((a, b) => a + b, 0);
    const probability = sigmoid(z);

    const factors: (ChurnFactor & { kind: 'attendance' | 'payment' | 'profile' })[] = [
      { kind: 'attendance', label: 'היעדרויות בחודש האחרון', value: `${Math.round(recentAbsence * 100)}%`, impact: contrib.recentAbsence },
      { kind: 'attendance', label: 'עלייה בהיעדרויות', value: `+${Math.round(absenceTrend * 100)}%`, impact: contrib.absenceTrend },
      { kind: 'payment', label: 'תשלומים באיחור (חצי שנה)', value: String(latePayments), impact: contrib.latePayments },
      { kind: 'payment', label: 'החודש לא שולם', value: unpaidNow ? 'כן' : 'לא', impact: contrib.unpaidNow },
      { kind: 'profile', label: 'ותק', value: `${Math.round(tenureMonths)} חודשים`, impact: contrib.tenureMonths },
      { kind: 'profile', label: 'רמת נגינה', value: String(s.level), impact: contrib.level },
    ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)) as (ChurnFactor & { kind: 'attendance' | 'payment' | 'profile' })[];

    const level = probability > 0.55 ? 'high' : probability > 0.3 ? 'medium' : 'low';
    // The recommendation follows the strongest factor that *raises* the risk.
    const driver = factors.find(f => f.impact > 0);
    const action =
      level === 'low' ? 'אין צורך בפעולה'
      : driver?.kind === 'attendance' ? 'שיחה אישית עם ההורים והצעת שעה אחרת'
      : driver?.kind === 'payment' ? 'הצעת פריסת תשלומים או הנחת אחים'
      : 'שיחת מוטיבציה עם המורה והצעת הופעה בקונצרט';

    out.push({ student: s, probability, level, factors, action });
  }
  return out.sort((a, b) => b.probability - a.probability);
}
