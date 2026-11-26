import type { AppData } from '../lib/types';
import { DAYS_HE } from '../lib/types';
import { predictChurn } from './churn';
import { forecastRevenue } from './forecast';
import { fullName, ils } from '../data/store';
import { iso, monthKey } from '../data/seed';

/**
 * "Akord Assistant" – a tool-using agent.
 * The same tool set is exposed to Claude (when the visitor provides an API key) and to an offline Hebrew
 * intent router (when they don't), so the demo always answers from live data.
 */

export interface Tool {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, { type: string; description: string }>; required?: string[] };
  run: (data: AppData, today: Date, input: Record<string, string>) => string;
}

const thisMonth = (today: Date) => monthKey(today);

export const TOOLS: Tool[] = [
  {
    name: 'unpaid_families',
    description: 'Families that have not paid the current month, with amount and phone',
    input_schema: { type: 'object', properties: {} },
    run: (d, today) => {
      const rows = d.payments.filter(p => p.month === thisMonth(today) && !p.paidAt);
      if (!rows.length) return 'כל המשפחות שילמו החודש 🎉';
      const total = rows.reduce((a, p) => a + p.amount, 0);
      return `${rows.length} משפחות לא שילמו החודש (סה״כ ${ils(total)}):\n` + rows.map(p => {
        const f = d.families.find(x => x.id === p.familyId)!;
        return `• משפחת ${f.lastName} – ${ils(p.amount)} – ${f.phone}`;
      }).join('\n');
    },
  },
  {
    name: 'at_risk_students',
    description: 'Students with the highest predicted churn risk and the reason',
    input_schema: { type: 'object', properties: { limit: { type: 'string', description: 'how many to return' } } },
    run: (d, today, i) => {
      const list = predictChurn(d, today).filter(p => p.level !== 'low').slice(0, Number(i.limit ?? 5));
      if (!list.length) return 'אין כרגע תלמידים בסיכון גבוה.';
      return 'תלמידים בסיכון עזיבה:\n' + list.map(p => `• ${fullName(d, p.student.id)} – ${Math.round(p.probability * 100)}% (בעיקר: ${p.factors[0].label}). מומלץ: ${p.action}`).join('\n');
    },
  },
  {
    name: 'teacher_schedule',
    description: 'Weekly schedule of a teacher by (partial) name',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: 'teacher first or last name' } }, required: ['name'] },
    run: (d, _t, i) => {
      const t = d.teachers.find(x => `${x.firstName} ${x.lastName}`.includes(i.name ?? ''));
      if (!t) return `לא מצאתי מורה בשם "${i.name}".`;
      const ls = d.lessons.filter(l => l.teacherId === t.id).sort((a, b) => a.day - b.day || a.hour - b.hour);
      return `המערכת של ${t.firstName} ${t.lastName} (${ls.length} שיעורים):\n` + ls.map(l => `• ${DAYS_HE[l.day]} ${l.hour}:00 – ${fullName(d, l.studentId)}`).join('\n');
    },
  },
  {
    name: 'school_stats',
    description: 'Headline numbers: students, teachers, waitlist, this month revenue',
    input_schema: { type: 'object', properties: {} },
    run: (d, today) => {
      const active = d.students.filter(s => s.status === 'active').length;
      const rev = d.payments.filter(p => p.month === thisMonth(today)).reduce((a, p) => a + p.amount, 0);
      return `📊 ${active} תלמידים פעילים, ${d.teachers.filter(t => t.active).length} מורים, ${d.waitlist.length} ברשימת המתנה, ${d.lessons.length} שיעורים בשבוע. הכנסה צפויה החודש: ${ils(rev)}.`;
    },
  },
  {
    name: 'revenue_forecast',
    description: 'Revenue forecast for the next months with confidence range',
    input_schema: { type: 'object', properties: {} },
    run: d => {
      const f = forecastRevenue(d.payments, 3).filter(p => p.actual === undefined);
      return 'תחזית הכנסות:\n' + f.map(p => `• ${p.month}: ${ils(p.forecast!)} (טווח ${ils(p.low!)}–${ils(p.high!)})`).join('\n');
    },
  },
  {
    name: 'waitlist',
    description: 'Students waiting for a course',
    input_schema: { type: 'object', properties: {} },
    run: d => d.waitlist.length
      ? 'רשימת המתנה:\n' + d.waitlist.map(w => `• ${fullName(d, w.studentId)} – ${d.courses.find(c => c.id === w.courseId)?.name} (מאז ${w.requestedAt})`).join('\n')
      : 'רשימת ההמתנה ריקה.',
  },
];

/** Offline router: Hebrew keyword intents → tools. */
export function localAnswer(q: string, d: AppData, today: Date): string {
  const t = q.replace(/[?!.]/g, '');
  const run = (name: string, input: Record<string, string> = {}) => TOOLS.find(x => x.name === name)!.run(d, today, input);
  if (/שילם|שילמו|חוב|תשלום|גביה|גבייה/.test(t)) return run('unpaid_families');
  if (/סיכון|עוזב|לעזוב|נטישה|ינשור/.test(t)) return run('at_risk_students');
  if (/תחזית|צפי|יכניס|הכנסות הבאות/.test(t)) return run('revenue_forecast');
  if (/המתנה|ממתינ/.test(t)) return run('waitlist');
  const teacher = d.teachers.find(x => t.includes(x.firstName) || t.includes(x.lastName));
  if (teacher && /מערכת|שיעורים|מתי|לו״ז|לוז/.test(t)) return run('teacher_schedule', { name: teacher.firstName });
  if (/כמה|סטטיסטיק|מצב|סיכום/.test(t)) return run('school_stats');
  return 'אני יכול לעזור עם: מי לא שילם החודש, מי בסיכון לעזוב, המערכת של מורה, רשימת המתנה, תחזית הכנסות וסיכום מצב. נסו לשאול: "מי לא שילם החודש?"';
}

/** Claude tool-use loop, called directly from the browser with the visitor's own key. */
export async function claudeAnswer(question: string, apiKey: string, d: AppData, today: Date): Promise<string> {
  const tools = TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const messages: unknown[] = [{ role: 'user', content: question }];
  for (let step = 0; step < 4; step++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 800,
        system: `You are the office assistant of "Akord", a music school. Today is ${iso(today)}. Always answer in Hebrew, concise and friendly. Use the tools for any fact about the school.`,
        tools,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const body = await res.json() as { stop_reason: string; content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, string> }[] };
    messages.push({ role: 'assistant', content: body.content });
    if (body.stop_reason !== 'tool_use') return body.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    const results = body.content.filter(c => c.type === 'tool_use').map(c => ({
      type: 'tool_result', tool_use_id: c.id, content: TOOLS.find(t => t.name === c.name)?.run(d, today, c.input ?? {}) ?? 'unknown tool',
    }));
    messages.push({ role: 'user', content: results });
  }
  return 'לא הצלחתי להשלים את התשובה.';
}
