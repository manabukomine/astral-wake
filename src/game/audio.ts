type BedName = "play" | "boss";

type Bed = {
  url: string;
  trim: number;
  buf: AudioBuffer | null;
  src: AudioBufferSourceNode | null;
  load: Promise<AudioBuffer | null> | null;
  failed: boolean;
  offset: number;
  startedAt: number;
};

function bed(url: string): Bed {
  return { url, trim: 0.42, buf: null, src: null, load: null, failed: false, offset: 0, startedAt: 0 };
}

type MusicMode = "off" | "title" | "play" | "boss";

const BASS = [
  73.42, 0, 0, 0, 73.42, 0, 110, 0, 87.31, 0, 0, 0, 87.31, 0, 98, 0, 73.42, 0, 0, 0, 73.42, 0, 130.81, 0,
  65.41, 0, 0, 0, 98, 0, 73.42, 0,
];
const LEAD = [
  0, 0, 440, 0, 523.25, 0, 440, 349.23, 0, 0, 392, 0, 440, 0, 349.23, 293.66, 0, 0, 440, 0, 587.33, 0, 523.25,
  440, 0, 0, 349.23, 392, 440, 0, 293.66, 0,
];

export class AudioBus {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicMode: MusicMode = "off";
  private musicWant: MusicMode = "off";
  private musicLevel = 0.8;
  private musicOn = false;
  private musicTimer = 0;
  private musicStep = 0;
  private musicNext = 0;
  private readonly beds: Record<BedName, Bed> = {
    play: bed("/audio/warning-lights.m4a"),
    boss: bed("/audio/warden.m4a"),
  };

  unlock(): void {
    const ctx = this.ensure();
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    void ready.then(() => {
      this.loadBed("play");
      this.loadBed("boss");
    });
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.haltMusic();
    else if (this.musicWant !== "off") this.setMusic(this.musicWant, this.musicLevel);
  }

  setMusic(mode: MusicMode, level?: number): void {
    this.musicWant = mode;
    if (level !== undefined) this.musicLevel = level;
    else this.musicLevel = mode === "title" ? 0.4 : mode === "boss" ? 1 : 0.82;
    if (this.muted || mode === "off") {
      this.musicMode = mode;
      if (mode === "off") this.haltMusic();
      return;
    }
    const ctx = this.ensure();
    const bus = this.musicGain;
    if (!bus) return;
    const prev = this.musicMode;
    this.musicMode = mode;
    bus.gain.setTargetAtTime(this.musicLevel, ctx.currentTime, 0.06);
    if (mode === "play") {
      if (prev === "title") this.beds.play.offset = 0;
      this.stopBed("boss", false);
      this.startBed("play");
    } else if (mode === "boss") {
      if (prev === "play" || prev === "title") this.beds.boss.offset = 0;
      this.stopBed("play", true);
      this.startBed("boss");
    } else {
      this.stopBed("play", false);
      this.stopBed("boss", false);
    }
    if (!this.musicOn) {
      this.musicOn = true;
      this.musicStep = 0;
      this.musicNext = ctx.currentTime + 0.05;
      this.pump();
    }
  }

  dispose(): void {
    this.haltMusic();
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    if (ctx) void ctx.close();
  }

  shoot(): void {
    const freq = 640 + Math.random() * 90;
    this.tone(freq, 0.045, "square", 0.045, 180);
    this.noise(0.03, 0.035, 1800);
  }

  tick(): void {
    this.tone(320 + Math.random() * 40, 0.03, "square", 0.03, -80);
  }

  slash(): void {
    this.tone(760 + Math.random() * 90, 0.045, "square", 0.028, 280);
    this.noise(0.04, 0.028, 2600);
  }

  boom(): void {
    this.tone(150, 0.2, "sawtooth", 0.07, -90);
    this.noise(0.16, 0.07, 220);
  }

  hurt(): void {
    this.tone(88, 0.28, "sawtooth", 0.09, -40);
    this.noise(0.18, 0.08, 120);
  }

  pickup(): void {
    this.tone(523, 0.07, "triangle", 0.06);
    this.tone(659, 0.09, "triangle", 0.055);
    this.tone(784, 0.13, "triangle", 0.05);
  }

  wave(): void {
    this.tone(392, 0.1, "triangle", 0.06);
    this.tone(523, 0.14, "triangle", 0.05);
    this.tone(784, 0.2, "triangle", 0.045);
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
      const music = ctx.createGain();
      music.gain.value = 0.0001;
      music.connect(master);
      this.ctx = ctx;
      this.master = master;
      this.musicGain = music;
    }
    return this.ctx;
  }

  private haltMusic(): void {
    this.musicOn = false;
    this.musicMode = "off";
    this.stopBed("play", true);
    this.stopBed("boss", true);
    window.clearTimeout(this.musicTimer);
    const ctx = this.ctx;
    const bus = this.musicGain;
    if (ctx && bus) bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
  }

  private loadBed(name: BedName): Promise<AudioBuffer | null> {
    const bed = this.beds[name];
    if (bed.buf) return Promise.resolve(bed.buf);
    if (bed.load) return bed.load;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    bed.load = fetch(bed.url)
      .then((res) => {
        if (!res.ok) throw new Error(name);
        return res.arrayBuffer();
      })
      .then((raw) => ctx.decodeAudioData(raw))
      .then((buf) => {
        bed.buf = buf;
        return buf;
      })
      .catch(() => {
        bed.failed = true;
        return null;
      });
    return bed.load;
  }

  private startBed(name: BedName): void {
    const bed = this.beds[name];
    if (bed.src || this.muted || this.musicMode !== name) return;
    void this.loadBed(name).then((buf) => {
      if (!buf || bed.src || this.muted || this.musicMode !== name || !this.ctx || !this.musicGain) return;
      const src = this.ctx.createBufferSource();
      const trim = this.ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      trim.gain.value = bed.trim;
      src.connect(trim);
      trim.connect(this.musicGain);
      const offset = buf.duration > 0 ? bed.offset % buf.duration : 0;
      src.start(0, offset);
      bed.src = src;
      bed.startedAt = this.ctx.currentTime;
    });
  }

  private stopBed(name: BedName, keep: boolean): void {
    const bed = this.beds[name];
    const src = bed.src;
    bed.src = null;
    if (src && this.ctx && bed.buf && bed.buf.duration > 0) {
      const elapsed = Math.max(0, this.ctx.currentTime - bed.startedAt);
      bed.offset = keep ? (bed.offset + elapsed) % bed.buf.duration : 0;
    } else if (!keep) {
      bed.offset = 0;
    }
    if (!src) return;
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    try {
      src.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  private pump = (): void => {
    if (!this.musicOn || !this.ctx) return;
    const ctx = this.ctx;
    if (this.musicNext < ctx.currentTime - 0.08) this.musicNext = ctx.currentTime + 0.04;
    const horizon = ctx.currentTime + 0.16;
    let guard = 0;
    while (this.musicNext < horizon && guard < 8) {
      const filed = this.musicMode === "play" || this.musicMode === "boss" ? this.beds[this.musicMode] : null;
      const owns = filed !== null && !filed.failed;
      if (!this.muted && this.musicMode !== "off" && !owns) this.emitStep(this.musicStep, this.musicNext);
      this.musicStep = (this.musicStep + 1) % 32;
      this.musicNext += this.stepDur();
      guard += 1;
    }
    this.musicTimer = window.setTimeout(this.pump, 40);
  };

  private stepDur(): number {
    const bpm = this.musicMode === "boss" ? 156 : this.musicMode === "title" ? 96 : 128;
    return 60 / bpm / 2;
  }

  private emitStep(step: number, when: number): void {
    const bass = BASS[step] ?? 0;
    const lead = LEAD[step] ?? 0;
    const title = this.musicMode === "title";
    if (bass > 0 && (!title || step % 16 < 8)) this.musicTone(bass, 0.16, "square", title ? 0.045 : 0.07, 0, when);
    if (lead > 0 && !title) {
      this.musicTone(lead, 0.12, "triangle", 0.05, 0, when);
      if (this.musicMode === "boss") this.musicTone(lead * 1.5, 0.1, "square", 0.016, 0, when);
    } else if (title && (step === 4 || step === 20)) {
      this.musicTone(440, 0.2, "triangle", 0.03, 0, when);
    }
    if (!title && step % 8 === 0) this.musicTone(120, 0.08, "sine", 0.07, -70, when);
    if (!title && step % 2 === 1) this.musicNoise(0.03, 0.012, 4800, when);
  }

  private musicTone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slide: number,
    when: number,
  ): void {
    this.tone(freq, dur, type, vol, slide, this.musicGain, when);
  }

  private musicNoise(dur: number, vol: number, hp: number, when: number): void {
    this.noise(dur, vol, hp, this.musicGain, when);
  }

  private noiseBuffer(): AudioBuffer {
    const ctx = this.ensure();
    if (!this.noiseBuf) {
      const n = Math.floor(ctx.sampleRate * 0.35);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slide = 0,
    dest: GainNode | null = null,
    when = 0,
  ): void {
    if (this.muted || !this.ctx || !this.master) return;
    const out = dest ?? this.master;
    try {
      const ctx = this.ctx;
      const t = when > 0 ? when : ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freq), t);
      if (slide !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      }
      gain.gain.setValueAtTime(Math.max(0.0001, vol), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      /* best-effort */
    }
  }

  private noise(dur: number, vol: number, hp: number, dest: GainNode | null = null, when = 0): void {
    if (this.muted || !this.ctx || !this.master) return;
    const out = dest ?? this.master;
    try {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = hp;
      const gain = ctx.createGain();
      const t = when > 0 ? when : ctx.currentTime;
      gain.gain.setValueAtTime(Math.max(0.0001, vol), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch {
      /* best-effort */
    }
  }
}
