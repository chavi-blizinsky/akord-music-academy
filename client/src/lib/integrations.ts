import type { AppData } from './types';
import { DEMO_TODAY } from '../data/seed';

/** External integrations that work without a backend: iCalendar export, WhatsApp deep links, CSV export. */

const pad = (n: number) => String(n).padStart(2, '0');

/** RFC 5545 calendar with weekly recurring lessons – imports into Google Calendar, Outlook and Apple Calendar. */
export function buildIcs(data: AppData, teacherId?: string): string {
  const lessons = data.lessons.filter(l => !teacherId || l.teacherId === teacherId);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Akord//Music School//HE', 'CALSCALE:GREGORIAN'];
  const sunday = new Date(DEMO_TODAY);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  for (const l of lessons) {
    const d = new Date(sunday);
    d.setDate(d.getDate() + l.day);
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const s = data.students.find(x => x.id === l.studentId);
    const f = data.families.find(x => x.id === s?.familyId);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${l.id}@akord.demo`,
      `DTSTAMP:${date}T000000Z`,
      `DTSTART;TZID=Asia/Jerusalem:${date}T${pad(l.hour)}0000`,
      `DTEND;TZID=Asia/Jerusalem:${date}T${pad(l.hour)}4500`,
      'RRULE:FREQ=WEEKLY',
      `SUMMARY:שיעור ${s?.instrument ?? ''} – ${s?.firstName ?? ''} ${f?.lastName ?? ''}`,
      `LOCATION:${data.rooms.find(r => r.id === l.roomId)?.name ?? ''}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function download(name: string, content: string | Blob, type = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const downloadIcs = (data: AppData, teacherId?: string) => download('akord-schedule.ics', buildIcs(data, teacherId), 'text/calendar');

/** wa.me link with a pre-filled, polite payment reminder. */
export function whatsappReminder(phone: string, lastName: string, amount: number, month: string) {
  const intl = phone.replace(/\D/g, '').replace(/^0/, '972');
  const text = `שלום משפחת ${lastName}, תזכורת ידידותית מאקורד 🎹 התשלום לחודש ${month} בסך ₪${amount} עדיין פתוח. אפשר לשלם בקישור או לחזור אלינו. תודה!`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** CSV with BOM so Excel opens Hebrew correctly. */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return '﻿' + [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}
