// Domain model – mirrors the ASP.NET Core entities in /server (Family, Student, Teacher, Course, ...).

export type StudentStatus = 'active' | 'waiting' | 'paused' | 'finished';
export type AttendanceStatus = 'present' | 'absent' | 'excused';

/** Sunday = 0 … Friday = 5 */
export type Day = 0 | 1 | 2 | 3 | 4 | 5;

export interface Family {
  id: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
}

export interface Student {
  id: string;
  familyId: string;
  firstName: string;
  birthDate: string;
  startDate: string;
  status: StudentStatus;
  instrument: string;
  level: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface AvailabilityWindow {
  day: Day;
  from: number; // hour, inclusive
  to: number;   // hour, exclusive
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  instruments: string[];
  active: boolean;
  hourlyRate: number;
  availability: AvailabilityWindow[];
  color: string;
}

export interface Course {
  id: string;
  name: string;
  instrument: string;
  monthlyPrice: number;
  durationMin: number;
  fromAge: number;
  toAge: number;
  description: string;
}

export interface Room {
  id: string;
  name: string;
  instruments: string[];
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  teacherId: string;
  startDate: string;
}

export interface Lesson {
  id: string;
  enrollmentId: string;
  studentId: string;
  teacherId: string;
  roomId: string;
  day: Day;
  hour: number;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
}

export interface Payment {
  id: string;
  familyId: string;
  month: string; // YYYY-MM
  amount: number;
  paidAt: string | null;
  method: 'credit' | 'transfer' | 'cash' | 'check';
}

export interface WaitlistEntry {
  id: string;
  studentId: string;
  courseId: string;
  requestedAt: string;
  priority: number;
}

export interface AppData {
  families: Family[];
  students: Student[];
  teachers: Teacher[];
  courses: Course[];
  rooms: Room[];
  enrollments: Enrollment[];
  lessons: Lesson[];
  attendance: Attendance[];
  payments: Payment[];
  waitlist: WaitlistEntry[];
}

export const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'] as const;
export const HOURS = [13, 14, 15, 16, 17, 18, 19, 20] as const;

export const STATUS_HE: Record<StudentStatus, string> = {
  active: 'פעיל',
  waiting: 'ממתין',
  paused: 'מוקפא',
  finished: 'סיים',
};
