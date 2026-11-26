import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Bot, KeyRound, Send, Wrench } from 'lucide-react';
import { Card, PageHeader } from '../components/ui';
import { useStore } from '../data/store';
import { claudeAnswer, localAnswer, TOOLS } from '../engine/assistant';

interface Msg { role: 'user' | 'bot'; text: string }

const SUGGESTIONS = ['מי לא שילם החודש?', 'מי בסיכון לעזוב?', 'מה המערכת של אסתר?', 'מה תחזית ההכנסות?', 'תן לי סיכום מצב', 'מי ברשימת המתנה?'];

export default function Assistant() {
  const { data, today } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'bot', text: 'שלום! אני העוזר של אקורד. אני עונה מהנתונים החיים של בית הספר – תשלומים, מערכת, תחזיות וסיכוני עזיבה. במה אפשר לעזור?' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem('akord-claude-key') ?? ''; } catch { return ''; } });
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    let answer: string;
    try {
      answer = key ? await claudeAnswer(q, key, data, today) : localAnswer(q, data, today);
    } catch (e) {
      answer = `(Claude לא זמין: ${(e as Error).message}) – עונה במצב מקומי:\n\n${localAnswer(q, data, today)}`;
    }
    setMsgs(m => [...m, { role: 'bot', text: answer }]);
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const saveKey = (v: string) => { setKey(v); try { sessionStorage.setItem('akord-claude-key', v); } catch { /* ignore */ } };

  return (
    <>
      <PageHeader title="העוזר החכם" subtitle="סוכן AI עם כלים: שואל את מסד הנתונים, מנתח ומציע פעולות" icon={<Bot />} />
      <div className="grid xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-3 flex flex-col h-[70vh]">
          <div className="flex-1 overflow-auto space-y-3 pe-1">
            {msgs.map((m, i) => (
              <div key={i} className={clsx('max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm', m.role === 'user' ? 'ms-auto bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800')}>{m.text}</div>
            ))}
            {busy && <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3 text-sm w-24 animate-pulse">חושב…</div>}
            <div ref={endRef} />
          </div>
          <div className="flex flex-wrap gap-2 my-3">{SUGGESTIONS.map(s => <button key={s} className="btn-ghost py-1 text-xs" onClick={() => ask(s)}>{s}</button>)}</div>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void ask(input); }}>
            <input className="input" placeholder="שאלו כל דבר על בית הספר…" value={input} onChange={e => setInput(e.target.value)} />
            <button className="btn-primary" disabled={busy}><Send size={16} /></button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="מנוע">
            <p className="text-sm text-slate-500 mb-3">{key ? 'מחובר ל-Claude: הסוכן בוחר בעצמו באילו כלים להשתמש.' : 'מצב מקומי: ניתוב כוונות בעברית לאותם כלים. אפשר לחבר Claude עם מפתח API אישי.'}</p>
            <label className="text-xs flex items-center gap-1 mb-1"><KeyRound size={12} /> מפתח Claude API (נשמר רק בלשונית הזו)</label>
            <input className="input" type="password" dir="ltr" placeholder="sk-ant-…" value={key} onChange={e => saveKey(e.target.value)} />
          </Card>
          <Card title="הכלים של הסוכן">
            <ul className="space-y-2 text-xs">
              {TOOLS.map(t => <li key={t.name} className="flex gap-2"><Wrench size={12} className="mt-0.5 text-brand-500 shrink-0" /><span><code className="text-brand-600">{t.name}</code> – {t.description}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
