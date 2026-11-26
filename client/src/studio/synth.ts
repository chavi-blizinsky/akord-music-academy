/**
 * Polyphonic Web Audio synthesizer.
 * Signal chain: voices → master gain → (dry + convolution reverb) → analyser → speakers.
 * Each instrument is a recipe of oscillators, an ADSR envelope and an optional filter.
 */

export type InstrumentId = 'piano' | 'organ' | 'synth' | 'strings' | 'bells';

interface Partial { type: OscillatorType; ratio: number; gain: number; detune?: number }
interface Recipe { partials: Partial[]; attack: number; decay: number; sustain: number; release: number; filter?: number }

export const INSTRUMENTS: Record<InstrumentId, { label: string; recipe: Recipe }> = {
  piano: { label: 'פסנתר', recipe: { partials: [{ type: 'triangle', ratio: 1, gain: 0.6 }, { type: 'sine', ratio: 2, gain: 0.25 }, { type: 'sine', ratio: 3, gain: 0.1 }], attack: 0.005, decay: 0.9, sustain: 0.15, release: 0.5, filter: 4200 } },
  organ: { label: 'אורגן', recipe: { partials: [{ type: 'sine', ratio: 0.5, gain: 0.35 }, { type: 'sine', ratio: 1, gain: 0.5 }, { type: 'sine', ratio: 2, gain: 0.3 }, { type: 'sine', ratio: 3, gain: 0.18 }, { type: 'sine', ratio: 4, gain: 0.12 }], attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.12 } },
  synth: { label: 'סינתיסייזר', recipe: { partials: [{ type: 'sawtooth', ratio: 1, gain: 0.35, detune: -7 }, { type: 'sawtooth', ratio: 1, gain: 0.35, detune: 7 }, { type: 'square', ratio: 0.5, gain: 0.15 }], attack: 0.03, decay: 0.3, sustain: 0.6, release: 0.35, filter: 2400 } },
  strings: { label: 'כלי קשת', recipe: { partials: [{ type: 'sawtooth', ratio: 1, gain: 0.3, detune: -5 }, { type: 'sawtooth', ratio: 1, gain: 0.3, detune: 5 }, { type: 'triangle', ratio: 2, gain: 0.12 }], attack: 0.35, decay: 0.2, sustain: 0.85, release: 0.8, filter: 3000 } },
  bells: { label: 'פעמונים', recipe: { partials: [{ type: 'sine', ratio: 1, gain: 0.5 }, { type: 'sine', ratio: 2.76, gain: 0.3 }, { type: 'sine', ratio: 5.4, gain: 0.15 }], attack: 0.002, decay: 1.8, sustain: 0, release: 1.2 } },
};

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface Voice { oscs: OscillatorNode[]; env: GainNode }

export class Synth {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private master: GainNode;
  private wet: GainNode;
  private voices = new Map<number, Voice>();
  instrument: InstrumentId = 'piano';

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    const reverb = this.ctx.createConvolver();
    reverb.buffer = this.impulse(2.2, 2.5);
    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.22;

    this.master.connect(this.analyser);
    this.master.connect(reverb).connect(this.wet).connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  set volume(v: number) { this.master.gain.value = v; }
  set reverb(v: number) { this.wet.gain.value = v; }

  /** Synthetic room impulse: exponentially decaying stereo noise. */
  private impulse(seconds: number, decay: number) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  noteOn(midi: number, velocity = 0.9) {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.noteOff(midi, true);
    const { recipe } = INSTRUMENTS[this.instrument];
    const now = this.ctx.currentTime;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(velocity, now + recipe.attack);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity * recipe.sustain), now + recipe.attack + recipe.decay);

    let out: AudioNode = env;
    if (recipe.filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = recipe.filter;
      env.connect(f);
      out = f;
    }
    out.connect(this.master);

    const oscs = recipe.partials.map(p => {
      const o = this.ctx.createOscillator();
      o.type = p.type;
      o.frequency.value = midiToFreq(midi) * p.ratio;
      if (p.detune) o.detune.value = p.detune;
      const g = this.ctx.createGain();
      g.gain.value = p.gain;
      o.connect(g).connect(env);
      o.start(now);
      return o;
    });
    this.voices.set(midi, { oscs, env });
  }

  noteOff(midi: number, immediate = false) {
    const v = this.voices.get(midi);
    if (!v) return;
    this.voices.delete(midi);
    const now = this.ctx.currentTime;
    const release = immediate ? 0.01 : INSTRUMENTS[this.instrument].recipe.release;
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(Math.max(0.0001, v.env.gain.value), now);
    v.env.gain.exponentialRampToValueAtTime(0.0001, now + release);
    v.oscs.forEach(o => o.stop(now + release + 0.05));
  }

  /** Short percussive click for the metronome. */
  click(accent: boolean) {
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    o.connect(g).connect(this.ctx.destination);
    o.start(now);
    o.stop(now + 0.06);
  }
}
