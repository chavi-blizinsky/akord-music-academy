import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Lesson, Payment, Student } from '../lib/types';
import { createSeed, DEMO_TODAY, iso } from './seed';
import { solveSchedule } from '../engine/scheduler';

/**
 * Client-side repository. In the live demo data lives in localStorage; the same operations map 1:1
 * to the REST endpoints of the ASP.NET Core API in /server (see README → Architecture).
 */

const KEY = 'akord-demo-v2';

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppData;
  } catch { /* storage unavailable – fall back to seed */ }
  const seed = createSeed();
  seed.lessons = solveSchedule(seed, { today: DEMO_TODAY }).lessons;
  return seed;
}

interface Store {
  data: AppData;
  today: Date;
  updateStudent: (s: Student) => void;
  addStudent: (s: Omit<Student, 'id'>) => void;
  setLessons: (l: Lesson[]) => void;
  markPaid: (paymentId: string, method?: Payment['method']) => void;
  promoteFromWaitlist: (waitId: string) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore quota / private mode */ }
  }, [data]);

  const updateStudent = useCallback((s: Student) => setData(d => ({ ...d, students: d.students.map(x => (x.id === s.id ? s : x)) })), []);
  const addStudent = useCallback((s: Omit<Student, 'id'>) => setData(d => ({ ...d, students: [...d.students, { ...s, id: `s${Date.now()}` }] })), []);
  const setLessons = useCallback((lessons: Lesson[]) => setData(d => ({ ...d, lessons })), []);
  const markPaid = useCallback((id: string, method: Payment['method'] = 'credit') =>
    setData(d => ({ ...d, payments: d.payments.map(p => (p.id === id ? { ...p, paidAt: iso(DEMO_TODAY), method } : p)) })), []);

  const promoteFromWaitlist = useCallback((waitId: string) => setData(d => {
    const w = d.waitlist.find(x => x.id === waitId);
    if (!w) return d;
    const course = d.courses.find(c => c.id === w.courseId);
    const teacher = d.teachers.find(t => course && t.instruments.includes(course.instrument)) ?? d.teachers[0];
    const next: AppData = {
      ...d,
      waitlist: d.waitlist.filter(x => x.id !== waitId),
      students: d.students.map(s => (s.id === w.studentId ? { ...s, status: 'active' } : s)),
      enrollments: [...d.enrollments, { id: `e${Date.now()}`, studentId: w.studentId, courseId: w.courseId, teacherId: teacher.id, startDate: iso(DEMO_TODAY) }],
    };
    next.lessons = solveSchedule(next, { today: DEMO_TODAY }).lessons;
    return next;
  }), []);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setData(load());
  }, []);

  const value = useMemo(() => ({ data, today: DEMO_TODAY, updateStudent, addStudent, setLessons, markPaid, promoteFromWaitlist, reset }), [data, updateStudent, addStudent, setLessons, markPaid, promoteFromWaitlist, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside DataProvider');
  return s;
}

// ---- Derived helpers used across pages ----
export const fullName = (d: AppData, studentId: string) => {
  const s = d.students.find(x => x.id === studentId);
  const f = s && d.families.find(x => x.id === s.familyId);
  return s ? `${s.firstName} ${f?.lastName ?? ''}` : '';
};
export const teacherName = (d: AppData, id: string) => {
  const t = d.teachers.find(x => x.id === id);
  return t ? `${t.firstName} ${t.lastName}` : '';
};
export const ils = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
