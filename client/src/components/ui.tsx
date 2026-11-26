import clsx from 'clsx';
import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">{icon}</div>
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone = 'brand' }: { label: string; value: ReactNode; hint?: string; icon: ReactNode; tone?: 'brand' | 'gold' | 'red' | 'green' }) {
  const tones = { brand: 'from-brand-500/15 text-brand-600', gold: 'from-amber-400/20 text-amber-600', red: 'from-red-500/15 text-red-600', green: 'from-emerald-500/15 text-emerald-600' };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={clsx('grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br to-transparent', tones[tone])}>{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'brand' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  };
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={clsx('card p-5', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Lightweight SVG line chart with an optional confidence band – no chart library needed. */
export function LineChart({ points, height = 220 }: { points: { label: string; actual?: number; forecast?: number; low?: number; high?: number }[]; height?: number }) {
  const w = 720, h = height, pad = 36;
  const vals = points.flatMap(p => [p.actual, p.forecast, p.low, p.high].filter((v): v is number => v !== undefined));
  const max = Math.max(...vals) * 1.05, min = Math.min(...vals) * 0.9;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const path = (key: 'actual' | 'forecast') => points.map((p, i) => (p[key] === undefined ? null : `${x(i)},${y(p[key]!)}`)).filter(Boolean).join(' L ');
  const band = points.map((p, i) => (p.high !== undefined ? { i, hi: p.high, lo: p.low! } : null)).filter(Boolean) as { i: number; hi: number; lo: number }[];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="גרף הכנסות" direction="ltr">
      <defs>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity=".35" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <g key={t}>
          <line x1={pad} x2={w - pad} y1={y(min + t * (max - min))} y2={y(min + t * (max - min))} stroke="currentColor" strokeOpacity=".08" />
          <text x={4} y={y(min + t * (max - min)) + 4} fontSize="10" fill="currentColor" opacity=".5">{Math.round((min + t * (max - min)) / 1000)}K</text>
        </g>
      ))}
      {band.length > 1 && (
        <path d={`M ${band.map(b => `${x(b.i)},${y(b.hi)}`).join(' L ')} L ${[...band].reverse().map(b => `${x(b.i)},${y(b.lo)}`).join(' L ')} Z`} fill="#f59e0b" opacity=".15" />
      )}
      <path d={`M ${path('actual')} L ${x(points.filter(p => p.actual !== undefined).length - 1)},${h - pad} L ${pad},${h - pad} Z`} fill="url(#area)" />
      <path d={`M ${path('actual')}`} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinejoin="round" />
      <path d={`M ${path('forecast')}`} fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 6" />
      {points.map((p, i) => i % 2 === 0 && <text key={p.label} x={x(i)} y={h - 10} fontSize="10" textAnchor="middle" fill="currentColor" opacity=".55">{p.label}</text>)}
    </svg>
  );
}

export function Meter({ value, tone }: { value: number; tone: 'green' | 'amber' | 'red' }) {
  const color = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}
