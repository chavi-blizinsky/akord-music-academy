import { describe, expect, it } from 'vitest';
import { createSeed, DEMO_TODAY } from '../data/seed';
import { findConflicts, solveSchedule } from './scheduler';
import { predictChurn } from './churn';
import { forecastRevenue } from './forecast';
import { detectChord, toMidiFile } from '../studio/theory';
import { buildIcs, toCsv, whatsappReminder } from '../lib/integrations';

describe('scheduler', () => {
  const data = createSeed();
  const res = solveSchedule(data, { today: DEMO_TODAY });

  it('produces a timetable without any hard-constraint conflict', () => {
    expect(res.lessons.length).toBeGreaterThan(10);
    expect(findConflicts(res.lessons)).toEqual([]);
  });

  it('respects teacher availability and room suitability', () => {
    for (const l of res.lessons) {
      const t = data.teachers.find(x => x.id === l.teacherId)!;
      expect(t.availability.some(w => w.day === l.day && l.hour >= w.from && l.hour < w.to)).toBe(true);
      const e = data.enrollments.find(x => x.id === l.enrollmentId)!;
      const course = data.courses.find(c => c.id === e.courseId)!;
      expect(data.rooms.find(r => r.id === l.roomId)!.instruments).toContain(course.instrument);
    }
  });

  it('detects a manual double-booking', () => {
    const [a] = res.lessons;
    expect(findConflicts([a, { ...a, id: 'dup', studentId: 'other' }]).length).toBeGreaterThan(0);
  });
});

describe('churn model', () => {
  it('returns calibrated probabilities with explanations', () => {
    const preds = predictChurn(createSeed(), DEMO_TODAY);
    expect(preds.length).toBeGreaterThan(0);
    for (const p of preds) {
      expect(p.probability).toBeGreaterThan(0);
      expect(p.probability).toBeLessThan(1);
      expect(p.factors).toHaveLength(6);
    }
    expect(preds[0].probability).toBeGreaterThanOrEqual(preds[preds.length - 1].probability);
  });
});

describe('forecast', () => {
  it('extends the series with a widening confidence band', () => {
    const f = forecastRevenue(createSeed().payments, 6).filter(p => p.actual === undefined);
    expect(f).toHaveLength(6);
    expect(f[5].high! - f[5].low!).toBeGreaterThan(f[0].high! - f[0].low!);
  });
});

describe('music theory', () => {
  it('recognises chords in any inversion', () => {
    expect(detectChord([60, 64, 67])?.symbol).toBe('C');
    expect(detectChord([57, 60, 64])?.symbol).toBe('Am');
    expect(detectChord([64, 67, 72])?.symbol).toBe('C/E');
    expect(detectChord([55, 59, 62, 65])?.symbol).toBe('G7');
    expect(detectChord([60, 62])).toBeNull();
  });

  it('writes a valid MIDI header', async () => {
    const blob = toMidiFile([{ midi: 60, start: 0, duration: 500 }], 120);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
  });
});

describe('integrations', () => {
  const data = createSeed();
  data.lessons = solveSchedule(data, { today: DEMO_TODAY }).lessons;

  it('exports an iCalendar file with weekly recurring events', () => {
    const ics = buildIcs(data);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(data.lessons.length);
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
  });

  it('builds international WhatsApp links', () => {
    expect(whatsappReminder('052-1234567', 'כהן', 400, '2026-11')).toMatch(/^https:\/\/wa\.me\/972521234567\?text=/);
  });

  it('writes Excel-friendly CSV', () => {
    expect(toCsv([{ a: 'x"y', b: 1 }])).toBe('﻿"a","b"\n"x""y","1"');
  });
});
