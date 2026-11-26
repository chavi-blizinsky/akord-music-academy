import type { AppData, Attendance, Enrollment, Family, Payment, Student, Teacher, WaitlistEntry } from '../lib/types';

/** Deterministic PRNG so the demo looks identical on every machine. */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'גולדברג', 'רוזן', 'אזולאי', 'דהן', 'קליין', 'וייס', 'ברק', 'אלון', 'נחום', 'שמואלי'];
const FIRST = ['נועה', 'מאיה', 'תמר', 'יעל', 'שירה', 'אביגיל', 'הדס', 'רחל', 'אורי', 'איתי', 'יונתן', 'דניאל', 'עידו', 'אריאל', 'נועם', 'אליה', 'מיכל', 'עדי', 'רוני', 'ליאור'];
const STREETS = ['הרצל', 'ז׳בוטינסקי', 'רבי עקיבא', 'הנביאים', 'החשמונאים', 'בן גוריון'];

const today = new Date(2026, 10, 26);
const pad2 = (n: number) => String(n).padStart(2, '0');
// Local-time formatting: toISOString() would shift dates/months by the user's UTC offset.
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
export const iso = (d: Date) => `${monthKey(d)}-${pad2(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function createSeed(): AppData {
  const r = rng(7);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];

  const teachers: Teacher[] = [
    { id: 't1', firstName: 'אסתר', lastName: 'רובין', phone: '050-4410021', email: 'esther@akord.demo', instruments: ['פסנתר', 'תיאוריה'], active: true, hourlyRate: 140, color: '#8b5cf6', availability: [{ day: 0, from: 14, to: 19 }, { day: 2, from: 14, to: 20 }, { day: 4, from: 13, to: 18 }] },
    { id: 't2', firstName: 'דוד', lastName: 'אלמוג', phone: '052-3381177', email: 'david@akord.demo', instruments: ['גיטרה', 'בס'], active: true, hourlyRate: 130, color: '#06b6d4', availability: [{ day: 1, from: 15, to: 20 }, { day: 3, from: 15, to: 20 }] },
    { id: 't3', firstName: 'מרים', lastName: 'שטרן', phone: '054-9921340', email: 'miriam@akord.demo', instruments: ['כינור', 'צ׳לו'], active: true, hourlyRate: 150, color: '#f59e0b', availability: [{ day: 0, from: 15, to: 19 }, { day: 1, from: 14, to: 18 }, { day: 3, from: 14, to: 18 }] },
    { id: 't4', firstName: 'יוסף', lastName: 'בן שושן', phone: '053-7720458', email: 'yosef@akord.demo', instruments: ['תופים', 'כלי הקשה'], active: true, hourlyRate: 120, color: '#ef4444', availability: [{ day: 2, from: 15, to: 20 }, { day: 4, from: 14, to: 19 }] },
    { id: 't5', firstName: 'חנה', lastName: 'גרוס', phone: '058-6612093', email: 'chana@akord.demo', instruments: ['פסנתר', 'חליל'], active: true, hourlyRate: 135, color: '#10b981', availability: [{ day: 1, from: 13, to: 17 }, { day: 2, from: 13, to: 17 }, { day: 3, from: 16, to: 20 }] },
    { id: 't6', firstName: 'אליהו', lastName: 'נגר', phone: '050-1182736', email: 'eli@akord.demo', instruments: ['שירה', 'פיתוח קול'], active: true, hourlyRate: 145, color: '#ec4899', availability: [{ day: 0, from: 16, to: 20 }, { day: 4, from: 15, to: 19 }] },
  ];

  const courses = [
    { id: 'c1', name: 'פסנתר קלאסי', instrument: 'פסנתר', monthlyPrice: 420, durationMin: 45, fromAge: 6, toAge: 99, description: 'שיטת סוזוקי ורפרטואר קלאסי, הכנה לבחינות' },
    { id: 'c2', name: 'גיטרה מודרנית', instrument: 'גיטרה', monthlyPrice: 380, durationMin: 45, fromAge: 8, toAge: 99, description: 'אקורדים, ליווי שירים ואלתור' },
    { id: 'c3', name: 'כינור', instrument: 'כינור', monthlyPrice: 440, durationMin: 45, fromAge: 5, toAge: 99, description: 'יסודות, נגינה בתזמורת הנוער' },
    { id: 'c4', name: 'תופים', instrument: 'תופים', monthlyPrice: 390, durationMin: 45, fromAge: 7, toAge: 99, description: 'קצב, קואורדינציה ומערכת תופים מלאה' },
    { id: 'c5', name: 'חליל צד', instrument: 'חליל', monthlyPrice: 360, durationMin: 30, fromAge: 7, toAge: 99, description: 'נשימה, צליל ונגינה בהרכב' },
    { id: 'c6', name: 'פיתוח קול', instrument: 'שירה', monthlyPrice: 410, durationMin: 45, fromAge: 9, toAge: 99, description: 'טכניקה קולית, הופעה ובמה' },
    { id: 'c7', name: 'צ׳לו', instrument: 'צ׳לו', monthlyPrice: 460, durationMin: 45, fromAge: 7, toAge: 99, description: 'נגינה קאמרית ותזמורתית' },
  ];

  const rooms = [
    { id: 'r1', name: 'חדר סטיינווי', instruments: ['פסנתר', 'שירה', 'חליל', 'כינור', 'צ׳לו'] },
    { id: 'r2', name: 'חדר ימאהה', instruments: ['פסנתר', 'שירה', 'חליל'] },
    { id: 'r3', name: 'אולפן הקלטות', instruments: ['גיטרה', 'בס', 'שירה', 'תופים'] },
    { id: 'r4', name: 'חדר מיתרים', instruments: ['כינור', 'צ׳לו', 'גיטרה'] },
  ];

  const families: Family[] = [];
  const students: Student[] = [];
  const enrollments: Enrollment[] = [];
  const waitlist: WaitlistEntry[] = [];
  const usedLast = new Set<string>();

  for (let f = 0; f < 26; f++) {
    let last = pick(LAST);
    while (usedLast.has(last) && usedLast.size < LAST.length) last = pick(LAST);
    usedLast.add(last);
    const fam: Family = {
      id: `f${f + 1}`,
      lastName: last,
      phone: `05${Math.floor(r() * 9)}-${Math.floor(1000000 + r() * 8999999)}`,
      email: `family${f + 1}@mail.demo`,
      address: `${pick(STREETS)} ${1 + Math.floor(r() * 80)}, ירושלים`,
    };
    families.push(fam);

    const kids = 1 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const course = pick(courses);
      const age = 7 + Math.floor(r() * 10);
      const start = addDays(today, -Math.floor(60 + r() * 900));
      const roll = r();
      const status = roll < 0.78 ? 'active' : roll < 0.88 ? 'waiting' : roll < 0.94 ? 'paused' : 'finished';
      const s: Student = {
        id: `s${students.length + 1}`,
        familyId: fam.id,
        firstName: pick(FIRST),
        birthDate: iso(new Date(today.getFullYear() - age, Math.floor(r() * 12), 1 + Math.floor(r() * 27))),
        startDate: iso(start),
        status,
        instrument: course.instrument,
        level: (1 + Math.floor(r() * 5)) as Student['level'],
      };
      students.push(s);
      if (status === 'waiting') {
        waitlist.push({ id: `w${waitlist.length + 1}`, studentId: s.id, courseId: course.id, requestedAt: iso(addDays(today, -Math.floor(r() * 50))), priority: 1 + Math.floor(r() * 3) });
      } else if (status === 'active' || status === 'paused') {
        const teacher = teachers.find(t => t.instruments.includes(course.instrument)) ?? teachers[0];
        enrollments.push({ id: `e${enrollments.length + 1}`, studentId: s.id, courseId: course.id, teacherId: teacher.id, startDate: s.startDate });
      }
    }
  }

  // Attendance: last 10 weeks for active students. A few students drift away – the churn model should notice.
  const attendance: Attendance[] = [];
  const drifting = new Set(students.filter(() => r() < 0.18).map(s => s.id));
  for (const s of students.filter(x => x.status === 'active')) {
    for (let w = 10; w >= 1; w--) {
      const date = iso(addDays(today, -w * 7));
      const recentWeek = w <= 4;
      const pAbsent = drifting.has(s.id) ? (recentWeek ? 0.55 : 0.15) : 0.07;
      const x = r();
      attendance.push({ id: `a${attendance.length + 1}`, studentId: s.id, date, status: x < pAbsent ? 'absent' : x < pAbsent + 0.04 ? 'excused' : 'present' });
    }
  }

  // Payments: 18 months of history with mild seasonality (summer dip, September peak).
  const payments: Payment[] = [];
  const seasonal = [1.0, 1.0, 1.02, 1.0, 0.98, 0.9, 0.72, 0.7, 1.12, 1.08, 1.04, 1.02];
  for (let m = 17; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const growth = 1 + (17 - m) * 0.012;
    for (const fam of families) {
      const kids = enrollments.filter(e => students.find(s => s.id === e.studentId)?.familyId === fam.id);
      if (!kids.length) continue;
      const base = kids.reduce((sum, e) => sum + (courses.find(c => c.id === e.courseId)?.monthlyPrice ?? 0), 0);
      const amount = Math.round((base * seasonal[d.getMonth()] * growth) / 10) * 10;
      const lateFamily = drifting.has(students.find(s => s.familyId === fam.id)?.id ?? '');
      const unpaid = m === 0 ? r() < (lateFamily ? 0.7 : 0.18) : m === 1 && lateFamily && r() < 0.5;
      const paidDay = lateFamily ? 12 + Math.floor(r() * 15) : 1 + Math.floor(r() * 6);
      payments.push({
        id: `p${payments.length + 1}`,
        familyId: fam.id,
        month: monthKey(d),
        amount,
        paidAt: unpaid ? null : iso(new Date(d.getFullYear(), d.getMonth(), paidDay)),
        method: pick(['credit', 'credit', 'transfer', 'cash', 'check'] as const),
      });
    }
  }

  return { families, students, teachers, courses, rooms, enrollments, lessons: [], attendance, payments, waitlist };
}

export const DEMO_TODAY = today;
export const DEMO_MONTH = monthKey(today);
export const DEMO_TODAY_ISO = iso(today);
