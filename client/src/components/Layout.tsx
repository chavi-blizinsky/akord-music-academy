import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bot, CalendarDays, CreditCard, GraduationCap, LayoutDashboard, Moon, Music, RotateCcw, Sparkles, Sun, Users } from 'lucide-react';
import { useStore } from '../data/store';

const NAV = [
  { to: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { to: '/studio', label: 'הסטודיו – אורגנית', icon: Music },
  { to: '/schedule', label: 'שיבוץ חכם', icon: CalendarDays },
  { to: '/students', label: 'תלמידים ומשפחות', icon: GraduationCap },
  { to: '/teachers', label: 'מורים וקורסים', icon: Users },
  { to: '/payments', label: 'תשלומים', icon: CreditCard },
  { to: '/insights', label: 'תובנות וחיזוי', icon: Sparkles },
  { to: '/assistant', label: 'העוזר החכם', icon: Bot },
];

export default function Layout() {
  const { reset } = useStore();
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('akord-theme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('akord-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  return (
    <div className="min-h-screen lg:flex bg-gradient-to-br from-slate-50 via-white to-brand-50 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/40">
      <aside className="lg:w-64 lg:min-h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-l border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur p-4 flex lg:flex-col gap-2 overflow-x-auto">
        <div className="hidden lg:flex items-center gap-3 px-2 py-3 mb-4">
          <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-gold-500 text-white text-xl shadow-glow">🎹</div>
          <div>
            <div className="font-bold text-lg leading-tight">אקורד</div>
            <div className="text-xs text-slate-500">בית ספר למוזיקה</div>
          </div>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition', isActive ? 'bg-brand-600 text-white shadow-glow' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
        <div className="lg:mt-auto flex lg:flex-col gap-2 pt-2">
          <button className="btn-ghost justify-center" onClick={() => setDark(d => !d)}>{dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'מצב בהיר' : 'מצב כהה'}</button>
          <button className="btn-ghost justify-center" onClick={reset} title="איפוס נתוני ההדגמה"><RotateCcw size={16} /> איפוס הדגמה</button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-[1400px]">
        <Outlet />
      </main>
    </div>
  );
}
