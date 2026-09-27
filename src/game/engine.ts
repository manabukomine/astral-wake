import { AudioBus } from "@/game/audio";
import {
  loadScores,
  loadSettings,
  qualifies,
  saveName,
  saveScore,
  saveSettings,
  type ScoreRow,
} from "@/game/storage";

export type Phase = "title" | "playing" | "paused" | "name" | "over" | "scores";
export type ScoresFrom = "title" | "paused" | "over";

export type Snapshot = {
  phase: Phase;
  score: number;
  best: number;
  lives: number;
  wave: number;
  combo: number;
  multi: number;
  shots: number;
  multiT: number;
  shieldT: number;
  shieldCharges: number;
  speedT: number;
  blades: number;
  bombs: number;
  reflect: boolean;
  boss: number;
  finalScore: number;
  finalWave: number;
  rank: number;
  rows: ScoreRow[];
  highlightAt: number;
  muted: boolean;
  shake: boolean;
  hint: boolean;
  scoresFrom: ScoresFrom;
};

export const INITIAL_SNAPSHOT: Snapshot = {
  phase: "title",
  score: 0,
  best: 0,
  lives: 3,
  wave: 1,
  combo: 0,
  multi: 1,
  shots: 1,
  multiT: 0,
  shieldT: 0,
  shieldCharges: 0,
  speedT: 0,
  blades: 0,
  bombs: 0,
  reflect: false,
  boss: -1,
  finalScore: 0,
  finalWave: 1,
  rank: 0,
  rows: [],
  highlightAt: 0,
  muted: false,
  shake: true,
  hint: true,
  scoresFrom: "title",
};

const PAL = {
  bg: "#070b14",
  hull: "#101826",
  fg: "#e7f0ff",
  muted: "#8b9bb4",
  cyan: "#2ad4f0",
  amber: "#f0a202",
  amberHot: "#ffd27a",
};

const STEP = 1 / 60;
const HIT_R = 9;
const SPREADS: readonly (readonly number[])[] = [
  [0],
  [-0.16, 0, 0.16],
  [-0.28, -0.14, 0, 0.14, 0.28],
];

type Kind = "scout" | "dart" | "turret" | "chunk" | "mine" | "warden" | "heart" | "arm" | "lancer" | "split" | "trine" | "mote" | "dread";
type PickupKind = "multi" | "shield" | "speed" | "blade" | "bomb" | "reflect";

type Enemy = {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  r: number;
  hp: number;
  maxHp: number;
  age: number;
  flash: number;
  shot: number;
  spin: number;
  amp: number;
  freq: number;
  slotY: number;
  pat: number;
  patT: number;
  ang: number;
  burst: number;
  cut: number;
  wind: number;
  tell: number;
  aim: number;
  vol: number;
  gap: number;
  spd: number;
};

type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  friendly: boolean;
  grazed: boolean;
  life: number;
  dmg: number;
};

type Pickup = {
  alive: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  life: number;
};

type Sever = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  life: number;
  max: number;
  r: number;
  kind: Kind;
  side: number;
};

type PlateBit = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  life: number;
  max: number;
  w: number;
};

function blankPlate(): PlateBit {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0, life: 0, max: 0.7, w: 28 };
}

function blankSever(): Sever {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    life: 0,
    max: 0.5,
    r: 12,
    kind: "scout",
    side: 1,
  };
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len = abx * abx + aby * aby;
  if (len < 1) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len, 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

type Particle = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  hot: boolean;
};

type Floater = {
  alive: boolean;
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
};

type BladeMode = "home" | "out";

type BladeUnit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: BladeMode;
  target: number;
  outT: number;
  cuts: number;
  rot: number;
  ox: number;
  oy: number;
  fx: number;
  fy: number;
  sx: number;
  sy: number;
  far: number;
  wide: number;
  u: number;
  dur: number;
  trail: number;
  tx: number[];
  ty: number[];
};

function blankBlade(): BladeUnit {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    mode: "home",
    target: -1,
    outT: 0,
    cuts: 0,
    rot: -Math.PI / 2,
    ox: 0,
    oy: 0,
    fx: 0,
    fy: -1,
    sx: 1,
    sy: 0,
    far: 160,
    wide: 90,
    u: 0,
    dur: 0.8,
    trail: 0,
    tx: Array.from({ length: 48 }, () => 0),
    ty: Array.from({ length: 48 }, () => 0),
  };
}

type Flash = {
  alive: boolean;
  x: number;
  y: number;
  life: number;
  max: number;
  rot: number;
};

type Star = {
  x: number;
  y: number;
  r: number;
  a: number;
  sp: number;
  layer: number;
  tw: number;
};

type Spawn = { kind: Kind; t: number; x: number; done: boolean };

const SCORE: Record<Kind, number> = {
  scout: 100,
  dart: 150,
  turret: 220,
  chunk: 180,
  mine: 160,
  warden: 2500,
  heart: 2500,
  arm: 140,
  lancer: 2500,
  split: 2500,
  trine: 900,
  mote: 2500,
  dread: 5000,
};

const DROP: Record<Kind, number> = {
  scout: 0.16,
  dart: 0.22,
  turret: 0.48,
  chunk: 0.55,
  mine: 0.28,
  warden: 0,
  heart: 0,
  arm: 0.2,
  lancer: 0,
  split: 0,
  trine: 0,
  mote: 0,
  dread: 0,
};

export function shotCount(level: number): number {
  if (level <= 1) return 1;
  if (level === 2) return 3;
  return 5;
}

export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return 1 + (combo - 1) * 0.12;
}

function pickupGlyph(kind: PickupKind): string {
  if (kind === "multi") return "M";
  if (kind === "shield") return "H";
  if (kind === "speed") return "V";
  if (kind === "bomb") return "X";
  if (kind === "reflect") return "R";
  return "B";
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function bossForm(wave: number): "warden" | "heart" | "lancer" | "split" | "trine" | "mote" | "dread" {
  const n = (Math.floor(wave / 5) - 1) % 7;
  if (n === 1) return "heart";
  if (n === 2) return "lancer";
  if (n === 3) return "split";
  if (n === 4) return "trine";
  if (n === 5) return "mote";
  if (n === 6) return "dread";
  return "warden";
}

export function bossTitle(form: ReturnType<typeof bossForm>): string {
  if (form === "heart") return "TENDRIL";
  if (form === "lancer") return "LANCER";
  if (form === "split") return "SPLIT";
  if (form === "trine") return "TRINE";
  if (form === "mote") return "MOTE";
  if (form === "dread") return "DREAD";
  return "WARDEN";
}

function bannerLine(name: string): string {
  if (name === "TENDRIL") return "腕を断て。核は残る";
  if (name === "LANCER") return "突進のあと、腹を切れ";
  if (name === "SPLIT") return "分かれて、また重なる";
  if (name === "TRINE") return "降りた一隻を切れ";
  if (name === "MOTE") return "隙間に入り、降りた核を切れ";
  if (name === "DREAD") return "航路を塞ぐ最終艦";
  if (name === "WARDEN") return "航路を塞ぐ哨戒艦";
  return "敵影接近";
}

function bossBody(kind: Kind): boolean {
  return kind === "warden" || kind === "heart" || kind === "lancer" || kind === "split" || kind === "trine" || kind === "mote" || kind === "dread";
}

function specsForWave(wave: number): Spawn[] {
  const out: Spawn[] = [];
  const push = (kind: Kind, t: number, x: number) => out.push({ kind, t, x, done: false });

  if (wave % 5 === 0) {
    const form = bossForm(wave);
    if (form === "trine") {
      push("trine", 0.45, 0.22);
      push("trine", 0.65, 0.5);
      push("trine", 0.85, 0.78);
      return out;
    }
    push(form, 0.7, 0.5);
    if (form === "mote" || form === "dread") return out;
    if (form === "heart" || form === "split") {
      push("scout", 2.4, 0.18);
      push("scout", 3.1, 0.82);
      return out;
    }
      const n = 4 + Math.min(2, Math.floor(wave / 5));
      for (let i = 0; i < n; i++) {
        push(i % 2 === 0 ? "dart" : "scout", 2.2 + i * 0.7, 0.16 + (i % 4) * 0.2);
      }
      for (const at of [16, 32]) {
        for (let i = 0; i < 3; i++) {
          push(i === 1 ? "scout" : "dart", at + i * 0.6, 0.22 + i * 0.28);
        }
      }
    return out;
  }

  if (wave === 1) {
    [0.5, 0.36, 0.64, 0.24, 0.76, 0.14, 0.86, 0.5].forEach((x, i) => push("scout", 0.4 + i * 0.32, x));
    [0.42, 0.58, 0.3, 0.7].forEach((x, i) => push("scout", 3.4 + i * 0.28, x));
    [0.22, 0.78, 0.4, 0.6, 0.3, 0.7, 0.5, 0.48].forEach((x, i) => push("scout", 5.6 + i * 0.34, x));
    return out;
  }
  if (wave === 2) {
    for (let i = 0; i < 7; i++) push("scout", 0.35 + i * 0.32, 0.12 + (i % 5) * 0.17);
    for (let i = 0; i < 4; i++) push("dart", 2.4 + i * 0.42, 0.18 + i * 0.2);
    for (let i = 0; i < 6; i++) push("scout", 5.8 + i * 0.34, 0.16 + (i % 4) * 0.2);
    for (let i = 0; i < 5; i++) push("dart", 8.4 + i * 0.4, 0.74 - (i % 4) * 0.16);
    return out;
  }
  if (wave === 3) {
    push("turret", 0.35, 0.26);
    push("turret", 0.6, 0.74);
    for (let i = 0; i < 7; i++) push("scout", 1.4 + i * 0.32, 0.12 + ((i * 0.31) % 0.76));
    for (let i = 0; i < 3; i++) push("dart", 3.8 + i * 0.36, 0.2 + i * 0.28);
    push("turret", 6.2, 0.5);
    for (let i = 0; i < 7; i++) push("scout", 6.8 + i * 0.32, 0.14 + ((i * 0.23) % 0.7));
    return out;
  }
  if (wave === 4) {
    for (let i = 0; i < 3; i++) push("chunk", 0.35 + i * 0.75, 0.2 + i * 0.28);
    for (let i = 0; i < 5; i++) push("dart", 1.2 + i * 0.38, 0.12 + ((i * 0.17) % 0.74));
    push("turret", 3.4, 0.5);
    for (let i = 0; i < 4; i++) push("scout", 4.4 + i * 0.32, 0.18 + i * 0.18);
    for (let i = 0; i < 3; i++) push("chunk", 6.6 + i * 0.85, 0.28 + i * 0.22);
    for (let i = 0; i < 4; i++) push("dart", 7.4 + i * 0.36, 0.16 + i * 0.18);
    push("turret", 9.6, 0.22);
    return out;
  }

  const count = 14 + Math.floor(wave * 1.2);
  const gap = Math.max(0.42, 0.68 - wave * 0.008);
  const cycle: Kind[] = ["scout", "dart", "mine", "turret", "scout", "chunk", "dart"];
  for (let i = 0; i < count; i++) {
    push(cycle[i % cycle.length], 0.4 + i * gap, 0.12 + ((i * 0.618) % 0.76));
  }
  return out;
}

function blankEnemy(): Enemy {
  return {
    alive: false,
    kind: "scout",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    baseX: 0,
    r: 14,
    hp: 1,
    maxHp: 1,
    age: 0,
    flash: 0,
    shot: 1,
    spin: 0,
    amp: 20,
    freq: 1.5,
    slotY: 120,
    pat: 0,
    patT: 0.8,
    ang: 0,
    burst: 8,
    cut: 0,
    wind: 0,
    tell: 0,
    aim: 0,
    vol: 1,
    gap: 0,
    spd: 200,
  };
}

function blankBullet(): Bullet {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 3, friendly: false, grazed: false, life: 0, dmg: 1 };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      getPhase: () => string;
      setKeys?: (codes: string[]) => void;
      setPointer: (x: number, y: number) => void;
    };
  }
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio = new AudioBus();
  private readonly onSnap: (snap: Snapshot) => void;

  private raf = 0;
  private ro: ResizeObserver | null = null;
  private mq: MediaQueryList | null = null;
  private lastTs = 0;
  private wall = 0;
  private acc = 0;
  private w = 0;
  private h = 0;
  private dead = false;
  private pendingStart = false;
  private pendingWave = 1;
  private reduceMotion = false;

  private phase: Phase = "title";
  private scoresFrom: ScoresFrom = "title";
  private keys = new Set<string>();
  private pointerFollow = false;
  private pointerX = 0;
  private pointerY = 0;
  /** Finger drag. Negative keys are touch identifiers; non-negative are pointer ids. */
  private dragKey: number | null = null;
  private gestureSeq = 0;
  private touchClaimedSeq = -1;
  private pendingDrag: { seq: number; id: number; x: number; y: number; cx: number; cy: number } | null = null;
  private touchActive = false;
  private touchOriginX = 0;
  private touchOriginY = 0;
  private touchShipX = 0;
  private touchShipY = 0;
  private touchX = 0;
  private touchY = 0;
  private safe = { l: 0, r: 0, b: 0 };

  private player = { x: 0, y: 0, vx: 0, vy: 0, invuln: 0 };
  private score = 0;
  private storedBest = 0;
  private lives = 3;
  private wave = 1;
  private wardCrack = 0;
  private armWait = [0, 0, 0];
  private combo = 0;
  private lastKill = -10;
  private time = 0;
  private multi = 1;
  private multiT = 0;
  private shieldT = 0;
  private shieldCharges = 0;
  private speedT = 0;
  private blades = 0;
  private bombs = 0;
  private reflect = false;
  private bombFlash = 0;
  private readonly blade: [BladeUnit, BladeUnit] = [blankBlade(), blankBlade()];
  private slashCd = 0;
  private lastGraze = -1;
  private throwSpin = 1;
  private fireCd = 0;
  private recoil = 0;
  private downed = 0;
  private hint = true;
  private waveTime = 0;
  private clearWait = 1.2;
  private spawns: Spawn[] = [];
  private banner = "";
  private bannerT = 0;
  private bannerMax = 1.6;
  private hitStop = 0;
  private trauma = 0;
  private hurtFlash = 0;
  private shakeOn = true;
  private boomed = false;
  private finalScore = 0;
  private finalWave = 1;
  private rank = 0;
  private highlightAt = 0;
  private rows: ScoreRow[] = [];
  private lastEmit = 0;
  private lastKey = "";

  private readonly enemies: Enemy[] = Array.from({ length: 48 }, blankEnemy);
  private readonly bullets: Bullet[] = Array.from({ length: 240 }, blankBullet);
  private readonly pickups: Pickup[] = Array.from({ length: 12 }, () => ({
    alive: false,
    kind: "multi" as PickupKind,
    x: 0,
    y: 0,
    life: 0,
  }));
  private readonly particles: Particle[] = Array.from({ length: 320 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 2,
    color: PAL.cyan,
    hot: false,
  }));
  private readonly severs: Sever[] = Array.from({ length: 28 }, () => blankSever());
  private readonly plates: PlateBit[] = Array.from({ length: 12 }, () => blankPlate());
  private readonly floaters: Floater[] = Array.from({ length: 24 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    text: "",
    life: 0,
    max: 1,
  }));
  private readonly flashes: Flash[] = Array.from({ length: 16 }, () => ({
    alive: false,
    x: 0,
    y: 0,
    life: 0,
    max: 0.05,
    rot: 0,
  }));
  private stars: Star[] = [];
  private nebula: HTMLCanvasElement | null = null;
  private nebulaY = 0;
  private vignette: CanvasGradient | null = null;
  private pCursor = 0;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code.startsWith("Arrow")) {
      if (this.phase === "playing" || this.phase === "paused") e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.phase === "playing") this.pause();
      else if (this.phase === "paused") this.resume();
      else if (this.phase === "scores") this.backFromScores();
    } else if (e.code === "Enter" && this.phase === "title") {
      e.preventDefault();
      this.start();
    } else if (e.code === "Space" && this.phase === "playing") {
      this.useBomb();
    } else if (e.code === "KeyM" && (this.phase === "playing" || this.phase === "paused")) {
      this.toggleMute();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private readonly onBlur = () => {
    this.keys.clear();
    this.pointerFollow = false;
    this.clearDrag();
  };

  private readonly onVis = () => {
    if (document.hidden) {
      this.keys.clear();
      this.pointerFollow = false;
      this.clearDrag();
      if (this.phase === "playing") this.pause();
    } else {
      this.audio.resume();
    }
  };

  private readonly onMotion = (e: MediaQueryListEvent) => {
    this.reduceMotion = e.matches;
  };

  private readonly onViewport = () => {
    this.resize();
  };

  /** iOS steals a moving finger for scroll unless touchmove is cancelled. */
  private readonly onTouchStart = (e: TouchEvent) => {
    if (this.phase !== "playing") return;
    const target = e.target;
    if (!(target instanceof Node) || !this.canvas.contains(target)) return;
    e.preventDefault();
    this.touchClaimedSeq = this.gestureSeq;
    this.pendingDrag = null;
    if (this.dragKey !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const p = this.localPoint(t.clientX, t.clientY);
    this.beginDrag(p.x, p.y, -(t.identifier + 1));
  };

  private readonly onTouchMove = (e: TouchEvent) => {
    const onCanvas = e.target instanceof Node && this.canvas.contains(e.target);
    if (this.phase === "playing" && (this.dragKey !== null || onCanvas)) e.preventDefault();
    if (this.dragKey === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (!t || this.dragKey !== -(t.identifier + 1)) continue;
      const p = this.localPoint(t.clientX, t.clientY);
      this.touchX = p.x;
      this.touchY = p.y;
    }
  };

  private readonly onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t) this.endDrag(-(t.identifier + 1));
    }
  };

  /** Pinch-zoom. WebKit-only; ignored where the event does not exist. */
  private readonly onGesture = (e: Event) => {
    e.preventDefault();
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    if (this.phase !== "playing") return;
    if (e.pointerType === "mouse") return;
    const seq = ++this.gestureSeq;
    const p = this.localPoint(e.clientX, e.clientY);
    this.pendingDrag = { seq, id: e.pointerId, x: p.x, y: p.y, cx: p.x, cy: p.y };
    requestAnimationFrame(() => this.flushPending(seq));
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      if (this.phase !== "playing") return;
      if (e.target !== this.canvas) return;
      this.pointerFollow = true;
      this.readPointer(e);
      return;
    }
    if (this.dragKey !== e.pointerId) {
      if (this.pendingDrag && this.pendingDrag.id === e.pointerId) {
        const p = this.localPoint(e.clientX, e.clientY);
        this.pendingDrag.cx = p.x;
        this.pendingDrag.cy = p.y;
      }
      return;
    }
    const p = this.localPoint(e.clientX, e.clientY);
    this.touchX = p.x;
    this.touchY = p.y;
  };

  private readonly onPointerEnd = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    if (this.pendingDrag?.id === e.pointerId) this.pendingDrag = null;
    this.endDrag(e.pointerId);
  };

  private readonly onContext = (e: Event) => {
    e.preventDefault();
  };

  private readonly frame = (now: number) => {
    if (this.dead) return;
    if (this.lastTs === 0) {
      this.lastTs = now;
      this.render();
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTs) / 1000);
    this.lastTs = now;
    this.wall += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);

    if (this.phase === "playing" && this.hitStop > 0) {
      this.hitStop -= dt;
    } else if (this.phase === "playing") {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.sim(STEP);
        this.acc -= STEP;
        steps += 1;
        if (this.hitStop > 0) break;
      }
      if (steps === 5) this.acc = 0;
    } else if (this.phase === "name" || this.phase === "over") {
      this.decayCosmetics(dt);
    }

    if (!(this.phase === "playing" && this.hitStop > 0)) {
      const cruise = this.phase === "playing" ? 1 : 0.35;
      const motion = this.reduceMotion ? 0.22 : 1;
      this.updateStars(dt * cruise * motion);
    }

    this.render();
    this.emit(false);
    this.raf = requestAnimationFrame(this.frame);
  };

  constructor(canvas: HTMLCanvasElement, onSnap: (snap: Snapshot) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
    this.onSnap = onSnap;

    const settings = loadSettings();
    this.audio.muted = settings.muted;
    this.shakeOn = settings.shake;
    this.rows = loadScores();
    this.storedBest = this.rows[0]?.score ?? 0;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onViewport);
    window.addEventListener("orientationchange", this.onViewport);
    document.addEventListener("visibilitychange", this.onVis);
    document.addEventListener("gesturestart", this.onGesture, { passive: false });
    document.addEventListener("gesturechange", this.onGesture, { passive: false });
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerEnd);
    window.addEventListener("pointercancel", this.onPointerEnd);
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    window.addEventListener("touchmove", this.onTouchMove, { passive: false });
    window.addEventListener("touchend", this.onTouchEnd);
    window.addEventListener("touchcancel", this.onTouchEnd);
    canvas.addEventListener("contextmenu", this.onContext);
    window.visualViewport?.addEventListener("resize", this.onViewport);
    window.visualViewport?.addEventListener("scroll", this.onViewport);

    this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.mq.addEventListener("change", this.onMotion);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.attachProbe();
    this.emit(true);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.mq?.removeEventListener("change", this.onMotion);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onViewport);
    window.removeEventListener("orientationchange", this.onViewport);
    document.removeEventListener("visibilitychange", this.onVis);
    document.removeEventListener("gesturestart", this.onGesture);
    document.removeEventListener("gesturechange", this.onGesture);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerEnd);
    window.removeEventListener("pointercancel", this.onPointerEnd);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("touchend", this.onTouchEnd);
    window.removeEventListener("touchcancel", this.onTouchEnd);
    this.canvas.removeEventListener("contextmenu", this.onContext);
    window.visualViewport?.removeEventListener("resize", this.onViewport);
    window.visualViewport?.removeEventListener("scroll", this.onViewport);
    if (window.__controlsTest?.getPhase() === this.phase || window.__controlsTest) {
      delete window.__controlsTest;
    }
    this.audio.dispose();
  }

  start(): void {
    this.startAt(1);
  }

  startAt(wave: number): void {
    this.unlock();
    this.pendingWave = clamp(Math.round(wave), 1, 40);
    if (this.w < 10 || this.h < 10) {
      this.pendingStart = true;
      return;
    }
    this.pendingStart = false;
    this.resetRun();
    if (this.pendingWave > 1) {
      this.wave = this.pendingWave;
      this.blades = 1;
      this.bombs = 1;
      this.multi = 2;
      this.multiT = 45;
      this.reflect = this.pendingWave > 20;
      this.beginWave();
    }
    this.clearDrag();
    this.pointerFollow = false;
    this.setPhase("playing");
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  pause(): void {
    if (this.phase !== "playing") return;
    this.keys.clear();
    this.clearDrag();
    this.setPhase("paused");
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.setPhase("playing");
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  toTitle(): void {
    this.keys.clear();
    this.clearDrag();
    this.pointerFollow = false;
    this.hitStop = 0;
    this.setPhase("title");
  }

  showScores(from: ScoresFrom): void {
    this.rows = loadScores();
    this.storedBest = this.rows[0]?.score ?? this.storedBest;
    this.scoresFrom = from;
    this.setPhase("scores");
  }

  backFromScores(): void {
    this.setPhase(this.scoresFrom);
  }

  submitName(name: string): void {
    const clean = (name.toUpperCase().replace(/[^A-Z0-9]/g, "") + "AAA").slice(0, 3);
    const at = Date.now();
    saveName(clean);
    this.rows = saveScore({ name: clean, score: this.finalScore, wave: this.finalWave, at });
    this.storedBest = this.rows[0]?.score ?? this.finalScore;
    this.highlightAt = at;
    this.rank = this.rows.findIndex((row) => row.at === at) + 1;
    this.setPhase("over");
  }

  toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
    saveSettings({ muted: this.audio.muted, shake: this.shakeOn });
    this.emit(true);
  }

  toggleShake(): void {
    this.shakeOn = !this.shakeOn;
    saveSettings({ muted: this.audio.muted, shake: this.shakeOn });
    this.emit(true);
  }

  private unlock(): void {
    this.audio.unlock();
  }

  private syncMusic(): void {
    this.audio.unlock();
    if (this.phase === "playing") this.audio.setMusic(this.wave % 5 === 0 ? "boss" : "play");
    else if (this.phase === "paused") this.audio.setMusic(this.wave % 5 === 0 ? "boss" : "play", 0.22);
    else this.audio.setMusic("title");
  }

  private attachProbe(): void {
    window.__controlsTest = {
      getYaw: () => 0,
      getSpeed: () => Math.hypot(this.player.vx, this.player.vy),
      getX: () => this.player.x,
      getY: () => this.player.y,
      getPhase: () => this.phase,
      setPointer: (x: number, y: number) => {
        this.pointerFollow = true;
        this.pointerX = x;
        this.pointerY = y;
      },
      setKeys: (codes: string[]) => {
        this.keys.clear();
        for (const code of codes) this.keys.add(code);
        this.pointerFollow = false;
      },
    };
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.syncMusic();
    this.emit(true);
  }

  private resize(): void {
    this.fitShell();
    this.readSafe();
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = rect.width;
    const h = rect.height;
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const big = this.w === 0 || Math.abs(w - this.w) > 8 || Math.abs(h - this.h) > 8;
    if (this.w > 0 && (Math.abs(w - this.w) > 1 || Math.abs(h - this.h) > 1)) {
      const sx = w / this.w;
      const sy = h / this.h;
      this.player.x *= sx;
      this.player.y *= sy;
      this.pointerX *= sx;
      this.pointerY *= sy;
      this.touchOriginX *= sx;
      this.touchOriginY *= sy;
      this.touchShipX *= sx;
      this.touchShipY *= sy;
      this.touchX *= sx;
      this.touchY *= sy;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        e.x *= sx;
        e.y *= sy;
        e.baseX *= sx;
        e.slotY *= sy;
      }
      for (const b of this.bullets) {
        if (!b.alive) continue;
        b.x *= sx;
        b.y *= sy;
      }
      for (const blade of this.blade) {
        blade.x *= sx;
        blade.y *= sy;
      }
      for (const p of this.pickups) {
        if (!p.alive) continue;
        p.x *= sx;
        p.y *= sy;
      }
    }
    this.w = w;
    this.h = h;
    if (big) {
      this.makeStars();
      this.buildNebula();
      this.vignette = null;
    }
    if (this.pendingStart) this.startAt(this.pendingWave);
  }

  private resetRun(): void {
    for (const e of this.enemies) e.alive = false;
    for (const b of this.bullets) b.alive = false;
    for (const p of this.pickups) p.alive = false;
    for (const p of this.particles) p.alive = false;
    for (const s of this.severs) s.alive = false;
    for (const p of this.plates) p.alive = false;
    for (const f of this.floaters) f.alive = false;
    for (const f of this.flashes) f.alive = false;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.combo = 0;
    this.lastKill = -10;
    this.time = 0;
    this.multi = 1;
    this.multiT = 0;
    this.shieldT = 0;
    this.shieldCharges = 0;
    this.speedT = 0;
    this.blades = 0;
    this.bombs = 0;
    this.reflect = false;
    this.bombFlash = 0;
    this.slashCd = 0;
    this.fireCd = 0.35;
    this.recoil = 0;
    this.downed = 0;
    this.hint = true;
    this.hitStop = 0;
    this.trauma = 0;
    this.hurtFlash = 0;
    this.acc = 0;
    this.finalScore = 0;
    this.finalWave = 1;
    this.rank = 0;
    this.highlightAt = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 1.35;
    const box = this.playBox();
    this.player.x = (box.l + box.r) / 2;
    this.player.y = Math.min(Math.max(box.t + 48, this.h * 0.78), box.b);
    this.parkBlades();
    this.keys.clear();
    this.beginWave();
  }

  private beginWave(): void {
    this.waveTime = 0;
    this.wardCrack = 0;
    this.armWait = [0, 0, 0];
    this.clearWait = 1.2;
    this.spawns = specsForWave(this.wave);
    if (this.wave % 5 === 0) {
      const form = bossForm(this.wave);
      this.banner = bossTitle(form);
    } else {
      this.banner = `WAVE ${String(this.wave).padStart(2, "0")}`;
    }
    this.bannerT = 1.7;
    this.bannerMax = 1.7;
    this.audio.wave();
    if (this.wave === 1) this.drop("blade", this.w * 0.5, -16);
    if (this.phase === "playing") this.syncMusic();
  }

  private finishRun(): void {
    this.finalScore = this.score;
    this.finalWave = this.wave;
    this.rows = loadScores();
    this.hitStop = 0;
    if (qualifies(this.score, this.rows)) this.setPhase("name");
    else this.setPhase("over");
  }

  private sim(dt: number): void {
    this.time += dt;
    this.boomed = false;
    if (this.multiT > 0) {
      this.multiT -= dt;
      if (this.multiT <= 0) {
        this.multiT = 0;
        this.multi = 1;
      }
    }
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) {
        this.shieldT = 0;
        this.shieldCharges = 0;
      }
    }
    if (this.speedT > 0) this.speedT = Math.max(0, this.speedT - dt);
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt);
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.combo > 0 && this.time - this.lastKill > 1.6) this.combo = 0;
    this.recoil += (0 - this.recoil) * (1 - Math.exp(-18 * dt));

    if (this.downed > 0) {
      this.downed -= dt;
      this.decayCosmetics(dt);
      if (this.downed <= 0) this.finishRun();
      return;
    }

    this.movePlayer(dt);
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.multi >= 3 ? 0.12 : 0.14;
      this.fire();
    }
    if ((this.time * 60) % 2 < 1) this.thrust();

    this.waveTime += dt;
    let alive = 0;
    for (const e of this.enemies) if (e.alive) alive += 1;
    for (const s of this.spawns) {
      if (s.done || this.waveTime < s.t) continue;
      if (alive >= 34 && !bossBody(s.kind)) break;
      s.done = true;
      this.spawnEnemy(s);
      alive += 1;
    }

    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    this.separate();
    for (const e of this.enemies) {
      if (e.alive && e.kind === "scout") {
        e.x = e.baseX + Math.sin(e.age * e.freq + e.ang) * e.amp;
      }
    }
    this.updateBlades(dt);
    for (const b of this.bullets) if (b.alive) this.updateBullet(b, dt);
    for (const p of this.pickups) if (p.alive) this.updatePickup(p, dt);
    this.decayCosmetics(dt);
    this.collide();

    const allSpawned = this.spawns.every((s) => s.done);
    let any = false;
    for (const e of this.enemies) if (e.alive) any = true;
    if (allSpawned && !any && this.downed <= 0) {
      this.clearWait -= dt;
      if (this.clearWait <= 0) {
        const bonus = 400 + this.wave * 150;
        this.score += bonus;
        this.floater(this.w / 2, this.h * 0.34, `WAVE +${bonus}`);
        this.wave += 1;
        this.beginWave();
      }
    } else {
      this.clearWait = 1.2;
    }
  }

  private movePlayer(dt: number): void {
    if (this.player.invuln > 0) this.player.invuln -= dt;
    const box = this.playBox();
    const key = this.keyWish();
    if (key.active) {
      this.hint = false;
      this.slide(dt, key.x, key.y, box);
      return;
    }
    if (this.touchActive && this.phase === "playing") {
      this.hint = false;
      const tx = clamp(this.touchShipX + (this.touchX - this.touchOriginX), box.l, box.r);
      const ty = clamp(this.touchShipY + (this.touchY - this.touchOriginY), box.t, box.b);
      const prevX = this.player.x;
      const prevY = this.player.y;
      const rate = 1 - Math.exp(-140 * dt);
      this.player.x += (tx - this.player.x) * rate;
      this.player.y += (ty - this.player.y) * rate;
      this.player.vx = (this.player.x - prevX) / Math.max(dt, 0.001);
      this.player.vy = (this.player.y - prevY) / Math.max(dt, 0.001);
      return;
    }
    const aim = this.pointerWish();
    if (aim.active) this.hint = false;
    this.slide(dt, aim.x, aim.y, box);
  }

  /** Screen-space strafe. A/Left decreases x; D/Right increases x. Not chase-cam yaw. */
  private keyWish(): { x: number; y: number; active: boolean } {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    const mag = Math.hypot(x, y);
    if (mag > 0) return { x: x / mag, y: y / mag, active: true };
    return { x: 0, y: 0, active: false };
  }

  private pointerWish(): { x: number; y: number; active: boolean } {
    if (!this.pointerFollow || this.phase !== "playing") return { x: 0, y: 0, active: false };
    const dx = this.pointerX - this.player.x;
    const dy = this.pointerY - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return { x: 0, y: 0, active: true };
    const urge = Math.min(1, dist / 78);
    return { x: (dx / dist) * urge, y: (dy / dist) * urge, active: true };
  }

  private slide(
    dt: number,
    x: number,
    y: number,
    box: { l: number; r: number; t: number; b: number },
  ): void {
    const max = this.speedT > 0 ? 560 : 360;
    const rate = 1 - Math.exp(-16 * dt);
    this.player.vx += (x * max - this.player.vx) * rate;
    this.player.vy += (y * max - this.player.vy) * rate;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.x < box.l) {
      this.player.x = box.l;
      this.player.vx = 0;
    } else if (this.player.x > box.r) {
      this.player.x = box.r;
      this.player.vx = 0;
    }
    if (this.player.y < box.t) {
      this.player.y = box.t;
      this.player.vy = 0;
    } else if (this.player.y > box.b) {
      this.player.y = box.b;
      this.player.vy = 0;
    }
  }

  private playBox(): { l: number; r: number; t: number; b: number } {
    const edge = 18;
    const l = edge + this.safe.l;
    const r = Math.max(l + 40, this.w - edge - this.safe.r);
    const t = edge;
    const b = Math.max(t + 40, this.h - edge - this.safe.b);
    return { l, r, t, b };
  }

  private fire(): void {
    const level = clamp(this.multi, 1, 3);
    const spreads = SPREADS[level - 1];
    const speed = 880;
    for (const spread of spreads) {
      const a = -Math.PI / 2 + spread;
      const gx = this.player.x + Math.sin(spread) * (level === 1 ? 0 : 22);
      const gy = this.player.y - 16;
      this.spawnBullet(gx, gy - 4, Math.cos(a) * speed, Math.sin(a) * speed, true, 3.4, 1);
      this.muzzle(gx, gy, -Math.PI / 2);
    }
    this.recoil = 1;
    this.audio.shoot();
  }

  private thrust(): void {
    const bank = clamp(this.player.vx / 480, -1, 1) * 0.42;
    const lx = 0;
    const ly = 12;
    const c = Math.cos(bank);
    const s = Math.sin(bank);
    const x = this.player.x + lx * c - ly * s;
    const y = this.player.y + lx * s + ly * c;
    this.particle(
      x,
      y,
      -this.player.vx * 0.05 + (Math.random() - 0.5) * 16,
      70 + Math.random() * 50,
      0.28,
      this.speedT > 0 ? 2.6 : 2,
      this.speedT > 0 ? PAL.amber : PAL.cyan,
      true,
    );
  }

  private spawnEnemy(s: Spawn): void {
    const e = this.enemies.find((en) => !en.alive);
    if (!e) return;
    const x = clamp(s.x, 0.08, 0.92) * this.w;
    const wave = this.wave;
    e.alive = true;
    e.kind = s.kind;
    e.x = x;
    e.y = -36;
    e.baseX = x;
    e.vx = 0;
    e.vy = 0;
    e.age = 0;
    e.flash = 0;
    e.spin = Math.random() * Math.PI;
    e.amp = 26 + Math.random() * 22;
    e.freq = 1.2 + Math.random() * 0.8;
    e.ang = Math.random() * Math.PI * 2;
    e.pat = 0;
    e.patT = 0.7;
    e.burst = 8;
    e.cut = 0;
    e.wind = 0;
    e.tell = 0;
    e.slotY = Math.max(110, this.h * (0.18 + (s.x % 0.15)));
    e.shot = 0.45 + Math.random() * 0.8;

    if (s.kind === "scout") {
      e.r = 14;
      e.hp = 1 + Math.floor((wave - 1) / 4);
      e.vy = 108 + wave * 8;
    } else if (s.kind === "dart") {
      e.r = 12;
      e.hp = 1 + Math.floor(wave / 6);
      const dx = this.player.x - x;
      const dy = Math.max(80, this.player.y - 40);
      const len = Math.hypot(dx, dy) || 1;
      const sp = 250 + wave * 8;
      e.vx = (dx / len) * sp * 0.72;
      e.vy = Math.abs(dy / len) * sp * 0.45 + 90;
      e.y = -20;
    } else if (s.kind === "turret") {
      e.r = 18;
      e.hp = 3 + Math.floor(wave / 3);
      e.vy = 130;
    } else if (s.kind === "chunk") {
      e.r = 26;
      e.hp = 4 + Math.floor(wave / 2);
      e.vy = 48 + wave * 3;
      e.vx = (Math.random() * 2 - 1) * 50;
      e.y = -40;
      e.patT = 1.15;
    } else if (s.kind === "mine") {
      e.r = 15;
      e.hp = 2 + Math.floor(Math.max(0, wave - 6) / 5);
      e.vy = 64 + wave * 2;
      e.y = -28;
    } else if (s.kind === "heart") {
      e.r = 46;
      e.hp = 460 + wave * 4;
      e.y = -50;
    } else if (s.kind === "lancer") {
      e.r = 48;
      e.hp = 700 + wave * 4;
      e.y = -48;
      e.pat = 0;
      e.patT = 1.35;
    } else if (s.kind === "split") {
      e.r = 34;
      e.hp = 540 + wave * 4;
      e.y = -46;
      e.pat = 0;
      e.patT = 2.2;
      e.baseX = x;
      e.slotY = -46;
    } else if (s.kind === "trine") {
      e.ang = x < this.w * 0.37 ? 0 : x > this.w * 0.63 ? 2 : 1;
      e.r = 26;
      e.hp = 220 + wave * 3;
      e.y = -36 - e.ang * 16;
      e.burst = 0;
    } else if (s.kind === "mote") {
      e.r = 12;
      e.hp = 480 + wave * 3;
      e.y = -28;
      e.pat = 0;
      e.patT = 1.35;
      e.freq = 0;
    } else if (s.kind === "dread") {
      e.r = 44;
      e.hp = 1100 + wave * 2;
      e.y = -80;
      e.amp = Math.min(this.w * 0.4, 320);
      e.pat = 0;
      e.patT = 2.4;
    } else {
      e.r = 52;
      e.hp = 620 + wave * 8;
      e.y = -60;
      e.vy = 40;
    }
    e.maxHp = e.hp;
  }

  private updateEnemy(e: Enemy, dt: number): void {
    e.age += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.cut = Math.max(0, e.cut - dt);
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) this.releaseTell(e);
    }
    if (!e.alive) return;
    e.shot -= dt;
    if (e.kind === "scout") {
      const pull = clamp(this.player.x - e.baseX, -48, 48);
      e.baseX = clamp(e.baseX + pull * dt * 0.65, 24, this.w - 24);
      e.y += e.vy * dt;
      if (e.shot <= 0 && e.wind <= 0 && e.y > 30 && e.y < this.h * 0.78) {
        e.shot = Math.max(0.85, 1.75 - this.wave * 0.04);
        const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const bent = Math.atan2(Math.sin(aim - Math.PI / 2), Math.cos(aim - Math.PI / 2));
        this.beginFan(e, 1, 0, 200 + this.wave * 7, 0.16, Math.PI / 2 + clamp(bent, -0.7, 0.7));
      }
    } else if (e.kind === "dart") {
      if (e.pat === 0 && e.y > Math.min(this.h * 0.28, 220) && e.age > 0.35 && e.wind <= 0) {
        e.pat = 1;
        e.patT = 0.5;
        e.vx = (this.player.x >= e.x ? 1 : -1) * (240 + this.wave * 5);
        e.vy = 36;
        e.shot = 0;
      }
      if (e.pat === 1) {
        e.patT -= dt;
        if (e.patT <= 0) {
          e.pat = 2;
          e.vy = 170 + this.wave * 4;
        }
      } else if (e.pat === 0) {
        e.vy += 30 * dt;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.shot <= 0 && e.wind <= 0 && e.age > 0.25 && e.pat < 2) {
        e.shot = 999;
        this.beginFan(e, 1, 0, 280 + this.wave * 5, 0.18);
      }
    } else if (e.kind === "turret") {
      if (e.y < e.slotY && e.pat === 0) {
        e.y += e.vy * dt;
      } else {
        if (e.pat === 0) e.pat = 1;
        e.y = e.slotY;
        if (e.pat === 2) {
          e.baseX += (e.ang - e.baseX) * Math.min(1, dt * 3.4);
          e.patT -= dt;
          if (e.patT <= 0) e.pat = 1;
        }
        e.baseX = clamp(e.baseX, 36, this.w - 36);
        e.x = e.baseX;
        if (e.pat === 1 && e.shot <= 0 && e.wind <= 0) {
          e.shot = Math.max(1.2, 2.1 - this.wave * 0.04);
          this.beginFan(e, 3, 0.22, 220 + this.wave * 3, 0.3);
          e.ang = clamp(this.player.x, 48, this.w - 48);
          e.pat = 2;
          e.patT = 0.62;
        }
      }
    } else if (e.kind === "chunk") {
      if (e.pat === 1) {
        e.patT -= dt;
        if (e.patT <= 0) {
          e.pat = 0;
          e.patT = 1.25;
          e.vx = Math.sign(e.vx || 1) * (46 + this.wave * 2);
          e.vy = 48 + this.wave * 3;
        }
      } else {
        e.patT -= dt;
        if (e.patT <= 0 && e.y > 36 && e.y < this.h * 0.72) {
          e.pat = 1;
          e.patT = 0.36;
          e.vx = (this.player.x >= e.x ? 1 : -1) * (170 + this.wave * 6);
          e.vy = 80;
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.spin += dt * (e.pat === 1 ? 2.6 : 0.7);
      if (e.x < e.r) {
        e.x = e.r;
        e.vx = Math.abs(e.vx);
      } else if (e.x > this.w - e.r) {
        e.x = this.w - e.r;
        e.vx = -Math.abs(e.vx);
      }
    } else if (e.kind === "mine") {
      const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
      if (e.tell !== 0) {
        e.x += e.vx * dt * 0.25;
        e.y += 22 * dt;
      } else if (e.pat === 1) {
        e.patT -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (dist < 90 || e.patT <= 0) {
          if (dist < 118 && e.y > 36 && e.y < this.h * 0.9) {
            e.aim = e.spin;
            e.vol = 10;
            e.spd = 120 + Math.min(40, this.wave * 2);
            e.tell = 4;
            e.wind = 0.42;
            e.pat = 0;
            this.audio.tick();
          } else {
            e.pat = 0;
            e.patT = 0.9;
            e.vy = 64 + this.wave * 2;
            e.vx *= 0.25;
          }
        }
      } else {
        e.patT -= dt;
        const pull = (this.player.x - e.x) * 1.15;
        e.vx += (pull - e.vx) * Math.min(1, dt * 1.6);
        e.vx = clamp(e.vx, -72, 72);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.patT <= 0 && e.age > 0.5 && dist < 176 && dist > 70 && e.y > 40 && e.y < this.h * 0.8) {
          const len = dist || 1;
          e.pat = 1;
          e.patT = 0.4;
          e.vx = ((this.player.x - e.x) / len) * 220;
          e.vy = ((this.player.y - e.y) / len) * 150;
        }
      }
      e.spin += dt * (e.pat === 1 ? 5.5 : 2.2);
    } else if (e.kind === "heart") {
      this.updateHeart(e, dt);
    } else if (e.kind === "arm") {
      this.updateArm(e, dt);
    } else if (e.kind === "lancer") {
      this.updateLancer(e, dt);
    } else if (e.kind === "split") {
      this.updateSplit(e, dt);
    } else if (e.kind === "trine") {
      this.updateTrine(e, dt);
    } else if (e.kind === "mote") {
      this.updateMote(e, dt);
    } else if (e.kind === "dread") {
      this.updateDread(e, dt);
    } else {
      const ty = this.bossHoverY();
      e.y += (ty - e.y) * (1 - Math.exp(-2.2 * dt));
      const tx = clamp(this.player.x, this.w * 0.22, this.w * 0.78);
      e.x += (tx - e.x) * (1 - Math.exp(-0.85 * dt));
      this.wardenFire(e, dt);
    }

    if (!bossBody(e.kind) && e.kind !== "arm" && (e.y > this.h + 70 || e.x < -90 || e.x > this.w + 90)) e.alive = false;
  }

  private bossHoverY(): number {
    const phone = this.w < 540 || this.h < 520;
    if (!phone) return Math.max(100, this.h * 0.2);
    if (this.h < 520) return Math.max(112, this.h * 0.32);
    return Math.max(168, this.h * 0.24);
  }

  private updateHeart(e: Enemy, dt: number): void {
    const ty = this.bossHoverY();
    e.y += (ty - e.y) * (1 - Math.exp(-1.8 * dt));
    e.x += (this.w * 0.5 - e.x) * (1 - Math.exp(-0.65 * dt));
    const host = this.enemies.indexOf(e);
    let arms = 0;
    for (let i = 0; i < 3; i++) {
      if (this.findArm(host, i)) {
        arms += 1;
        continue;
      }
      this.armWait[i] = (this.armWait[i] ?? 0) - dt;
      if ((this.armWait[i] ?? 0) <= 0) this.spawnArm(e, host, i);
    }
    if (arms < 2 && e.shot <= 0 && e.wind <= 0 && e.y > 40) {
      e.shot = 1.55;
      this.beginFan(e, 3, 0.16, 190, 0.3);
    }
  }

  private updateArm(e: Enemy, dt: number): void {
    const host = this.enemies[e.burst];
    if (!host?.alive || host.kind !== "heart") {
      e.alive = false;
      return;
    }
    e.patT = Math.min(1, e.patT + dt / 0.65);
    const sway = Math.sin(this.time * 1.25 + e.ang * 2.2) * 22 * e.patT;
    const tx = clamp(e.aim + sway, 40, this.w - 40);
    const ty = e.slotY;
    const gx = host.x + (tx - host.x) * e.patT;
    const gy = host.y + 16 + (ty - host.y) * e.patT;
    const k = 1 - Math.exp(-4 * dt);
    e.x += (gx - e.x) * k;
    e.y += (gy - e.y) * k;
    if (e.patT >= 1 && e.shot <= 0 && e.wind <= 0) {
      e.shot = 1.25;
      this.beginFan(e, 1, 0, 230, 0.18);
    }
  }

  private updateLancer(e: Enemy, dt: number): void {
    if (e.pat === 0) {
      const ty = this.bossHoverY();
      e.y += (ty - e.y) * (1 - Math.exp(-2.2 * dt));
      const tx = clamp(this.player.x, this.w * 0.18, this.w * 0.82);
      e.x += (tx - e.x) * (1 - Math.exp(-1.5 * dt));
      e.patT -= dt;
      if (e.patT <= 0) {
        e.pat = 1;
        e.baseX = e.x;
        this.audio.tick();
      }
    } else if (e.pat === 1) {
      e.x = e.baseX;
      e.y += 940 * dt;
      if (e.y > this.h * 0.78) e.pat = 2;
    } else {
      e.y -= 260 * dt;
      e.x = clamp(e.x + Math.sin(this.time * 1.5) * 50 * dt, 80, this.w - 80);
      if (e.y < this.h * 0.2) {
        e.pat = 0;
        e.patT = 1.3;
      }
    }
  }

  private updateSplit(e: Enemy, dt: number): void {
    const cy = this.bossHoverY();
    const mid = this.w * 0.5;
    const glide = 1 - Math.exp(-2.2 * dt);
    if (e.pat === 0) {
      e.y += (cy - e.y) * glide;
      e.x += (mid - e.x) * glide;
      e.baseX = e.x;
      e.slotY = e.y;
      e.patT -= dt;
      if (e.shot <= 0 && e.wind <= 0 && e.y > 36) {
        e.shot = 1.2;
        this.beginFan(e, 4, 0.18, 200, 0.28);
      }
      if (e.patT <= 0) {
        e.pat = 1;
        e.patT = 0.48;
      }
    } else if (e.pat === 1 || e.pat === 3) {
      const apart = e.pat === 1;
      const left = apart ? this.w * 0.28 : mid;
      const right = apart ? this.w * 0.72 : mid;
      const k = 1 - Math.exp(-4.5 * dt);
      e.x += (left - e.x) * k;
      e.baseX += (right - e.baseX) * k;
      e.y += (cy - e.y) * k;
      e.slotY += (cy - e.slotY) * k;
      e.patT -= dt;
      if (e.patT <= 0) {
        e.pat = apart ? 2 : 0;
        e.patT = apart ? 3.2 : 2.3;
      }
    } else {
      const sway = Math.sin(this.time * 1.3) * 22;
      e.x += (this.w * 0.28 + sway - e.x) * glide;
      e.baseX += (this.w * 0.72 - sway - e.baseX) * glide;
      e.y += (cy - e.y) * glide;
      e.slotY = e.y;
      e.patT -= dt;
      if (e.shot <= 0 && e.wind <= 0) {
        e.shot = 0.72;
        const right = e.burst % 2 === 0;
        e.burst += 1;
        const ox = e.x;
        const oy = e.y;
        if (right) {
          e.x = e.baseX;
          e.y = e.slotY;
        }
        this.beginFan(e, 3, 0.14, 225, 0.2);
        e.x = ox;
        e.y = oy;
      }
      if (e.patT <= 0) {
        e.pat = 3;
        e.patT = 0.5;
      }
    }
  }

  private updateTrine(e: Enemy, dt: number): void {
    let alive = 0;
    let rank = 0;
    let seen = false;
    for (const o of this.enemies) {
      if (!o.alive || o.kind !== "trine") continue;
      if (o === e) seen = true;
      else if (!seen) rank += 1;
      alive += 1;
    }
    const cycle = alive <= 1 ? 2.6 : 3.4;
    const speaker = Math.floor(this.time / cycle) % Math.max(1, alive);
    const phase = (this.time % cycle) / cycle;
    const diving = rank === speaker && phase < 0.62;
    e.pat = diving ? 1 : 0;
    const homeY = this.bossHoverY() + (e.ang - 1) * 24;
    const diveY = Math.min(this.h * 0.5, homeY + Math.min(230, this.h * 0.32));
    const homeX = this.w * (0.22 + e.ang * 0.28) + Math.sin(this.time * 0.7 + e.ang) * 18;
    const aimX = clamp(this.player.x, this.w * 0.16, this.w * 0.84);
    const k = 1 - Math.exp((diving ? -3.4 : -1.7) * dt);
    e.y += ((diving ? diveY : homeY) - e.y) * k;
    e.x += ((diving ? aimX : homeX) - e.x) * k;
    e.x = clamp(e.x, 36, this.w - 36);
    if (diving && e.shot <= 0 && e.wind <= 0 && e.y > homeY + 50) {
      e.shot = alive <= 1 ? 0.72 : 0.95;
      this.beginFan(e, alive <= 1 ? 4 : 3, 0.15, 195, 0.24);
    }
  }

  private updateMote(e: Enemy, dt: number): void {
    const high = this.bossHoverY() + 6;
    const low = Math.min(this.h * 0.44, high + Math.min(210, this.h * 0.28));
    const glide = 1 - Math.exp(-2.4 * dt);
    if (e.pat === 0 || e.pat === 3) {
      e.y += (high - e.y) * glide;
      e.x += Math.sin(e.age * 1.5) * 24 * dt;
      e.x = clamp(e.x, 36, this.w - 36);
      e.aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.patT -= dt;
      if (e.pat === 0 && e.patT <= 0) {
        e.pat = 3;
        e.patT = 0.45;
        this.audio.tick();
      } else if (e.pat === 3 && e.patT <= 0) {
        this.fireLaneRing(e);
        e.pat = 1;
        e.patT = 1.6;
        e.freq = 1.15;
        e.spin = e.aim;
      }
    } else if (e.pat === 1) {
      const drop = e.patT < 1.2;
      e.y += ((drop ? low : high) - e.y) * (1 - Math.exp(-3.2 * dt));
      e.x += (clamp(this.player.x, 48, this.w - 48) - e.x) * (1 - Math.exp(-1.5 * dt));
      const want = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.aim += Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim)) * Math.min(1, dt * 0.7);
      e.patT -= dt;
      if (e.freq > 0) {
        e.freq -= dt;
        e.spin += dt * 1.6;
        if (Math.floor(e.age * 11) !== Math.floor((e.age - dt) * 11)) {
          const hole = e.aim;
          for (const extra of [0, 2.2, 4.2]) {
            const a = e.spin + extra;
            const diff = Math.atan2(Math.sin(a - hole), Math.cos(a - hole));
            if (Math.abs(diff) < 0.72) continue;
            this.spawnBullet(e.x, e.y, Math.cos(a) * 148, Math.sin(a) * 148, false, 3.3, 1);
          }
        }
      }
      if (e.patT <= 0) {
        e.pat = 2;
        e.patT = 0.8;
        e.freq = 0;
        e.baseX = clamp(e.x + (e.x < this.w * 0.5 ? 130 : -130), 40, this.w - 40);
      }
    } else {
      e.y += (high - e.y) * glide;
      e.x += (e.baseX - e.x) * Math.min(1, dt * 5);
      e.patT -= dt;
      if (e.patT <= 0) {
        e.pat = 0;
        e.patT = 0.75;
      }
    }
  }

  private fireLaneRing(e: Enemy): void {
    const n = 16;
    const hole = e.aim;
    const speed = 138;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const diff = Math.atan2(Math.sin(a - hole), Math.cos(a - hole));
      if (Math.abs(diff) < 0.82) continue;
      this.spawnBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed, false, 3.6, 1);
    }
  }

  private updateDread(e: Enemy, dt: number): void {
    e.amp = Math.min(this.w * 0.4, 320);
    const y = Math.max(72, this.bossHoverY() - 8);
    e.y += (y - e.y) * (1 - Math.exp(-1.3 * dt));
    e.x += (this.w * 0.5 - e.x) * (1 - Math.exp(-0.7 * dt));
    e.patT -= dt;
    if (e.patT <= 0) {
      e.pat = (e.pat + 1) % 3;
      e.patT = e.pat === 2 ? 2.5 : 2.9;
      this.audio.tick();
    }
    if (e.wind > 0 || e.shot > 0 || e.y < 24) return;
    const ports = [-0.34, -0.17, 0, 0.17, 0.34];
    if (e.pat === 0) {
      e.shot = 0.48;
      for (const p of ports) {
        this.spawnBullet(e.x + e.amp * p, e.y + 18, Math.sin(this.time * 0.7 + p * 4) * 24, 165, false, 4, 1);
      }
    } else if (e.pat === 1) {
      e.shot = 1.05;
      const ox = e.x;
      const oy = e.y;
      for (const p of [-0.32, 0, 0.32]) {
        const gx = ox + e.amp * p;
        const gy = oy + 16;
        const aim = Math.atan2(this.player.y - gy, this.player.x - gx);
        this.fireFan(gx, gy, aim, 3, 0.12, 195, 4);
      }
    } else {
      e.shot = 0.22;
      const a = this.time * 2.6;
      this.spawnBullet(e.x, e.y + 22, Math.cos(a) * 140, Math.sin(a) * 140, false, 4, 1);
      this.spawnBullet(e.x, e.y + 22, Math.cos(a + 2.1) * 140, Math.sin(a + 2.1) * 140, false, 4, 1);
      this.spawnBullet(e.x, e.y + 22, Math.cos(a + 4.2) * 140, Math.sin(a + 4.2) * 140, false, 4, 1);
    }
  }

  private findArm(host: number, slot: number): Enemy | undefined {
    return this.enemies.find((e) => e.alive && e.kind === "arm" && e.burst === host && e.ang === slot);
  }

  private spawnArm(host: Enemy, hostIndex: number, slot: number): void {
    const e = this.enemies.find((en) => !en.alive);
    if (!e) return;
    const lanes = [0.24, 0.5, 0.76];
    e.alive = true;
    e.kind = "arm";
    e.burst = hostIndex;
    e.ang = slot;
    e.r = 12;
    e.hp = 4;
    e.maxHp = 4;
    e.x = host.x;
    e.y = host.y + 12;
    e.vx = 0;
    e.vy = 0;
    e.baseX = host.x;
    e.age = 0;
    e.flash = 0;
    e.cut = 0;
    e.wind = 0;
    e.tell = 0;
    e.pat = 1;
    e.patT = 0;
    e.shot = 0.7 + slot * 0.15;
    e.aim = clamp((lanes[slot] ?? 0.5) * this.w + Math.sin(this.time + slot) * this.w * 0.06, 48, this.w - 48);
    e.slotY = this.h * (slot === 1 ? 0.66 : 0.5);
    this.armWait[slot] = 2.6;
  }

  private armPoints(e: Enemy): { x: number; y: number }[] {
    const host = this.enemies[e.burst];
    const hx = host?.x ?? e.x;
    const hy = (host?.y ?? e.y) + 12;
    const mx = (hx + e.x) / 2;
    const my = (hy + e.y) / 2;
    const dx = e.x - hx;
    const dy = e.y - hy;
    const len = Math.hypot(dx, dy) || 1;
    const bend = (e.ang === 1 ? -1 : 1) * 42;
    return [
      { x: hx, y: hy },
      { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend },
      { x: e.x, y: e.y },
    ];
  }

  private wardenFire(e: Enemy, dt: number): void {
    if (e.y < this.h * 0.1 || e.wind > 0 || e.tell !== 0) return;
    e.patT -= dt;
    if (e.patT > 0) return;
    const mode = e.pat % 3;
    if (mode === 0) {
      e.spd = 155 + Math.min(70, this.wave * 2);
      e.vol = 13;
      e.aim = e.ang;
      e.tell = 2;
      e.wind = 0.36;
      e.patT = 99;
      this.audio.tick();
    } else if (mode === 1) {
      this.beginFan(e, 5, 0.16, 235 + this.wave * 3, 0.34);
      e.patT = 99;
    } else if (e.burst < 8) {
      this.firePair(e, e.ang);
      e.ang += 0.4;
      e.burst -= 1;
      if (e.burst <= 0) {
        e.burst = 8;
        e.patT = 1.1;
        e.pat += 1;
      } else {
        e.patT = 0.07;
      }
    } else {
      e.aim = e.ang;
      e.spd = 185;
      e.tell = 3;
      e.wind = 0.28;
      e.patT = 99;
      this.audio.tick();
    }
  }

  private beginFan(
    e: Enemy,
    count: number,
    spread: number,
    speed: number,
    wind: number,
    aim?: number,
  ): void {
    e.tell = 1;
    e.vol = count;
    e.gap = spread;
    e.spd = speed;
    e.wind = wind;
    e.aim = aim ?? Math.atan2(this.player.y - e.y, this.player.x - e.x);
    if (e.kind !== "scout") this.audio.tick();
  }

  private releaseTell(e: Enemy): void {
    const tell = e.tell;
    const aim = e.aim;
    e.tell = 0;
    e.wind = 0;
    if (tell === 1) this.fireFan(e.x, e.y, aim, e.vol, e.gap, e.spd, e.kind === "scout" ? 4 : 4.2);
    else if (tell === 2) this.fireRing(e, aim);
    else if (tell === 3) this.firePair(e, aim);
    else if (tell === 4) this.fireBloom(e);
    if (e.kind === "mine" && tell === 4) {
      this.burst(e.x, e.y, 10, false);
      if (!this.boomed) {
        this.audio.boom();
        this.boomed = true;
      }
      e.alive = false;
      return;
    }
    if (e.kind !== "warden") return;
    if (tell === 2) {
      e.ang = aim + 0.2;
      e.patT = 1.2;
      e.pat += 1;
    } else if (tell === 1) {
      e.patT = 1.05;
      e.pat += 1;
    } else if (tell === 3) {
      e.ang = aim + 0.4;
      e.burst -= 1;
      if (e.burst <= 0) {
        e.burst = 8;
        e.patT = 1.1;
        e.pat += 1;
      } else {
        e.patT = 0.07;
      }
    }
  }

  private fireFan(
    x: number,
    y: number,
    ang: number,
    count: number,
    spread: number,
    speed: number,
    r: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = ang + (i - (count - 1) / 2) * spread;
      this.spawnBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, false, r, 1);
    }
  }

  private fireBloom(e: Enemy): void {
    const n = e.vol;
    for (let i = 0; i < n; i++) {
      const a = e.aim + (i / n) * Math.PI * 2;
      this.spawnBullet(e.x, e.y, Math.cos(a) * e.spd, Math.sin(a) * e.spd, false, 4.4, 1);
    }
  }

  private fireRing(e: Enemy, aim: number): void {
    const n = e.vol;
    for (let i = 0; i < n; i++) {
      const a = aim + (i / n) * Math.PI * 2;
      const diff = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
      if (Math.abs(diff) < 0.46) continue;
      this.spawnBullet(e.x, e.y, Math.cos(a) * e.spd, Math.sin(a) * e.spd, false, 4.3, 1);
    }
  }

  private firePair(e: Enemy, aim: number): void {
    const speed = e.spd || 185;
    this.spawnBullet(e.x, e.y, Math.cos(aim) * speed, Math.sin(aim) * speed, false, 4, 1);
    this.spawnBullet(e.x, e.y, Math.cos(aim + Math.PI) * speed, Math.sin(aim + Math.PI) * speed, false, 4, 1);
  }

  private separate(): void {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || bossBody(a.kind) || a.kind === "arm") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || bossBody(b.kind) || b.kind === "arm") continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r + 8;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0 || d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        a.baseX -= nx * push;
        b.baseX += nx * push;
      }
    }
  }

  private spawnBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    friendly: boolean,
    r: number,
    dmg: number,
  ): void {
    if (!friendly) {
      let n = 0;
      for (const b of this.bullets) if (b.alive && !b.friendly) n += 1;
      if (n > 100) return;
    }
    const b = this.bullets.find((bullet) => !bullet.alive);
    if (!b) return;
    b.alive = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.r = r;
    b.friendly = friendly;
    b.grazed = false;
    b.life = friendly ? 1.6 : 4.2;
    b.dmg = dmg;
  }

  private updateBullet(b: Bullet, dt: number): void {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > this.w + 40 || b.y < -40 || b.y > this.h + 40) b.alive = false;
  }

  private updatePickup(p: Pickup, dt: number): void {
    p.life -= dt;
    const dx = this.player.x - p.x;
    const dy = this.player.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 120 && this.downed <= 0) {
      const k = 1 - Math.exp(-9 * dt);
      p.x += dx * k;
      p.y += dy * k;
    } else {
      p.y += 62 * dt;
    }
    if (dist < HIT_R + 18) {
      this.collect(p);
      return;
    }
    if (p.life <= 0 || p.y > this.h + 30) p.alive = false;
  }

  private collect(p: Pickup): void {
    p.alive = false;
    this.score += 50;
    if (p.kind === "multi") {
      if (this.multi < 3) this.multi += 1;
      this.multiT = 14;
      this.floater(p.x, p.y - 10, `MULTI ×${shotCount(this.multi)}`);
    } else if (p.kind === "shield") {
      this.shieldCharges = 3;
      this.shieldT = 12;
      this.floater(p.x, p.y - 10, "SHIELD");
    } else if (p.kind === "speed") {
      this.speedT = 10;
      this.floater(p.x, p.y - 10, "SPEED");
    } else if (p.kind === "blade") {
      if (this.blades < 2) {
        this.blades += 1;
        this.armBlade(this.blades - 1);
        this.floater(p.x, p.y - 10, `BLADE ×${this.blades}`);
      } else {
        this.score += 250;
        this.floater(p.x, p.y - 10, "BLADE MAX");
      }
    } else if (p.kind === "reflect") {
      this.reflect = true;
      this.floater(p.x, p.y - 10, "反射");
    } else if (this.bombs < 1) {
      this.bombs = 1;
      this.floater(p.x, p.y - 10, "BOMB");
    } else {
      this.score += 200;
      this.floater(p.x, p.y - 10, "BOMB MAX");
    }
    this.audio.pickup();
    const hot = p.kind === "speed" || p.kind === "blade" || p.kind === "bomb" || p.kind === "reflect";
    this.particle(p.x, p.y, 0, -20, 0.3, 3, hot ? PAL.amber : PAL.cyan, true);
  }

  private parkBlades(): void {
    for (const blade of this.blade) this.armBladeAt(blade, this.player.x, this.player.y);
  }

  private armBlade(index: number): void {
    const blade = this.blade[index];
    if (!blade) return;
    this.armBladeAt(blade, this.player.x, this.player.y);
  }

  private armBladeAt(blade: BladeUnit, x: number, y: number): void {
    blade.x = x;
    blade.y = y;
    blade.vx = 0;
    blade.vy = 0;
    blade.mode = "home";
    blade.target = -1;
    blade.outT = 0;
    blade.cuts = 0;
    blade.rot = -Math.PI / 2;
    blade.u = 1;
    for (let i = 0; i < blade.tx.length; i++) {
      blade.tx[i] = x;
      blade.ty[i] = y;
    }
  }

  private updateBlades(dt: number): void {
    if (this.blades <= 0 || this.downed > 0) return;
    this.slashCd = Math.max(0, this.slashCd - dt);
    let cut = false;
    let threw = false;
    const spin = this.throwSpin;
    for (let i = 0; i < this.blades; i++) {
      const blade = this.blade[i];
      if (!blade) continue;
      const home = this.homeSlot(i);
      if (blade.mode === "home") {
        this.flyToward(blade, home.x, home.y, 420, dt);
        const prey = this.huntTarget(i);
        const foe = prey >= 0 ? this.enemies[prey] : undefined;
        if (foe?.alive) {
          this.throwBlade(blade, i, foe, spin);
          threw = true;
        }
      } else {
        blade.u += dt / blade.dur;
        const u = Math.min(1, blade.u);
        const along = Math.sin(Math.PI * u) * blade.far;
        const side = Math.sin(Math.PI * 2 * u) * blade.wide;
        let x = blade.ox + blade.fx * along + blade.sx * side;
        let y = blade.oy + blade.fy * along + blade.sy * side;
        if (u > 0.72) {
          const pull = ((u - 0.72) / 0.28) ** 2;
          x += (home.x - x) * pull;
          y += (home.y - y) * pull;
        }
        const step = Math.max(dt, 1 / 120);
        blade.vx = (x - blade.x) / step;
        blade.vy = (y - blade.y) / step;
        blade.x = x;
        blade.y = y;
        blade.trail = Math.min(blade.tx.length, blade.trail + 1);
        if (blade.u >= 1) blade.mode = "home";
      }
      const sp = Math.hypot(blade.vx, blade.vy);
      if (sp > 40) blade.rot = Math.atan2(blade.vy, blade.vx) + Math.PI / 2;
      for (let k = blade.tx.length - 1; k > 0; k--) {
        const px = blade.tx[k - 1] ?? blade.x;
        const py = blade.ty[k - 1] ?? blade.y;
        blade.tx[k] = px;
        blade.ty[k] = py;
      }
      blade.tx[0] = blade.x;
      blade.ty[0] = blade.y;
      if (blade.mode === "out" && (this.time * 60) % 2 < 1) {
        this.particle(blade.x, blade.y, -blade.vx * 0.04, -blade.vy * 0.04, 0.22, 2.1, PAL.amber, true);
      }
      if (blade.mode === "out" && this.reflect) this.reflectShots(blade);
      if (this.cutEnemies(blade)) cut = true;
    }
    if (threw) this.throwSpin = -this.throwSpin;
    if (cut && this.slashCd <= 0) {
      this.audio.slash();
      this.slashCd = 0.09;
    }
  }

  private throwBlade(blade: BladeUnit, index: number, enemy: Enemy, spinBase: number): void {
    const lead = 0.22;
    const ax = clamp(enemy.x + enemy.vx * lead, 28, this.w - 28);
    const ay = clamp(enemy.y + enemy.vy * lead, 28, this.h - 28);
    const dx = ax - this.player.x;
    const dy = ay - this.player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const spin = (index === 0 ? 1 : -1) * spinBase;
    const broad = this.w >= 740;
    blade.mode = "out";
    blade.target = this.enemies.indexOf(enemy);
    blade.ox = this.player.x;
    blade.oy = this.player.y;
    blade.fx = dx / dist;
    blade.fy = dy / dist;
    blade.sx = -blade.fy * spin;
    blade.sy = blade.fx * spin;
    blade.far = broad
      ? clamp(Math.max(dist * 1.65, this.w * 0.42), 90, Math.min(this.w * 0.72, this.h * 0.88))
      : clamp(dist * 1.12, 48, Math.min(this.w, this.h) * 0.72);
    blade.wide = clamp(blade.far * (broad ? 0.46 : 0.32), broad ? 96 : 50, broad ? Math.min(280, this.w * 0.24) : 100);
    blade.u = 0;
    const speed = this.speedT > 0 ? (broad ? 1040 : 880) : broad ? 760 : 640;
    blade.dur = clamp((blade.far * 2.5) / speed, broad ? 1.15 : 0.9, broad ? 2.25 : 1.45);
    blade.cuts = 0;
    blade.trail = 1;
  }

  private homeSlot(index: number): { x: number; y: number } {
    const ang = this.time * 2.2 + index * Math.PI;
    return {
      x: this.player.x + Math.cos(ang) * 36,
      y: this.player.y + Math.sin(ang) * 28,
    };
  }

  private huntTarget(self: number): number {
    const mine = this.blade[self];
    if (!mine) return -1;
    const other = this.blade[self === 0 ? 1 : 0];
    const taken = this.blades > 1 && other && other.mode === "out" ? other.target : -1;
    let best = -1;
    let bestD = Infinity;
    let fallback = -1;
    let fallbackD = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e?.alive || e.y < -48 || e.y > this.h + 36) continue;
      const d = (e.x - mine.x) ** 2 + (e.y - mine.y) ** 2;
      if (d < fallbackD) {
        fallbackD = d;
        fallback = i;
      }
      if (i === taken) continue;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best >= 0 ? best : fallback;
  }

  private flyToward(blade: BladeUnit, x: number, y: number, speed: number, dt: number): void {
    const dx = x - blade.x;
    const dy = y - blade.y;
    const dist = Math.hypot(dx, dy) || 1;
    const tx = (dx / dist) * speed;
    const ty = (dy / dist) * speed;
    const k = 1 - Math.exp(-12 * dt);
    blade.vx += (tx - blade.vx) * k;
    blade.vy += (ty - blade.vy) * k;
    blade.x += blade.vx * dt;
    blade.y += blade.vy * dt;
  }

  private bossDamage(e: Enemy, bullet: number, fromBlade: boolean): number {
    const core = (e.kind === "trine" ? e.burst >= 3 : this.wardCrack >= 3) ? 1.4 : 1;
    if (e.kind === "lancer") {
      if (e.pat === 2) return (fromBlade ? 18 : bullet * 1.35) * core;
      return (fromBlade ? 3 : bullet * 0.18) * core;
    }
    if (e.kind === "dread") {
      if (e.pat === 2) return (fromBlade ? 14 : bullet * 0.8) * core;
      return (fromBlade ? 6 : bullet * 0.36) * core;
    }
    if (e.kind === "mote") {
      const low = e.y > this.bossHoverY() + 64;
      if (low) return (fromBlade ? 16 : bullet * 0.9) * core;
      return (fromBlade ? 2 : bullet * 0.16) * core;
    }
    if (e.kind === "trine") {
      if (e.pat === 1) return (fromBlade ? 14 : bullet * 0.9) * core;
      return (fromBlade ? 2 : bullet * 0.12) * core;
    }
    return (fromBlade ? 7 : bullet * 0.5) * core;
  }

  private bombBoss(e: Enemy): number {
    if (e.kind === "lancer") return e.pat === 2 ? 54 : 16;
    if (e.kind === "heart") return 36;
    if (e.kind === "trine") return 26;
    if (e.kind === "mote") return 34;
    if (e.kind === "dread") return e.pat === 2 ? 40 : 20;
    if (e.kind === "split") return 32;
    return 46;
  }

  private bossTouch(e: Enemy, x: number, y: number, pad: number): boolean {
    if (e.kind === "lancer") return Math.abs(x - e.x) < 100 + pad && Math.abs(y - e.y) < 40 + pad;
    if (e.kind === "dread") return Math.abs(x - e.x) < e.amp + pad && Math.abs(y - e.y) < 36 + pad;
    if (e.kind === "split" && e.pat !== 0) {
      const r = 26 + pad;
      return (x - e.x) ** 2 + (y - e.y) ** 2 < r * r || (x - e.baseX) ** 2 + (y - e.slotY) ** 2 < r * r;
    }
    return (x - e.x) ** 2 + (y - e.y) ** 2 <= (e.r + pad) ** 2;
  }

  private woundWarden(e: Enemy, dmg: number, split?: { x: number; y: number }): void {
    if (e.kind === "trine") {
      e.hp -= dmg;
      e.flash = 0.1;
      const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 0;
      const gates = [0.75, 0.5, 0.25];
      while (e.burst < gates.length && ratio <= (gates[e.burst] ?? 0)) {
        e.burst += 1;
        if (!this.boomed) {
          this.audio.boom();
          this.boomed = true;
        }
        this.floater(e.x, e.y - e.r - 16, e.burst >= 3 ? "CORE" : "ARMOR");
        this.shedPlate(e, e.burst);
      }
      if (e.hp <= 0) this.killEnemy(e, true, split);
      return;
    }
    e.hp -= dmg;
    e.flash = 0.1;
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 0;
    const gates = [0.75, 0.5, 0.25];
    while (this.wardCrack < gates.length && ratio <= (gates[this.wardCrack] ?? 0)) {
      this.wardCrack += 1;
      if (!this.boomed) {
        this.audio.boom();
        this.boomed = true;
      }
      this.hitStop = Math.max(this.hitStop, 0.05);
      this.trauma = Math.min(1, this.trauma + (this.reduceMotion ? 0.08 : 0.2));
      const core = this.wardCrack >= 3;
      this.floater(e.x, e.y - e.r - 18, core ? "CORE" : "ARMOR");
      this.shedPlate(e, this.wardCrack);
      this.burst(e.x, e.y, core ? 18 : 10, false);
    }
    if (e.hp <= 0) this.killEnemy(e, true, split);
  }

  private shedPlate(e: Enemy, index: number): void {
    const slot = this.plates.find((item) => !item.alive) ?? this.plates[0];
    if (!slot) return;
    const ang = ((index - 1) / 3) * Math.PI * 2 - Math.PI / 2;
    slot.alive = true;
    slot.x = e.x + Math.cos(ang) * e.r * 0.7;
    slot.y = e.y + Math.sin(ang) * e.r * 0.45;
    slot.vx = Math.cos(ang) * 170;
    slot.vy = Math.sin(ang) * 110 - 30;
    slot.rot = ang;
    slot.spin = index % 2 === 0 ? 3.2 : -3.2;
    slot.life = 0.72;
    slot.max = 0.72;
    slot.w = e.kind === "lancer" ? 62 : 34;
  }

  private cutEnemies(blade: BladeUnit): boolean {
    let hit = false;
    const ribbon = blade.mode === "out";
    for (const e of this.enemies) {
      if (!e.alive || e.cut > 0) continue;
      let touch = false;
      let sx = blade.vx;
      let sy = blade.vy;
      const tip = (this.w >= 740 ? 26 : 16) + e.r * 0.45;
      const sturdy = e.kind === "mine" || e.kind === "turret" || e.kind === "chunk";
      if ((blade.x - e.x) ** 2 + (blade.y - e.y) ** 2 <= tip * tip) touch = true;
      if (!touch && e.kind === "split" && e.pat !== 0) {
        if ((blade.x - e.baseX) ** 2 + (blade.y - e.slotY) ** 2 <= tip * tip) touch = true;
      }
      if (!touch && e.kind === "arm") {
        const pts = this.armPoints(e);
        const reach = ribbon ? 14 : 18;
        for (let s = 0; s < pts.length - 1; s++) {
          const a = pts[s];
          const b = pts[s + 1];
          if (!a || !b) continue;
          if (distToSeg(blade.x, blade.y, a.x, a.y, b.x, b.y) > reach) continue;
          touch = true;
          sx = b.x - a.x;
          sy = b.y - a.y;
          break;
        }
      }
      if (!touch && ribbon && !sturdy) {
        const band = 6 + e.r * 0.11;
        const n = Math.min(blade.tx.length, blade.trail);
        for (let k = 0; k < n - 2; k += 2) {
          const ax = blade.tx[k] ?? blade.x;
          const ay = blade.ty[k] ?? blade.y;
          const bx = blade.tx[k + 2] ?? blade.x;
          const by = blade.ty[k + 2] ?? blade.y;
          if (distToSeg(e.x, e.y, ax, ay, bx, by) > band) continue;
          touch = true;
          sx = bx - ax;
          sy = by - ay;
          break;
        }
      }
      if (!touch) continue;
      e.cut = 0.34;
      hit = true;
      const mag = Math.hypot(sx, sy) || 1;
      const split = { x: sx / mag, y: sy / mag };
      if (!ribbon) {
        e.flash = 0.07;
        this.spark(blade.x, blade.y);
        if (bossBody(e.kind)) this.woundWarden(e, this.bossDamage(e, 1, true), split);
        else {
          e.hp -= 1;
          if (e.hp <= 0) this.killEnemy(e, true, split);
        }
        continue;
      }
      this.spark(e.x, e.y);
      if (bossBody(e.kind)) this.woundWarden(e, this.bossDamage(e, 1, true), split);
      else this.killEnemy(e, true, split);
    }
    return hit;
  }

  private reflectShots(blade: BladeUnit): void {
    const band = (this.w >= 740 ? 11 : 8);
    const n = Math.min(blade.tx.length, blade.trail);
    if (n < 2) return;
    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      let hit = false;
      for (let k = 0; k < n - 2; k += 2) {
        const ax = blade.tx[k] ?? blade.x;
        const ay = blade.ty[k] ?? blade.y;
        const bx = blade.tx[k + 2] ?? blade.x;
        const by = blade.ty[k + 2] ?? blade.y;
        if (distToSeg(b.x, b.y, ax, ay, bx, by) > band + b.r) continue;
        hit = true;
        break;
      }
      if (!hit) continue;
      b.friendly = true;
      b.vx = -b.vx;
      b.vy = -b.vy;
      b.dmg = 1;
      b.life = Math.max(b.life, 1.8);
      b.grazed = true;
      this.spark(b.x, b.y);
    }
  }

  private collide(): void {
    for (const b of this.bullets) {
      if (!b.alive || !b.friendly) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = b.r + e.r;
        const hit = bossBody(e.kind) ? this.bossTouch(e, b.x, b.y, b.r) : dx * dx + dy * dy <= rr * rr;
        if (!hit) continue;
        b.alive = false;
        this.spark(b.x, b.y);
        if (bossBody(e.kind)) this.woundWarden(e, this.bossDamage(e, b.dmg, false));
        else {
          e.hp -= b.dmg;
          e.flash = 0.08;
          if (e.hp <= 0) this.killEnemy(e, true);
          else if (this.time - this.lastKill > 0.05) this.audio.tick();
        }
        break;
      }
    }

    if (this.player.invuln > 0 || this.downed > 0) {
      this.graze();
      return;
    }

    for (const b of this.bullets) {
      if (!b.alive || b.friendly) continue;
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      const rr = b.r + HIT_R;
      if (dx * dx + dy * dy <= rr * rr) {
        b.alive = false;
        this.hurtPlayer(b.x, b.y);
        if (this.player.invuln > 0 || this.downed > 0) {
          this.graze();
          return;
        }
      }
    }

    this.graze();

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const wide = e.kind === "lancer" && Math.abs(dx) < 78 && Math.abs(dy) < 34;
      const dread = e.kind === "dread" && Math.abs(dx) < e.amp * 0.92 && Math.abs(dy) < 32;
      const twin =
        e.kind === "split" &&
        e.pat !== 0 &&
        (e.baseX - this.player.x) ** 2 + (e.slotY - this.player.y) ** 2 < (24 + HIT_R) ** 2;
      const rr = e.r * 0.75 + HIT_R;
      if (!wide && !dread && !twin && dx * dx + dy * dy > rr * rr) continue;
      this.hurtPlayer(e.x, e.y);
      if (!bossBody(e.kind)) {
        e.hp -= e.kind === "chunk" ? 2 : e.hp;
        if (e.hp <= 0) this.killEnemy(e, e.kind !== "chunk");
      }
      return;
    }
  }

  useBomb(): void {
    if (this.phase !== "playing" || this.bombs <= 0 || this.downed > 0) return;
    this.bombs -= 1;
    this.bombFlash = 0.38;
    this.boomed = true;
    this.audio.boom();
    this.trauma = Math.min(1, this.trauma + (this.reduceMotion ? 0.15 : 0.4));
    this.hitStop = 0.06;
    for (const b of this.bullets) if (b.alive && !b.friendly) b.alive = false;
    for (const e of this.enemies) {
      if (!e.alive || e.y < -30 || e.y > this.h + 30) continue;
      if (bossBody(e.kind)) this.woundWarden(e, this.bombBoss(e));
      else {
        e.hp -= e.kind === "chunk" ? 3 : e.hp;
        e.flash = 0.12;
        if (e.hp <= 0) this.killEnemy(e, true);
      }
    }
    this.burst(this.player.x, this.player.y, this.reduceMotion ? 10 : 22, true);
    this.emit(true);
  }

  private graze(): void {
    if (this.downed > 0) return;
    for (const b of this.bullets) {
      if (!b.alive || b.friendly || b.grazed) continue;
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      const hit = b.r + HIT_R;
      const near = hit + 16;
      const d2 = dx * dx + dy * dy;
      if (d2 <= hit * hit || d2 > near * near) continue;
      b.grazed = true;
      this.score += 10;
      this.particle(b.x, b.y, dx * 4, dy * 4, 0.16, 2.1, PAL.cyan, true);
      if (this.time - this.lastGraze > 0.08) {
        this.audio.tick();
        this.lastGraze = this.time;
      }
    }
  }

  private hurtPlayer(fromX: number, fromY: number): void {
    if (this.player.invuln > 0 || this.downed > 0) return;
    const dx = this.player.x - fromX;
    const dy = this.player.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.player.vx = (dx / d) * 260;
    this.player.vy = (dy / d) * 260;
    this.hurtFlash = 0.7;

    if (this.shieldCharges > 0 && this.shieldT > 0) {
      this.shieldCharges -= 1;
      this.player.invuln = 0.4;
      this.audio.tick();
      this.trauma = Math.min(1, this.trauma + 0.28);
      this.hitStop = 0.03;
      if (this.shieldCharges <= 0) this.shieldT = 0;
      this.burst(this.player.x, this.player.y, 8, false);
      return;
    }

    this.lives -= 1;
    this.audio.hurt();
    this.trauma = Math.min(1, this.trauma + (this.reduceMotion ? 0.2 : 0.72));
    this.hitStop = 0.08;
    this.multi = Math.max(1, this.multi - 1);
    if (this.multi === 1) this.multiT = 0;
    this.shieldT = 0;
    this.shieldCharges = 0;
    if (this.blades > 0) {
      this.blades -= 1;
      this.floater(this.player.x, this.player.y - 28, "BLADE LOST");
    }
    for (const b of this.bullets) if (b.alive && !b.friendly) b.alive = false;

    if (this.lives <= 0) {
      this.downed = 0.9;
      this.burst(this.player.x, this.player.y, this.reduceMotion ? 16 : 36, true);
      return;
    }

    this.burst(this.player.x, this.player.y, 14, false);
    this.player.x = this.w / 2;
    this.player.y = this.h * 0.78;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 2;
  }

  private killEnemy(e: Enemy, scored: boolean, split?: { x: number; y: number }): void {
    if (!e.alive) return;
    e.alive = false;
    const big = bossBody(e.kind);
    if (e.kind === "heart") {
      for (const arm of this.enemies) if (arm.alive && arm.kind === "arm") arm.alive = false;
    }
    const lastOfKind = !this.enemies.some((o) => o.alive && o.kind === e.kind);
    if (split && !this.reduceMotion) this.sever(e, split.x, split.y);
    this.burst(e.x, e.y, this.reduceMotion ? (big ? 14 : 4) : split ? (big ? 18 : 6) : big ? 42 : 16, big);
    if (!this.boomed) {
      this.audio.boom();
      this.boomed = true;
    }
    this.trauma = Math.min(1, this.trauma + (big ? 0.75 : split ? 0.08 : 0.26));
    this.hitStop = big ? 0.09 : 0;
    if (!scored) return;
    if (this.time - this.lastKill < 1.6) this.combo += 1;
    else this.combo = 1;
    this.lastKill = this.time;
    const pts = Math.round(SCORE[e.kind] * comboMultiplier(this.combo));
    this.score += pts;
    this.floater(
      e.x,
      e.y,
      this.combo > 1 ? `${pts} ×${comboMultiplier(this.combo).toFixed(1)}` : `${pts}`,
    );
    if (big && lastOfKind) {
      this.drop("multi", e.x - 28, e.y);
      this.drop("shield", e.x, e.y);
      this.drop("speed", e.x + 28, e.y);
      this.drop("blade", e.x, e.y + 22);
      this.drop("bomb", e.x + 22, e.y + 36);
      if (this.wave === 20 && e.kind === "split" && !this.reflect) {
        this.drop("reflect", this.w * 0.5, Math.min(e.y + 70, this.h * 0.42));
        this.floater(this.w * 0.5, this.h * 0.36, "反射");
      }
    } else if (Math.random() < DROP[e.kind]) {
      this.drop(this.rollPickup(), e.x, e.y);
    }
  }

  private rollPickup(): PickupKind {
    const r = Math.random();
    if (r < 0.26) return "multi";
    if (r < 0.46) return "shield";
    if (r < 0.64) return "speed";
    if (r < 0.84) return "blade";
    return "bomb";
  }

  private sever(e: Enemy, dx: number, dy: number): void {
    const ang = Math.atan2(dy, dx);
    const nx = -dy;
    const ny = dx;
    const kick = 120 + e.r * 4;
    for (const side of [-1, 1]) {
      const slot = this.severs.find((item) => !item.alive) ?? this.severs[0];
      if (!slot) return;
      slot.alive = true;
      slot.kind = e.kind;
      slot.r = e.r;
      slot.side = side;
      slot.x = e.x + nx * side * e.r * 0.28;
      slot.y = e.y + ny * side * e.r * 0.28;
      slot.vx = nx * side * kick + dx * 70;
      slot.vy = ny * side * kick + dy * 50;
      slot.rot = ang;
      slot.spin = side * (2.4 + e.r * 0.04);
      slot.life = bossBody(e.kind) ? 0.85 : 0.55;
      slot.max = slot.life;
    }
  }

  private drop(kind: PickupKind, x: number, y: number): void {
    const p = this.pickups.find((item) => !item.alive);
    if (!p) return;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.life = 11;
  }

  private muzzle(x: number, y: number, rot: number): void {
    const f = this.flashes.find((flash) => !flash.alive) ?? this.flashes[0];
    f.alive = true;
    f.x = x;
    f.y = y;
    f.life = 0.055;
    f.max = 0.055;
    f.rot = rot;
  }

  private spark(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 90;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.18, 1.8, PAL.fg, true);
    }
  }

  private burst(x: number, y: number, n: number, big: boolean): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (big ? 90 : 40) + Math.random() * (big ? 240 : 150);
      const color = i % 3 === 0 ? PAL.fg : i % 2 === 0 ? PAL.amber : PAL.cyan;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.35, big ? 3.2 : 2.2, color, true);
    }
  }

  private particle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    hot: boolean,
  ): void {
    let slot: Particle | undefined;
    for (const p of this.particles) {
      if (!p.alive) {
        slot = p;
        break;
      }
    }
    if (!slot) {
      slot = this.particles[this.pCursor % this.particles.length];
      this.pCursor += 1;
    }
    slot.alive = true;
    slot.x = x;
    slot.y = y;
    slot.vx = vx;
    slot.vy = vy;
    slot.life = life;
    slot.max = life;
    slot.size = size;
    slot.color = color;
    slot.hot = hot;
  }

  private floater(x: number, y: number, text: string): void {
    const f = this.floaters.find((item) => !item.alive) ?? this.floaters[0];
    f.alive = true;
    f.x = x;
    f.y = y;
    f.text = text;
    f.life = 0.75;
    f.max = 0.75;
  }

  private decayCosmetics(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
    for (const s of this.severs) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 40 * dt;
      s.rot += s.spin * dt;
      s.life -= dt;
      if (s.life <= 0) s.alive = false;
    }
    for (const p of this.plates) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt;
      p.rot += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.y -= 36 * dt;
      f.life -= dt;
      if (f.life <= 0) f.alive = false;
    }
    for (const f of this.flashes) {
      if (!f.alive) continue;
      f.life -= dt;
      if (f.life <= 0) f.alive = false;
    }
  }

  private makeStars(): void {
    const layers = [
      { n: 80, sp: 22, r0: 0.6, r1: 1.2, a0: 0.25, a1: 0.45, layer: 0 },
      { n: 46, sp: 58, r0: 0.9, r1: 1.6, a0: 0.4, a1: 0.7, layer: 1 },
      { n: 24, sp: 130, r0: 1.1, r1: 2, a0: 0.65, a1: 1, layer: 2 },
    ];
    this.stars = [];
    for (const layer of layers) {
      for (let i = 0; i < layer.n; i++) {
        this.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          r: layer.r0 + Math.random() * (layer.r1 - layer.r0),
          a: layer.a0 + Math.random() * (layer.a1 - layer.a0),
          sp: layer.sp * (0.75 + Math.random() * 0.5),
          layer: layer.layer,
          tw: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private updateStars(dt: number): void {
    const boost = this.speedT > 0 && this.phase === "playing" ? 1.4 : 1;
    for (const star of this.stars) {
      star.y += star.sp * boost * dt;
      if (star.y > this.h + 4) {
        star.y = -4;
        star.x = Math.random() * this.w;
      }
    }
    if (this.nebula) {
      this.nebulaY += dt * (this.reduceMotion ? 8 : 18) * boost;
      if (this.nebulaY > this.h) this.nebulaY -= this.h;
    }
  }

  private buildNebula(): void {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(this.w));
    c.height = Math.max(1, Math.floor(this.h));
    const g = c.getContext("2d");
    if (!g) return;
    const blobs = [
      { x: this.w * 0.28, y: this.h * 0.32, r: this.w * 0.48, color: "rgba(42,212,240,0.10)" },
      { x: this.w * 0.74, y: this.h * 0.62, r: this.w * 0.36, color: "rgba(240,162,2,0.07)" },
      { x: this.w * 0.48, y: this.h * 0.95, r: this.w * 0.42, color: "rgba(42,212,240,0.05)" },
    ];
    for (const b of blobs) {
      const rad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rad.addColorStop(0, b.color);
      rad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rad;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
    }
    this.nebula = c;
    this.nebulaY = 0;
  }

  private readPointer(e: PointerEvent): void {
    const p = this.localPoint(e.clientX, e.clientY);
    this.pointerX = p.x;
    this.pointerY = p.y;
  }

  private localPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private fitShell(): void {
    const shell = this.canvas.parentElement;
    const vv = window.visualViewport;
    if (!shell || !vv || vv.width < 2 || vv.height < 2) return;
    const w = `${Math.round(vv.width)}px`;
    const h = `${Math.round(vv.height)}px`;
    if (shell.style.width !== w) shell.style.width = w;
    if (shell.style.height !== h) shell.style.height = h;
  }

  private readSafe(): void {
    const cs = getComputedStyle(document.documentElement);
    const px = (name: string) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : 0;
    };
    this.safe = { l: px("--sal"), r: px("--sar"), b: px("--sab") };
  }

  private beginDrag(x: number, y: number, key: number): void {
    if (this.dragKey !== null && this.dragKey !== key) return;
    if (this.dragKey === null) {
      this.dragKey = key;
      this.touchActive = true;
      this.touchOriginX = x;
      this.touchOriginY = y;
      this.touchShipX = this.player.x;
      this.touchShipY = this.player.y;
      this.pointerFollow = false;
      this.audio.resume();
    }
    this.touchX = x;
    this.touchY = y;
  }

  private endDrag(key: number): void {
    if (this.dragKey !== key) return;
    this.clearDrag();
  }

  private clearDrag(): void {
    this.pendingDrag = null;
    if (!this.touchActive && this.dragKey === null) return;
    this.dragKey = null;
    this.touchActive = false;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  private flushPending(seq: number): void {
    const pending = this.pendingDrag;
    if (!pending || pending.seq !== seq || this.dead || this.phase !== "playing") return;
    this.pendingDrag = null;
    if (this.touchClaimedSeq === seq || this.dragKey !== null) return;
    this.beginDrag(pending.x, pending.y, pending.id);
    this.touchX = pending.cx;
    this.touchY = pending.cy;
  }

  private bossRatio(): number {
    let hp = 0;
    let max = 0;
    for (const e of this.enemies) {
      if (!e.alive || !bossBody(e.kind)) continue;
      hp += Math.max(0, e.hp);
      max += e.maxHp;
    }
    return max > 0 ? clamp(hp / max, 0, 1) : -1;
  }

  private showWorld(): boolean {
    if (this.phase === "playing" || this.phase === "paused" || this.phase === "name" || this.phase === "over") {
      return true;
    }
    return this.phase === "scores" && this.scoresFrom !== "title";
  }

  private emit(force: boolean): void {
    if (this.dead) return;
    const now = performance.now();
    if (!force && now - this.lastEmit < 80) return;
    const boss = this.bossRatio();
    const snap = this.makeSnap(boss);
    const key = [
      snap.phase,
      snap.score,
      snap.best,
      snap.lives,
      snap.wave,
      snap.combo,
      snap.multi,
      Math.ceil(snap.multiT),
      snap.shieldCharges,
      Math.ceil(snap.shieldT),
      Math.ceil(snap.speedT),
      snap.blades,
      snap.bombs,
      snap.reflect ? 1 : 0,
      boss < 0 ? -1 : Math.round(boss * 24),
      snap.muted ? 1 : 0,
      snap.shake ? 1 : 0,
      snap.hint ? 1 : 0,
      snap.rank,
      snap.finalScore,
      snap.highlightAt,
    ].join("|");
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.lastEmit = now;
    this.onSnap(snap);
  }

  private makeSnap(boss: number): Snapshot {
    return {
      phase: this.phase,
      score: this.score,
      best: Math.max(this.storedBest, this.phase === "playing" ? this.score : this.storedBest),
      lives: this.lives,
      wave: this.wave,
      combo: this.combo,
      multi: this.multi,
      shots: shotCount(this.multi),
      multiT: this.multiT,
      shieldT: this.shieldT,
      shieldCharges: this.shieldCharges,
      speedT: this.speedT,
      blades: this.blades,
      bombs: this.bombs,
      reflect: this.reflect,
      boss,
      finalScore: this.finalScore,
      finalWave: this.finalWave,
      rank: this.rank,
      rows: this.rows,
      highlightAt: this.highlightAt,
      muted: this.audio.muted,
      shake: this.shakeOn,
      hint: this.hint,
      scoresFrom: this.scoresFrom,
    };
  }

  private render(): void {
    if (this.w < 2 || this.h < 2) return;
    const ctx = this.ctx;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    if (this.shakeOn && !this.reduceMotion && this.trauma > 0) {
      const s = this.trauma * this.trauma;
      ctx.translate(Math.sin(this.wall * 47) * 13 * s, Math.cos(this.wall * 39) * 9 * s);
    }
    this.drawNebula(ctx);
    this.drawStars(ctx);
    if (this.showWorld()) {
      this.drawPickups(ctx);
      this.drawBullets(ctx);
      this.drawEnemies(ctx);
      this.drawPlates(ctx);
      this.drawSevers(ctx);
      this.drawTells(ctx);
      if (this.downed <= 0 && (this.phase === "playing" || this.phase === "paused")) {
        this.drawPlayer(ctx);
        this.drawBlades(ctx);
      }
      this.drawFlashes(ctx);
      this.drawParticles(ctx);
      this.drawBomb(ctx);
      this.drawFloaters(ctx);
      this.drawBanner(ctx);
      if (this.phase === "playing") {
        this.drawReticle(ctx);
        this.drawTouch(ctx);
      }
    }
    ctx.restore();
    this.drawVignette(ctx);
    if (this.hurtFlash > 0 && !this.reduceMotion) {
      ctx.globalAlpha = Math.min(0.4, this.hurtFlash * 0.35);
      ctx.fillStyle = PAL.fg;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  private drawNebula(ctx: CanvasRenderingContext2D): void {
    if (!this.nebula) return;
    ctx.drawImage(this.nebula, 0, this.nebulaY - this.h);
    ctx.drawImage(this.nebula, 0, this.nebulaY);
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const star of this.stars) {
      const tw = 0.7 + 0.3 * Math.sin(this.wall * (star.layer === 2 ? 3 : 1.4) + star.tw);
      ctx.globalAlpha = star.a * tw;
      ctx.strokeStyle = PAL.fg;
      ctx.fillStyle = PAL.fg;
      if (star.layer === 2) {
        ctx.lineWidth = star.r;
        ctx.beginPath();
        ctx.moveTo(star.x, star.y - star.sp * 0.018);
        ctx.lineTo(star.x, star.y + 1.5);
        ctx.stroke();
      } else {
        ctx.fillRect(star.x, star.y, star.r, star.r);
      }
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const bank = clamp(p.vx / 480, -1, 1) * 0.42;
    const blink = p.invuln > 0 && Math.sin(this.wall * 28) < 0;
    ctx.save();
    ctx.translate(p.x, p.y + this.recoil * 3.5);
    ctx.rotate(bank);
    ctx.globalAlpha = blink ? 0.4 : 1;

    const flame = 8 + Math.sin(this.wall * 42) * 2 + (this.speedT > 0 ? 6 : 0);
    ctx.fillStyle = this.speedT > 0 ? PAL.amber : PAL.cyan;
    ctx.beginPath();
    ctx.moveTo(-4.5, 8);
    ctx.quadraticCurveTo(0, 10 + flame, 4.5, 8);
    ctx.fill();

    ctx.fillStyle = PAL.hull;
    ctx.strokeStyle = PAL.cyan;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(5, -8);
    ctx.lineTo(15, 6);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 7);
    ctx.lineTo(-6, 12);
    ctx.lineTo(-15, 6);
    ctx.lineTo(-5, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (this.multi >= 2) {
      ctx.strokeRect(-18, -1, 5, 10);
      ctx.strokeRect(13, -1, 5, 10);
    }
    if (this.multi >= 3) {
      ctx.strokeRect(-24, 3, 4, 8);
      ctx.strokeRect(20, 3, 4, 8);
    }

    ctx.fillStyle = PAL.cyan;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(2.6, -2);
    ctx.lineTo(0, 1);
    ctx.lineTo(-2.6, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.shieldT > 0 && this.shieldCharges > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.wall * 1.4);
      ctx.strokeStyle = PAL.cyan;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * 26;
        const y = Math.sin(a) * 26;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawTells(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = PAL.amber;
    ctx.fillStyle = PAL.amber;
    for (const e of this.enemies) {
      if (!e.alive || e.tell === 0 || e.wind <= 0) continue;
      ctx.globalAlpha = clamp(0.9 - e.wind * 1.5, 0.28, 0.92);
      if (e.tell === 2 || e.tell === 4) {
        const n = e.vol;
        const bloom = e.tell === 4;
        for (let i = 0; i < n; i++) {
          const a = e.aim + (i / n) * Math.PI * 2;
          if (!bloom) {
            const diff = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
            if (Math.abs(diff) < 0.46) continue;
          }
          const inner = e.r + 4;
          const outer = e.r + (bloom ? 28 : 18);
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * inner, e.y + Math.sin(a) * inner);
          ctx.lineTo(e.x + Math.cos(a) * outer, e.y + Math.sin(a) * outer);
          ctx.stroke();
        }
        continue;
      }
      const rays = e.tell === 3 ? 2 : e.vol;
      const len = e.kind === "scout" ? 36 : e.kind === "warden" ? 108 : 78;
      for (let i = 0; i < rays; i++) {
        const a = e.tell === 3 ? e.aim + i * Math.PI : e.aim + (i - (rays - 1) / 2) * e.gap;
        const x0 = e.x + Math.cos(a) * (e.r + 3);
        const y0 = e.y + Math.sin(a) * (e.r + 3);
        const x1 = e.x + Math.cos(a) * (e.r + len);
        const y1 = e.y + Math.sin(a) * (e.r + len);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x1, y1, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) if (e.alive && e.kind === "arm") this.drawArm(ctx, e);
    for (const e of this.enemies) {
      if (!e.alive || e.kind === "arm") continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === "dart") ctx.rotate(Math.atan2(e.vx, e.vy));
      else if (e.kind === "turret") ctx.rotate(Math.atan2(this.player.x - e.x, this.player.y - e.y));
      else if (e.kind === "chunk" || e.kind === "mine") ctx.rotate(e.spin);

      const flash = e.flash > 0;
      ctx.fillStyle = flash ? PAL.fg : PAL.hull;
      ctx.strokeStyle = e.kind === "chunk" ? PAL.muted : PAL.amber;
      ctx.lineWidth = e.kind === "warden" ? 2.4 : 1.6;

      if (e.kind === "chunk") {
        ctx.beginPath();
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rad = e.r * (i % 2 === 0 ? 1 : 0.72);
          const x = Math.cos(a) * rad;
          const y = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.kind === "warden") {
        ctx.scale(1.36, 1.36);
        ctx.beginPath();
        ctx.moveTo(0, 36);
        ctx.lineTo(30, 12);
        ctx.lineTo(22, -18);
        ctx.lineTo(8, -30);
        ctx.lineTo(-8, -30);
        ctx.lineTo(-22, -18);
        ctx.lineTo(-30, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        this.drawBossArmor(ctx, e);
      } else if (e.kind === "heart") {
        ctx.scale(1.08, 1.08);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
          const x = Math.cos(a) * e.r;
          const y = Math.sin(a) * e.r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = flash ? PAL.fg : PAL.amber;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        this.drawBossArmor(ctx, e);
      } else if (e.kind === "lancer") {
        ctx.scale(1.24, 1.24);
        ctx.beginPath();
        ctx.moveTo(0, 34);
        ctx.lineTo(86, -6);
        ctx.lineTo(46, -24);
        ctx.lineTo(-46, -24);
        ctx.lineTo(-86, -6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = e.pat === 2 ? PAL.fg : PAL.amberHot;
        ctx.lineWidth = e.pat === 2 ? 2.4 : 1.2;
        ctx.beginPath();
        ctx.moveTo(-70, -4);
        ctx.lineTo(-20, 10);
        ctx.moveTo(70, -4);
        ctx.lineTo(20, 10);
        ctx.stroke();
        this.drawBossArmor(ctx, e);
      } else if (e.kind === "split" || e.kind === "trine" || e.kind === "mote" || e.kind === "dread") {
        this.drawBossShip(ctx, e, flash);
      } else if (e.kind === "turret") {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = Math.cos(a) * e.r;
          const y = Math.sin(a) * e.r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = flash ? PAL.fg : PAL.amber;
        ctx.fillRect(-2.2, 0, 4.4, e.r + 6);
      } else if (e.kind === "mine") {
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.58, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * e.r * 0.58, Math.sin(a) * e.r * 0.58);
          ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        }
        ctx.stroke();
        if (e.wind > 0) {
          ctx.fillStyle = PAL.amberHot;
          ctx.beginPath();
          ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === "dart") {
        ctx.beginPath();
        ctx.moveTo(0, e.r + 4);
        ctx.lineTo(8, -e.r);
        ctx.lineTo(0, -e.r * 0.4);
        ctx.lineTo(-8, -e.r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, e.r);
        ctx.lineTo(e.r * 0.85, -e.r * 0.35);
        ctx.lineTo(0, -e.r * 0.05);
        ctx.lineTo(-e.r * 0.85, -e.r * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      if (bossBody(e.kind) && e.kind !== "trine") {
        const ratio = clamp(e.hp / e.maxHp, 0, 1);
        const bar = e.kind === "dread" ? Math.min(e.amp, 200) : e.kind === "lancer" ? 120 : e.kind === "mote" ? 48 : 84;
        const cracked = this.wardCrack >= 3 || (e.kind === "dread" && e.pat === 2);
        ctx.fillStyle = "rgba(7,11,20,0.65)";
        ctx.fillRect(e.x - bar / 2, e.y - e.r - 22, bar, 4);
        ctx.fillStyle = cracked ? PAL.fg : PAL.amber;
        ctx.fillRect(e.x - bar / 2, e.y - e.r - 22, bar * ratio, 4);
        if (e.kind === "lancer" && e.pat === 0 && e.patT < 0.9) {
          const a = clamp(1 - e.patT / 0.9, 0.15, 0.7);
          ctx.globalAlpha = a;
          ctx.strokeStyle = PAL.amber;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(e.x - 80, e.y + 24, 160, this.h - e.y - 32);
          ctx.globalAlpha = 1;
        }
        if (e.kind === "mote" && (e.pat === 3 || e.pat === 1)) {
          const hole = e.aim;
          ctx.globalAlpha = e.pat === 1 ? 0.28 : 0.7;
          ctx.strokeStyle = e.y > this.bossHoverY() + 64 ? PAL.fg : PAL.amber;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(hole - 0.82) * 150, e.y + Math.sin(hole - 0.82) * 150);
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(hole + 0.82) * 150, e.y + Math.sin(hole + 0.82) * 150);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (e.kind === "split" && e.pat !== 0) {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = PAL.amber;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.baseX, e.slotY);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.translate(e.baseX, e.slotY);
          ctx.fillStyle = e.flash > 0 ? PAL.fg : PAL.hull;
          ctx.strokeStyle = PAL.amber;
          ctx.lineWidth = 1.6;
          this.strokeDiamond(ctx, 0.72);
          ctx.restore();
        }
      } else if (e.kind === "trine") {
        const ratio = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = "rgba(7,11,20,0.65)";
        ctx.fillRect(e.x - 28, e.y - e.r - 14, 56, 3);
        ctx.fillStyle = e.pat === 1 || e.burst >= 3 ? PAL.fg : PAL.amber;
        ctx.fillRect(e.x - 28, e.y - e.r - 14, 56 * ratio, 3);
        if (e.pat === 1) {
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = PAL.fg;
          ctx.strokeRect(e.x - 16, e.y + 8, 32, 64);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  private drawBossShip(ctx: CanvasRenderingContext2D, e: Enemy, flash: boolean): void {
    if (e.kind === "split") {
      if (e.pat === 0) ctx.scale(1.18, 1.18);
      this.strokeDiamond(ctx, e.pat === 0 ? 1 : 0.72);
      this.drawBossArmor(ctx, e);
      return;
    }
    if (e.kind === "trine") {
      if (e.pat === 1) ctx.strokeStyle = PAL.fg;
      this.strokeDiamond(ctx, e.r / 28);
      this.drawBossArmor(ctx, e);
      return;
    }
    if (e.kind === "mote") {
      this.strokeDiamond(ctx, 0.42);
      ctx.fillStyle = flash || this.wardCrack >= 3 ? PAL.fg : PAL.amberHot;
      ctx.beginPath();
      ctx.arc(0, 0, this.wardCrack >= 3 ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
      this.drawBossArmor(ctx, e);
      return;
    }
    const s = Math.max(0.8, e.amp / 200);
    ctx.scale(s, 1);
    ctx.beginPath();
    ctx.moveTo(-200, 8);
    ctx.lineTo(-176, -30);
    ctx.lineTo(-40, -30);
    ctx.lineTo(-24, -46);
    ctx.lineTo(24, -46);
    ctx.lineTo(40, -30);
    ctx.lineTo(176, -30);
    ctx.lineTo(200, 8);
    ctx.lineTo(150, 30);
    ctx.lineTo(-150, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = e.pat === 2 ? PAL.fg : PAL.amberHot;
    ctx.lineWidth = e.pat === 2 ? 2.2 : 1.3;
    ctx.beginPath();
    for (const p of [-0.34, -0.17, 0, 0.17, 0.34]) {
      ctx.moveTo(p * 200, 6);
      ctx.lineTo(p * 200, 26);
    }
    ctx.stroke();
    this.drawBossArmor(ctx, e);
  }

  private strokeDiamond(ctx: CanvasRenderingContext2D, scale: number): void {
    ctx.beginPath();
    ctx.moveTo(0, 28 * scale);
    ctx.lineTo(22 * scale, 0);
    ctx.lineTo(0, -22 * scale);
    ctx.lineTo(-22 * scale, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawBossArmor(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const open = e.kind === "trine" ? e.burst : this.wardCrack;
    const core = clamp(open / 3, 0, 1);
    const exposed = open >= 3;
    const pulse = exposed ? 0.75 + Math.sin(this.time * 9) * 0.25 : 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = exposed ? PAL.fg : PAL.amberHot;
    ctx.globalAlpha = 0.2 + core * 0.75;
    ctx.beginPath();
    ctx.arc(0, e.kind === "lancer" ? 4 : 2, (exposed ? 12 : 4 + core * 5) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PAL.hull;
    ctx.strokeStyle = exposed ? PAL.amberHot : PAL.amber;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      if (i < open) continue;
      ctx.save();
      ctx.rotate(e.kind === "lancer" || e.kind === "dread" ? 0 : (i / 3) * Math.PI * 2);
      ctx.beginPath();
      if (e.kind === "lancer" || e.kind === "dread") {
        const span = e.kind === "dread" ? 168 : 74;
        const y = -18 + i * 14;
        ctx.moveTo(-span, y);
        ctx.lineTo(span, y);
        ctx.lineTo(span - 8, y + 7);
        ctx.lineTo(-span + 8, y + 7);
      } else {
        const inner = e.kind === "warden" ? 26 : e.r * 0.72;
        const outer = e.kind === "warden" ? 38 : e.r * 1.02;
        ctx.arc(0, 0, inner, -0.62, 0.62);
        ctx.arc(0, 0, outer, 0.62, -0.62, true);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPlates(ctx: CanvasRenderingContext2D): void {
    for (const p of this.plates) {
      if (!p.alive) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = PAL.hull;
      ctx.strokeStyle = PAL.amber;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-p.w * 0.5, -5);
      ctx.lineTo(p.w * 0.5, -5);
      ctx.lineTo(p.w * 0.38, 6);
      ctx.lineTo(-p.w * 0.38, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawArm(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const pts = this.armPoints(e);
    ctx.beginPath();
    const first = pts[0];
    if (!first) return;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = e.flash > 0 ? PAL.fg : PAL.amber;
    ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, e.patT);
    ctx.lineWidth = 5;
    ctx.lineJoin = "miter";
    ctx.stroke();
    ctx.globalAlpha = 1;
    const joint = pts[1];
    if (joint) {
      ctx.fillStyle = PAL.amber;
      ctx.beginPath();
      ctx.arc(joint.x, joint.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    const prev = pts[1] ?? first;
    ctx.rotate(Math.atan2(e.y - prev.y, e.x - prev.x) + Math.PI / 2);
    ctx.fillStyle = e.flash > 0 ? PAL.fg : PAL.hull;
    ctx.strokeStyle = PAL.amber;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(9, -8);
    ctx.lineTo(0, -2);
    ctx.lineTo(-9, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawBullets(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const mag = Math.hypot(b.vx, b.vy) || 1;
      const len = b.friendly ? 16 : 10;
      ctx.globalCompositeOperation = b.friendly ? "lighter" : "source-over";
      ctx.strokeStyle = b.friendly ? PAL.cyan : PAL.amber;
      ctx.fillStyle = b.friendly ? PAL.fg : PAL.amberHot;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = b.friendly ? 2.4 : 2;
      ctx.beginPath();
      ctx.moveTo(b.x - (b.vx / mag) * len, b.y - (b.vy / mag) * len);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.friendly ? 2.1 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSevers(ctx: CanvasRenderingContext2D): void {
    for (const h of this.severs) {
      if (!h.alive) continue;
      const fade = Math.max(0, h.life / h.max);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.globalAlpha = Math.min(1, fade * 1.3);
      ctx.beginPath();
      ctx.rect(-h.r * 2.6, h.side < 0 ? -h.r * 2.6 : 0, h.r * 5.2, h.r * 2.6);
      ctx.clip();
      ctx.translate(0, h.side * 3);
      this.paintHull(ctx, h.kind, h.r);
      ctx.restore();
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = PAL.fg;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-h.r * 0.95, 0);
      ctx.lineTo(h.r * 0.95, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  private paintHull(ctx: CanvasRenderingContext2D, kind: Kind, r: number): void {
    ctx.fillStyle = PAL.hull;
    ctx.strokeStyle = kind === "chunk" ? PAL.muted : PAL.amber;
    ctx.lineWidth = kind === "warden" ? 2.4 : 1.6;
    ctx.beginPath();
    if (kind === "chunk") {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rad = r * (i % 2 === 0 ? 1 : 0.72);
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (kind === "heart") {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else if (kind === "lancer") {
      ctx.moveTo(0, 34);
      ctx.lineTo(86, -6);
      ctx.lineTo(46, -24);
      ctx.lineTo(-46, -24);
      ctx.lineTo(-86, -6);
      ctx.closePath();
    } else if (kind === "dread") {
      ctx.moveTo(-70, 8);
      ctx.lineTo(-60, -16);
      ctx.lineTo(60, -16);
      ctx.lineTo(70, 8);
      ctx.lineTo(40, 20);
      ctx.lineTo(-40, 20);
      ctx.closePath();
    } else if (kind === "split" || kind === "trine" || kind === "mote") {
      ctx.moveTo(0, 16);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, -12);
      ctx.lineTo(-12, 0);
      ctx.closePath();
    } else if (kind === "arm") {
      ctx.moveTo(0, 14);
      ctx.lineTo(8, -8);
      ctx.lineTo(0, -2);
      ctx.lineTo(-8, -8);
      ctx.closePath();
    } else if (kind === "warden") {
      ctx.moveTo(0, 36);
      ctx.lineTo(30, 12);
      ctx.lineTo(22, -18);
      ctx.lineTo(8, -30);
      ctx.lineTo(-8, -30);
      ctx.lineTo(-22, -18);
      ctx.lineTo(-30, 12);
      ctx.closePath();
    } else if (kind === "turret" || kind === "mine") {
      ctx.arc(0, 0, r * (kind === "mine" ? 0.7 : 0.9), 0, Math.PI * 2);
    } else if (kind === "dart") {
      ctx.moveTo(0, r + 4);
      ctx.lineTo(8, -r);
      ctx.lineTo(0, -r * 0.4);
      ctx.lineTo(-8, -r);
      ctx.closePath();
    } else {
      ctx.moveTo(0, r);
      ctx.lineTo(r * 0.85, -r * 0.35);
      ctx.lineTo(0, -r * 0.05);
      ctx.lineTo(-r * 0.85, -r * 0.35);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  private drawBlades(ctx: CanvasRenderingContext2D): void {
    if (this.blades <= 0) return;
    for (let i = 0; i < this.blades; i++) {
      const blade = this.blade[i];
      if (!blade) continue;
      if (blade.mode === "out") {
        const n = Math.max(1, Math.min(blade.tx.length, blade.trail));
        ctx.beginPath();
        ctx.moveTo(blade.tx[n - 1] ?? blade.x, blade.ty[n - 1] ?? blade.y);
        for (let k = n - 2; k >= 0; k--) ctx.lineTo(blade.tx[k] ?? blade.x, blade.ty[k] ?? blade.y);
        ctx.strokeStyle = this.reflect ? PAL.cyan : PAL.amber;
        ctx.globalAlpha = 0.16;
        ctx.lineWidth = this.w >= 740 ? 8 : 5;
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = this.w >= 740 ? 2.6 : 1.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(blade.x, blade.y);
      ctx.rotate(blade.rot);
      ctx.fillStyle = PAL.amber;
      ctx.strokeStyle = PAL.fg;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-13, 12);
      ctx.lineTo(0, -2);
      ctx.lineTo(13, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBomb(ctx: CanvasRenderingContext2D): void {
    if (this.bombFlash <= 0) return;
    const t = 1 - this.bombFlash / 0.38;
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - t);
    ctx.strokeStyle = PAL.fg;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, 24 + t * Math.hypot(this.w, this.h) * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawPickups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const bob = Math.sin(this.wall * 4 + p.x) * 3;
      const y = p.y + bob;
      ctx.save();
      ctx.translate(p.x, y);
      const hot = p.kind === "speed" || p.kind === "blade" || p.kind === "bomb" || p.kind === "reflect";
      ctx.strokeStyle = hot ? PAL.amber : PAL.cyan;
      ctx.fillStyle = PAL.hull;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hot ? PAL.amber : PAL.cyan;
      ctx.font = "700 11px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pickupGlyph(p.kind), 0, 1);
      ctx.restore();
    }
  }

  private drawFlashes(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of this.flashes) {
      if (!f.alive) continue;
      const a = f.life / f.max;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot + Math.PI / 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = PAL.fg;
      ctx.beginPath();
      ctx.moveTo(0, -18 * a);
      ctx.lineTo(5, 2);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 2);
      ctx.fill();
      ctx.fillStyle = PAL.cyan;
      ctx.beginPath();
      ctx.arc(0, 0, 5 * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      ctx.globalCompositeOperation = p.hot ? "lighter" : "source-over";
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * (p.life / p.max)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawFloaters(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = PAL.amber;
    for (const f of this.floaters) {
      if (!f.alive) continue;
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    if (this.bannerT <= 0 || this.phase !== "playing") return;
    const p = 1 - this.bannerT / this.bannerMax;
    const alpha = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1;
    const scale = 0.92 + Math.min(1, p * 5) * 0.08;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.w / 2, this.h * 0.4);
    ctx.scale(scale, scale);
    ctx.fillStyle = PAL.fg;
    ctx.font = "800 48px Syne, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.banner, 0, 0);
    ctx.font = "600 13px Manrope, sans-serif";
    ctx.fillStyle = PAL.muted;
    ctx.fillText(bannerLine(this.banner), 0, 36);
    ctx.restore();
  }

  private drawReticle(ctx: CanvasRenderingContext2D): void {
    if (!this.pointerFollow) return;
    const dx = this.pointerX - this.player.x;
    const dy = this.pointerY - this.player.y;
    if (dx * dx + dy * dy < 18 * 18) return;
    ctx.save();
    ctx.strokeStyle = PAL.cyan;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.25;
    const x = this.pointerX;
    const y = this.pointerY;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + 13);
    ctx.stroke();
    ctx.restore();
  }

  private drawTouch(ctx: CanvasRenderingContext2D): void {
    if (!this.touchActive) return;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PAL.cyan;
    ctx.fillStyle = PAL.cyan;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(this.touchOriginX, this.touchOriginY, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(this.touchOriginX, this.touchOriginY);
    ctx.lineTo(this.touchX, this.touchY);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(this.touchX, this.touchY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    if (!this.vignette) {
      const g = ctx.createRadialGradient(
        this.w / 2,
        this.h / 2,
        Math.min(this.w, this.h) * 0.25,
        this.w / 2,
        this.h / 2,
        Math.max(this.w, this.h) * 0.72,
      );
      g.addColorStop(0, "rgba(7,11,20,0)");
      g.addColorStop(1, "rgba(7,11,20,0.62)");
      this.vignette = g;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}
