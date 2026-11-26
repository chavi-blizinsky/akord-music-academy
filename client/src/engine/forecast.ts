import type { Payment } from '../lib/types';

/**
 * Revenue forecast: least-squares trend on de-seasonalised monthly revenue, multiplied back by
 * a per-calendar-month seasonal index. Returns a 95% band from the residual standard deviation.
 */

export interface MonthPoint { month: string; actual?: number; forecast?: number; low?: number; high?: number }

export function monthlyRevenue(payments: Payment[]): { month: string; total: number }[] {
  const by = new Map<string, number>();
  for (const p of payments) by.set(p.month, (by.get(p.month) ?? 0) + p.amount);
  return [...by].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
}

export function forecastRevenue(payments: Payment[], horizon = 6): MonthPoint[] {
  const series = monthlyRevenue(payments);
  if (series.length < 4) return series.map(s => ({ month: s.month, actual: s.total }));

  const mean = series.reduce((a, s) => a + s.total, 0) / series.length;
  const calMonth = (m: string) => Number(m.slice(5, 7)) - 1;

  // Seasonal index per calendar month (ratio to overall mean, averaged over the years available).
  const sums = new Array(12).fill(0), counts = new Array(12).fill(0);
  series.forEach(s => { sums[calMonth(s.month)] += s.total / mean; counts[calMonth(s.month)]++; });
  const season = sums.map((v, i) => (counts[i] ? v / counts[i] : 1));

  // Linear trend on de-seasonalised values.
  const ys = series.map(s => s.total / season[calMonth(s.month)]);
  const n = ys.length, xs = ys.map((_, i) => i);
  const xm = (n - 1) / 2, ym = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((a, x, i) => a + (x - xm) * (ys[i] - ym), 0) / xs.reduce((a, x) => a + (x - xm) ** 2, 0);
  const intercept = ym - slope * xm;

  const fitted = series.map((s, i) => (intercept + slope * i) * season[calMonth(s.month)]);
  const sd = Math.sqrt(series.reduce((a, s, i) => a + (s.total - fitted[i]) ** 2, 0) / Math.max(1, n - 2));

  const out: MonthPoint[] = series.map(s => ({ month: s.month, actual: s.total }));
  const [y, m] = series[n - 1].month.split('-').map(Number);
  for (let h = 1; h <= horizon; h++) {
    const d = new Date(y, m - 1 + h, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = (intercept + slope * (n - 1 + h)) * season[d.getMonth()];
    const band = 1.96 * sd * Math.sqrt(1 + h / n);
    out.push({ month, forecast: Math.round(value), low: Math.round(value - band), high: Math.round(value + band) });
  }
  // Join the lines visually: last actual point also starts the forecast line.
  out[n - 1].forecast = out[n - 1].actual;
  return out;
}
