import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Circle, Download, GraduationCap, Music, Pause, Play, Piano, Square, Timer, Usb } from 'lucide-react';
import { PageHeader, Card, Badge } from '../components/ui';
import { INSTRUMENTS, Synth, type InstrumentId } from '../studio/synth';
import { detectChord, isBlack, NOTE_NAMES_HE, noteName, SONGS, toMidiFile, type RecordedNote } from '../studio/theory';

// Same physical layout as the original Akord organ: bottom row = white keys, home row = black keys.
const WHITE_CODES = ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'];
const BLACK_CODES: Record<number, string> = { 1: 'KeyA', 2: 'KeyS', 4: 'KeyF', 5: 'KeyG', 6: 'KeyH', 8: 'KeyK', 9: 'KeyL', 11: 'Quote', 12: 'Enter' };
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];

export default function Studio() {
  const synthRef = useRef<Synth | null>(null);
  const synth = () => (synthRef.current ??= new Synth());

  const [octave, setOctave] = useState(4);
  const [instrument, setInstrument] = useState<InstrumentId>('piano');
  const [volume, setVolume] = useState(0.35);
  const [reverb, setReverb] = useState(0.22);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [showNames, setShowNames] = useState(true);
  const [sustain, setSustain] = useState(false);
  const sustained = useRef<Set<number>>(new Set());

  // Recording
  const [recording, setRecording] = useState(false);
  const [take, setTake] = useState<RecordedNote[]>([]);
  const recStart = useRef(0);
  const openNotes = useRef(new Map<number, number>());
  const [playing, setPlaying] = useState(false);

  // Metronome
  const [bpm, setBpm] = useState(96);
  const [metro, setMetro] = useState(false);
  const [beat, setBeat] = useState(0);

  // Learn mode
  const [songId, setSongId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const song = SONGS.find(s => s.id === songId);
  const target = song ? song.notes[step] : undefined;

  const [midiStatus, setMidiStatus] = useState<string>('');

  const keys = useMemo(() => {
    const base = (octave + 1) * 12;
    const whites: number[] = [];
    for (let o = 0; o < 2; o++) for (const s of WHITE_STEPS) whites.push(base + o * 12 + s);
    const blacks: { midi: number; pos: number }[] = [];
    whites.forEach((m, i) => { if (i > 0 && isBlack(m - 1)) blacks.push({ midi: m - 1, pos: i }); });
    return { whites, blacks };
  }, [octave]);

  const press = useCallback((midi: number, velocity = 0.9) => {
    synth().noteOn(midi, velocity);
    setHeld(h => new Set(h).add(midi));
    if (recording) openNotes.current.set(midi, performance.now() - recStart.current);
    if (song && target !== undefined) {
      if (midi === target) {
        if (step + 1 >= song.notes.length) { setStep(song.notes.length); } else setStep(s => s + 1);
      } else setMistakes(m => m + 1);
    }
  }, [recording, song, target, step]);

  const release = useCallback((midi: number) => {
    if (sustain) sustained.current.add(midi);
    else synth().noteOff(midi);
    setHeld(h => { const n = new Set(h); n.delete(midi); return n; });
    const start = openNotes.current.get(midi);
    if (recording && start !== undefined) {
      openNotes.current.delete(midi);
      setTake(t => [...t, { midi, start, duration: performance.now() - recStart.current - start }]);
    }
  }, [recording, sustain]);

  // Computer keyboard
  useEffect(() => {
    const codeToMidi = (code: string) => {
      const wi = WHITE_CODES.indexOf(code);
      if (wi >= 0 && wi < keys.whites.length) return keys.whites[wi];
      const b = Object.entries(BLACK_CODES).find(([, c]) => c === code);
      if (b) return keys.blacks.find(x => x.pos === Number(b[0]))?.midi;
      return undefined;
    };
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || e.repeat) return;
      if (e.code === 'Space') { e.preventDefault(); setSustain(true); return; }
      if (e.code === 'ArrowLeft') { setOctave(o => Math.min(6, o + 1)); return; }
      if (e.code === 'ArrowRight') { setOctave(o => Math.max(1, o - 1)); return; }
      const m = codeToMidi(e.code);
      if (m !== undefined) { e.preventDefault(); press(m); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSustain(false);
        sustained.current.forEach(m => synth().noteOff(m));
        sustained.current.clear();
        return;
      }
      const m = codeToMidi(e.code);
      if (m !== undefined) release(m);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [keys, press, release]);

  useEffect(() => { if (synthRef.current) synthRef.current.instrument = instrument; }, [instrument]);
  useEffect(() => { if (synthRef.current) synthRef.current.volume = volume; }, [volume]);
  useEffect(() => { if (synthRef.current) synthRef.current.reverb = reverb; }, [reverb]);

  // Metronome clock
  useEffect(() => {
    if (!metro) return;
    let n = 0;
    const id = window.setInterval(() => { synth().click(n % 4 === 0); setBeat(n % 4); n++; }, 60000 / bpm);
    return () => window.clearInterval(id);
  }, [metro, bpm]);

  // Web MIDI – plug in a real keyboard and it just works.
  const connectMidi = async () => {
    if (!('requestMIDIAccess' in navigator)) { setMidiStatus('הדפדפן לא תומך ב-Web MIDI (נסו Chrome)'); return; }
    try {
      const access = await (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> }).requestMIDIAccess();
      const inputs = [...access.inputs.values()];
      inputs.forEach(input => {
        input.onmidimessage = (msg: MIDIMessageEvent) => {
          const [status, note, vel] = msg.data ?? [];
          if ((status & 0xf0) === 0x90 && vel > 0) press(note, vel / 127);
          else if ((status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && vel === 0)) release(note);
        };
      });
      setMidiStatus(inputs.length ? `מחובר: ${inputs.map(i => i.name).join(', ')}` : 'לא נמצאה מקלדת MIDI מחוברת');
    } catch { setMidiStatus('הגישה ל-MIDI נדחתה'); }
  };

  // Oscilloscope
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current, s = synthRef.current;
      if (!c || !s) return;
      const g = c.getContext('2d')!;
      const buf = new Uint8Array(s.analyser.fftSize);
      s.analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, c.width, c.height);
      const grad = g.createLinearGradient(0, 0, c.width, 0);
      grad.addColorStop(0, '#8b5cf6'); grad.addColorStop(1, '#f59e0b');
      g.strokeStyle = grad; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < buf.length; i += 4) {
        const x = (i / buf.length) * c.width, y = (buf[i] / 255) * c.height;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const startRecording = () => { setTake([]); openNotes.current.clear(); recStart.current = performance.now(); setRecording(true); };
  const playTake = () => {
    if (!take.length) return;
    setPlaying(true);
    take.forEach(n => {
      window.setTimeout(() => { synth().noteOn(n.midi, 0.8); setHeld(h => new Set(h).add(n.midi)); }, n.start);
      window.setTimeout(() => { synth().noteOff(n.midi); setHeld(h => { const x = new Set(h); x.delete(n.midi); return x; }); }, n.start + n.duration);
    });
    const end = Math.max(...take.map(n => n.start + n.duration));
    window.setTimeout(() => setPlaying(false), end + 200);
  };
  const downloadMidi = () => {
    const url = URL.createObjectURL(toMidiFile(take, bpm));
    const a = document.createElement('a');
    a.href = url; a.download = 'akord-recording.mid'; a.click();
    URL.revokeObjectURL(url);
  };

  const chord = detectChord([...held]);
  const done = song && step >= song.notes.length;
  const accuracy = song && step ? Math.round((step / (step + mistakes)) * 100) : 100;
  const whiteW = 100 / keys.whites.length;

  const label = (m: number) => (showNames ? NOTE_NAMES_HE[m % 12] : '');
  const hint = (code?: string) => code?.replace('Key', '').replace('Shift', '⇧').replace('Left', '').replace('Right', '').replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('Quote', "'").replace('Enter', '↵');

  return (
    <>
      <PageHeader title="הסטודיו" subtitle="אורגנית מלאה: 5 כלים, הקלטה, ייצוא MIDI, מטרונום, מצב לימוד וחיבור מקלדת MIDI אמיתית" icon={<Piano />} />

      <div className="grid xl:grid-cols-4 gap-4 mb-4">
        <Card className="xl:col-span-3">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {(Object.keys(INSTRUMENTS) as InstrumentId[]).map(id => (
              <button key={id} onClick={() => setInstrument(id)} className={clsx('btn', instrument === id ? 'bg-brand-600 text-white shadow-glow' : 'bg-slate-100 dark:bg-slate-800')}>{INSTRUMENTS[id].label}</button>
            ))}
            <div className="ms-auto flex items-center gap-2 text-sm">
              <button className="btn-ghost px-3" onClick={() => setOctave(o => Math.max(1, o - 1))}>−</button>
              <span>אוקטבה {octave}</span>
              <button className="btn-ghost px-3" onClick={() => setOctave(o => Math.min(6, o + 1))}>+</button>
            </div>
          </div>

          <div className="relative rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 p-4 pt-10 shadow-2xl" dir="ltr">
            <div className="absolute top-2 left-4 right-4 flex justify-between text-xs text-slate-300">
              <span className="font-semibold tracking-widest">AKORD · STAGE 88</span>
              <span className="text-gold-400 text-sm font-bold min-h-5">{chord ? `${chord.symbol} · ${chord.label}` : held.size ? [...held].map(noteName).join(' ') : ''}</span>
              <span className={clsx(sustain && 'text-gold-400')}>SUSTAIN {sustain ? '●' : '○'}</span>
            </div>
            <div className="relative h-56 select-none">
              {keys.whites.map((m, i) => (
                <button key={m}
                  onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); press(m); }}
                  onPointerUp={() => release(m)} onPointerLeave={() => held.has(m) && release(m)}
                  className={clsx('key-white absolute top-0 bottom-0 rounded-b-lg border border-slate-300 flex flex-col justify-end items-center pb-2 text-[11px] text-slate-500', held.has(m) && 'down', target === m && 'key-hint')}
                  style={{ left: `${i * whiteW}%`, width: `${whiteW}%` }}>
                  <span className="font-semibold">{label(m)}</span>
                  <span className="opacity-60">{hint(WHITE_CODES[i])}</span>
                </button>
              ))}
              {keys.blacks.map(({ midi, pos }) => (
                <button key={midi}
                  onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); press(midi); }}
                  onPointerUp={() => release(midi)}
                  className={clsx('key-black absolute top-0 h-[60%] rounded-b-md z-10 flex flex-col justify-end items-center pb-1 text-[10px] text-slate-300', held.has(midi) && 'down', target === midi && 'key-hint')}
                  style={{ left: `${pos * whiteW - whiteW * 0.3}%`, width: `${whiteW * 0.6}%` }}>
                  <span className="opacity-70">{hint(BLACK_CODES[pos])}</span>
                </button>
              ))}
            </div>
          </div>

          <canvas ref={canvasRef} width={1200} height={90} className="w-full h-20 mt-4 rounded-xl bg-slate-950" />

          <div className="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
            <label className="flex items-center gap-3">עוצמה <input type="range" min={0} max={0.8} step={0.01} value={volume} onChange={e => setVolume(+e.target.value)} className="flex-1 accent-brand-600" /></label>
            <label className="flex items-center gap-3">הדהוד <input type="range" min={0} max={0.8} step={0.01} value={reverb} onChange={e => setReverb(+e.target.value)} className="flex-1 accent-brand-600" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showNames} onChange={e => setShowNames(e.target.checked)} className="accent-brand-600" /> שמות התווים (דו-רה-מי)</label>
          </div>
          <p className="text-xs text-slate-400 mt-3">נגינה מהמקלדת: שורה תחתונה = קלידים לבנים, שורה אמצעית = שחורים · רווח = פדל · חיצים = שינוי אוקטבה</p>
        </Card>

        <div className="space-y-4">
          <Card title="הקלטה">
            <div className="flex flex-wrap gap-2">
              {!recording
                ? <button className="btn bg-red-600 text-white" onClick={startRecording}><Circle size={14} fill="white" /> הקלטה</button>
                : <button className="btn bg-slate-800 text-white" onClick={() => setRecording(false)}><Square size={14} /> עצירה</button>}
              <button className="btn-ghost" onClick={playTake} disabled={!take.length || playing || recording}>{playing ? <Pause size={14} /> : <Play size={14} />} השמעה</button>
              <button className="btn-ghost" onClick={downloadMidi} disabled={!take.length || recording}><Download size={14} /> MIDI</button>
            </div>
            <p className="text-xs text-slate-500 mt-2">{recording ? '● מקליט…' : take.length ? `${take.length} תווים הוקלטו` : 'ההקלטה נשמרת כקובץ MIDI שנפתח בכל תוכנת מוזיקה'}</p>
          </Card>

          <Card title="מטרונום">
            <div className="flex items-center gap-3">
              <button className={clsx('btn', metro ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800')} onClick={() => setMetro(m => !m)}><Timer size={14} /> {metro ? 'עצירה' : 'הפעלה'}</button>
              <input type="number" min={40} max={220} value={bpm} onChange={e => setBpm(Math.min(220, Math.max(40, +e.target.value)))} className="input w-20" />
              <span className="text-sm">BPM</span>
            </div>
            <div className="flex gap-2 mt-3">{[0, 1, 2, 3].map(i => <div key={i} className={clsx('h-3 flex-1 rounded-full transition', metro && beat === i ? (i === 0 ? 'bg-gold-500' : 'bg-brand-500') : 'bg-slate-200 dark:bg-slate-800')} />)}</div>
          </Card>

          <Card title="מקלדת MIDI">
            <button className="btn-ghost w-full justify-center" onClick={connectMidi}><Usb size={14} /> חיבור מקלדת אמיתית</button>
            {midiStatus && <p className="text-xs text-slate-500 mt-2">{midiStatus}</p>}
          </Card>
        </div>
      </div>

      <Card title="מצב לימוד – הקלידים מאירים לפי השיר" actions={song && <Badge tone={done ? 'green' : 'brand'}>{done ? `סיימת! דיוק ${accuracy}%` : `${step}/${song.notes.length} · דיוק ${accuracy}%`}</Badge>}>
        <div className="flex flex-wrap gap-2">
          {SONGS.map(s => (
            <button key={s.id} className={clsx('btn', songId === s.id ? 'bg-gold-500 text-white' : 'bg-slate-100 dark:bg-slate-800')} onClick={() => { setSongId(s.id); setStep(0); setMistakes(0); setOctave(4); }}>
              <GraduationCap size={14} /> {s.title}
            </button>
          ))}
          {song && <button className="btn-ghost" onClick={() => { setSongId(null); setStep(0); }}><Music size={14} /> נגינה חופשית</button>}
        </div>
        {song && !done && <p className="text-sm text-slate-500 mt-3">התו הבא: <b className="text-gold-500">{NOTE_NAMES_HE[target! % 12]}</b> – לחצו על הקליד המואר</p>}
      </Card>
    </>
  );
}
