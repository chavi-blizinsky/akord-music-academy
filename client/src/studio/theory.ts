/** Music theory helpers: note names, chord recognition and a minimal Standard MIDI File writer. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_HE = ['דו', 'דו#', 'רה', 'רה#', 'מי', 'פה', 'פה#', 'סול', 'סול#', 'לה', 'לה#', 'סי'];

export const noteName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

const CHORDS: { name: string; he: string; intervals: number[] }[] = [
  { name: '', he: 'מז׳ור', intervals: [0, 4, 7] },
  { name: 'm', he: 'מינור', intervals: [0, 3, 7] },
  { name: '7', he: 'דומיננט 7', intervals: [0, 4, 7, 10] },
  { name: 'maj7', he: 'מז׳ור 7', intervals: [0, 4, 7, 11] },
  { name: 'm7', he: 'מינור 7', intervals: [0, 3, 7, 10] },
  { name: 'dim', he: 'מוקטן', intervals: [0, 3, 6] },
  { name: 'aug', he: 'מוגדל', intervals: [0, 4, 8] },
  { name: 'sus2', he: 'sus2', intervals: [0, 2, 7] },
  { name: 'sus4', he: 'sus4', intervals: [0, 5, 7] },
];

/** Recognises the chord formed by the held notes (any inversion). */
export function detectChord(midis: number[]): { symbol: string; label: string } | null {
  const pcs = [...new Set(midis.map(m => m % 12))];
  if (pcs.length < 3) return null;
  const bass = Math.min(...midis) % 12;
  for (const root of pcs) {
    const rel = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const c of CHORDS) {
      if (c.intervals.length === rel.length && c.intervals.every((v, i) => v === rel[i])) {
        const inv = bass !== root ? `/${NOTE_NAMES[bass]}` : '';
        return { symbol: `${NOTE_NAMES[root]}${c.name}${inv}`, label: `${NOTE_NAMES_HE[root]} ${c.he}` };
      }
    }
  }
  return null;
}

export interface RecordedNote { midi: number; start: number; duration: number }

/** Writes a single-track SMF (format 0) – the recording opens in any DAW / notation app. */
export function toMidiFile(notes: RecordedNote[], bpm: number): Blob {
  const ppq = 480;
  const msPerTick = 60000 / bpm / ppq;
  const events: { tick: number; data: number[] }[] = [];
  for (const n of notes) {
    events.push({ tick: Math.round(n.start / msPerTick), data: [0x90, n.midi, 100] });
    events.push({ tick: Math.round((n.start + n.duration) / msPerTick), data: [0x80, n.midi, 0] });
  }
  events.sort((a, b) => a.tick - b.tick);

  const vlq = (v: number) => {
    const bytes = [v & 0x7f];
    while ((v >>= 7)) bytes.unshift((v & 0x7f) | 0x80);
    return bytes;
  };
  const tempo = Math.round(60000000 / bpm);
  const track: number[] = [0, 0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255];
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.data);
    last = e.tick;
  }
  track.push(0, 0xff, 0x2f, 0);

  const u32 = (v: number) => [(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (ppq >> 8) & 255, ppq & 255];
  const trk = [0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track];
  return new Blob([new Uint8Array([...header, ...trk])], { type: 'audio/midi' });
}

/** Practice songs for "learn mode" (public-domain melodies). Each entry is a MIDI note number. */
export const SONGS: { id: string; title: string; notes: number[] }[] = [
  { id: 'ode', title: 'שיר השמחה – בטהובן', notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62, 64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60] },
  { id: 'twinkle', title: 'כוכב קטן', notes: [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 67, 67, 65, 65, 64, 64, 62, 67, 67, 65, 65, 64, 64, 62] },
  { id: 'scale', title: 'סולם דו מז׳ור – עולה ויורד', notes: [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60] },
  { id: 'chords', title: 'שלישיות במהלך I–IV–V', notes: [60, 64, 67, 65, 69, 72, 67, 71, 74, 72, 67, 64, 60] },
];
