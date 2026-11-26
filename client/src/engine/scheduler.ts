import type { AppData, Day, Lesson } from '../lib/types';

/**
 * Weekly timetable solver.
 *
 * Constraint-satisfaction with backtracking:
 *  - hard: teacher availability, no double-booking of teacher / student / room, room must suit the instrument,
 *          young students (under 9) finish before 18:00
 *  - soft (scored): siblings back-to-back (one drive for the parents), compact teacher days (few gaps),
 *          spreading load across rooms
 * Variables are ordered by MRV (fewest legal slots first) so hard cases are placed while there is still room.
 */

export interface Slot { day: Day; hour: number; roomId: string }

export interface ScheduleResult {
  lessons: Lesson[];
  unscheduled: { enrollmentId: string; reason: string }[];
  score: number;
  stats: { explored: number; ms: number; siblingPairs: number; teacherGaps: number };
}

const ageOn = (birth: string, at: Date) => Math.floor((at.getTime() - new Date(birth).getTime()) / (365.25 * 86400000));

export function solveSchedule(data: AppData, opts: { maxNodes?: number; today?: Date } = {}): ScheduleResult {
  const t0 = performance.now();
  const maxNodes = opts.maxNodes ?? 60000;
  const today = opts.today ?? new Date();

  const active = new Set(data.students.filter(s => s.status === 'active').map(s => s.id));
  const enrollments = data.enrollments.filter(e => active.has(e.studentId));
  const studentById = new Map(data.students.map(s => [s.id, s]));
  const courseById = new Map(data.courses.map(c => [c.id, c]));
  const teacherById = new Map(data.teachers.map(t => [t.id, t]));

  // Domain of every enrollment = all slots that satisfy the unary hard constraints.
  const domains = new Map<string, Slot[]>();
  const unscheduled: ScheduleResult['unscheduled'] = [];
  for (const e of enrollments) {
    const teacher = teacherById.get(e.teacherId);
    const course = courseById.get(e.courseId);
    const student = studentById.get(e.studentId);
    if (!teacher || !course || !student) continue;
    const young = ageOn(student.birthDate, today) < 9;
    const rooms = data.rooms.filter(r => r.instruments.includes(course.instrument));
    const slots: Slot[] = [];
    for (const w of teacher.availability) {
      for (let h = w.from; h < w.to; h++) {
        if (young && h >= 18) continue;
        for (const room of rooms) slots.push({ day: w.day, hour: h, roomId: room.id });
      }
    }
    if (!slots.length) unscheduled.push({ enrollmentId: e.id, reason: rooms.length ? 'אין חלון זמינות מתאים אצל המורה' : 'אין חדר שמתאים לכלי' });
    else domains.set(e.id, slots);
  }

  const order = enrollments.filter(e => domains.has(e.id)).sort((a, b) => domains.get(a.id)!.length - domains.get(b.id)!.length);

  const busyTeacher = new Set<string>();
  const busyStudent = new Set<string>();
  const busyRoom = new Set<string>();
  const key = (id: string, d: number, h: number) => `${id}|${d}|${h}`;
  const assignment = new Map<string, Slot>();
  let explored = 0;

  const familyOf = (studentId: string) => studentById.get(studentId)?.familyId;

  // Soft score for placing enrollment e at slot s given what is already placed.
  function slotScore(eId: string, s: Slot): number {
    const e = enrollments.find(x => x.id === eId)!;
    let score = 0;
    const fam = familyOf(e.studentId);
    for (const [otherId, os] of assignment) {
      const o = enrollments.find(x => x.id === otherId)!;
      if (fam && familyOf(o.studentId) === fam && os.day === s.day) score += Math.abs(os.hour - s.hour) === 1 ? 12 : -2;
      if (o.teacherId === e.teacherId && os.day === s.day) score += Math.abs(os.hour - s.hour) === 1 ? 4 : 1;
    }
    score -= s.hour >= 19 ? 2 : 0; // late lessons are less popular
    return score;
  }

  function place(i: number): boolean {
    if (i === order.length) return true;
    if (explored > maxNodes) return false;
    const e = order[i];
    const candidates = domains.get(e.id)!
      .filter(s => !busyTeacher.has(key(e.teacherId, s.day, s.hour)) && !busyStudent.has(key(e.studentId, s.day, s.hour)) && !busyRoom.has(key(s.roomId, s.day, s.hour)))
      .map(s => ({ s, score: slotScore(e.id, s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6); // beam: try the six most promising slots
    for (const { s } of candidates) {
      explored++;
      assignment.set(e.id, s);
      busyTeacher.add(key(e.teacherId, s.day, s.hour));
      busyStudent.add(key(e.studentId, s.day, s.hour));
      busyRoom.add(key(s.roomId, s.day, s.hour));
      if (place(i + 1)) return true;
      assignment.delete(e.id);
      busyTeacher.delete(key(e.teacherId, s.day, s.hour));
      busyStudent.delete(key(e.studentId, s.day, s.hour));
      busyRoom.delete(key(s.roomId, s.day, s.hour));
    }
    // Could not place this one without breaking later ones – skip it and keep going (best-effort).
    unscheduled.push({ enrollmentId: e.id, reason: 'כל המשבצות של המורה תפוסות' });
    return place(i + 1);
  }
  place(0);

  const lessons: Lesson[] = [...assignment].map(([eId, s], idx) => {
    const e = enrollments.find(x => x.id === eId)!;
    return { id: `l${idx + 1}`, enrollmentId: eId, studentId: e.studentId, teacherId: e.teacherId, roomId: s.roomId, day: s.day, hour: s.hour };
  });

  return { lessons, unscheduled, score: totalScore(lessons, data), stats: { explored, ms: Math.round(performance.now() - t0), siblingPairs: siblingPairs(lessons, data), teacherGaps: teacherGaps(lessons) } };
}

export function siblingPairs(lessons: Lesson[], data: AppData): number {
  const fam = new Map(data.students.map(s => [s.id, s.familyId]));
  let pairs = 0;
  for (let i = 0; i < lessons.length; i++)
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i], b = lessons[j];
      if (a.studentId !== b.studentId && fam.get(a.studentId) === fam.get(b.studentId) && a.day === b.day && Math.abs(a.hour - b.hour) === 1) pairs++;
    }
  return pairs;
}

export function teacherGaps(lessons: Lesson[]): number {
  const byTeacherDay = new Map<string, number[]>();
  for (const l of lessons) {
    const k = `${l.teacherId}|${l.day}`;
    byTeacherDay.set(k, [...(byTeacherDay.get(k) ?? []), l.hour]);
  }
  let gaps = 0;
  for (const hours of byTeacherDay.values()) {
    hours.sort((a, b) => a - b);
    for (let i = 1; i < hours.length; i++) gaps += hours[i] - hours[i - 1] - 1;
  }
  return gaps;
}

function totalScore(lessons: Lesson[], data: AppData) {
  return lessons.length * 10 + siblingPairs(lessons, data) * 12 - teacherGaps(lessons) * 3;
}

/** Validates hard constraints – used by tests and by the UI after manual drag & drop. */
export function findConflicts(lessons: Lesson[]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const l of lessons) {
    for (const k of [`T${l.teacherId}|${l.day}|${l.hour}`, `S${l.studentId}|${l.day}|${l.hour}`, `R${l.roomId}|${l.day}|${l.hour}`]) {
      if (seen.has(k)) out.push(`${seen.get(k)} ↔ ${l.id}`);
      else seen.set(k, l.id);
    }
  }
  return out;
}
