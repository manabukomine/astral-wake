import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Bomb,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Gauge,
  Keyboard,
  Navigation2,
  Orbit,
  Pause,
  Pointer,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Game, INITIAL_SNAPSHOT, comboMultiplier, type Snapshot } from "@/game/engine";
import { loadName, type ScoreRow } from "@/game/storage";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const TEST_WAVES = [
  { wave: 1, label: "01 通常" },
  { wave: 5, label: "05 WARDEN" },
  { wave: 6, label: "06 マイン" },
  { wave: 10, label: "10 TENDRIL" },
  { wave: 15, label: "15 LANCER" },
  { wave: 20, label: "20 SPLIT" },
  { wave: 21, label: "21 反射" },
  { wave: 25, label: "25 TRINE" },
  { wave: 30, label: "30 MOTE" },
  { wave: 35, label: "35 DREAD" },
];

const btn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-display text-lg font-bold tracking-wide transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const btnPrimary = `${btn} bg-accent text-bg`;
const btnGhost = `${btn} border border-line bg-bg text-fg`;

function pad(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(6, "0");
}

export function Shooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot>(INITIAL_SNAPSHOT);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas, setSnap);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const playing = snap.phase === "playing";

  return (
    <div
      className={`game-shell relative bg-bg text-fg ${playing ? "cursor-crosshair" : ""}`}
      data-phase={snap.phase}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-hidden />
      {playing && (
        <Hud snap={snap} onPause={() => gameRef.current?.pause()} onBomb={() => gameRef.current?.useBomb()} />
      )}
      {snap.phase !== "playing" && (
        <Overlay dim={snap.phase === "title" ? "bg-bg/45" : "bg-bg/70"}>
          {snap.phase === "title" && <Title snap={snap} game={gameRef} />}
          {snap.phase === "paused" && <Paused snap={snap} game={gameRef} />}
          {snap.phase === "name" && (
            <NameEntry score={snap.finalScore} wave={snap.finalWave} onSubmit={(name) => gameRef.current?.submitName(name)} />
          )}
          {snap.phase === "over" && <GameOver snap={snap} game={gameRef} />}
          {snap.phase === "scores" && <Scores snap={snap} onBack={() => gameRef.current?.backFromScores()} />}
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, dim }: { children: ReactNode; dim: string }) {
  return (
    <div className={`absolute inset-0 z-30 overflow-y-auto ${dim}`}>
      <div className="flex min-h-full items-center justify-center safe-pad">
        <div className="aw-rise w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface/95 p-5 shadow-lg backdrop-blur-md sm:p-7">
      <div className="mb-4 h-1 w-10 bg-primary" aria-hidden />
      {children}
    </section>
  );
}

function Title({ snap, game }: { snap: Snapshot; game: RefObject<Game | null> }) {
  return (
    <Card>
      <p className="font-sans text-xs font-semibold tracking-widest text-primary">DEEP LANE 07</p>
      <h1 className="mt-2 font-display text-5xl leading-tight font-extrabold sm:text-6xl">
        ASTRAL
        <br />
        WAKE
      </h1>
      <p className="mt-3 text-sm leading-normal text-muted">
        指でドラッグして動く。V字ブーメランは弧を描いて敵を斬りに行き、また戻る。6面からマイン。近づくと円く割れる。
      </p>
      {snap.best > 0 && (
        <p className="mt-3 text-sm text-muted">
          BEST <span className="font-display text-lg text-fg tabular-nums">{pad(snap.best)}</span>
        </p>
      )}
      <div className="mt-5 grid gap-2">
        <button type="button" className={btnPrimary} onClick={() => game.current?.start()}>
          Start
          <span className="font-sans text-sm font-semibold opacity-70">出撃</span>
        </button>
        <button type="button" className={btnGhost} onClick={() => game.current?.showScores("title")}>
          ハイスコア
        </button>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-semibold tracking-widest text-muted">テスト面</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEST_WAVES.map((stage) => (
            <button
              key={stage.wave}
              type="button"
              className="min-h-10 rounded-md border border-line bg-bg px-2.5 py-1 text-xs font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => game.current?.startAt(stage.wave)}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </details>
      <ul className="mt-5 grid grid-cols-2 gap-2 text-center text-xs leading-normal text-muted">
        <li className="rounded-md border border-line px-2 py-3">
          <Crosshair className="mx-auto mb-2 size-5 text-primary" aria-hidden />
          <span className="block font-semibold text-fg">マルチ</span>
          弾が広がる
        </li>
        <li className="rounded-md border border-line px-2 py-3">
          <Shield className="mx-auto mb-2 size-5 text-primary" aria-hidden />
          <span className="block font-semibold text-fg">シールド</span>
          被弾を防ぐ
        </li>
        <li className="rounded-md border border-line px-2 py-3">
          <Gauge className="mx-auto mb-2 size-5 text-accent" aria-hidden />
          <span className="block font-semibold text-fg">スピード</span>
          移動が速い
        </li>
        <li className="rounded-md border border-line px-2 py-3">
          <Orbit className="mx-auto mb-2 size-5 text-accent" aria-hidden />
          <span className="block font-semibold text-fg">ブーメラン</span>
          弧を描いて斬る
        </li>
      </ul>
      <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Pointer className="size-4" aria-hidden /> 指でドラッグ
        </span>
        <span className="inline-flex items-center gap-1">
          <Keyboard className="size-4" aria-hidden /> WASD / 矢印
        </span>
      </p>
      <p className="mt-1 text-center text-xs text-muted">射撃は自動。Space か右下の X でボム。Esc で一時停止。</p>
    </Card>
  );
}

function Hud({ snap, onPause, onBomb }: { snap: Snapshot; onPause: () => void; onBomb: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="hud-top">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="hud-kicker text-xs font-semibold tracking-widest text-muted">SCORE</p>
          <p className="hud-score font-display leading-none tabular-nums">{pad(snap.score)}</p>
          <p className="hud-best mt-1 text-xs text-muted tabular-nums">BEST {pad(snap.best)}</p>
        </div>
        <div className="text-center">
          <p className="hud-kicker text-xs font-semibold tracking-widest text-muted">WAVE</p>
          <p className="hud-score font-display leading-none tabular-nums">{String(snap.wave).padStart(2, "0")}</p>
          {snap.combo > 1 && (
            <p className="mt-1 font-display text-sm text-accent tabular-nums">
              ×{comboMultiplier(snap.combo).toFixed(1)}
            </p>
          )}
        </div>
        <button
          type="button"
          className="hud-pause pointer-events-auto inline-flex items-center justify-center rounded-lg border border-line bg-surface text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={onPause}
          aria-label="一時停止"
        >
          <Pause className="size-5" />
        </button>
      </div>
      <div className="hud-row mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1" aria-label={`残機 ${snap.lives}`}>
          {Array.from({ length: 3 }, (_, i) => (
            <Navigation2
              key={i}
              className={i < snap.lives ? "size-4 text-primary" : "size-4 text-line"}
              aria-hidden
            />
          ))}
        </div>
        {snap.multi > 1 && <Chip label={`MULTI ×${snap.shots}`} seconds={snap.multiT} />}
        {snap.shieldCharges > 0 && snap.shieldT > 0 && (
          <Chip label={`SHIELD ${snap.shieldCharges}`} seconds={snap.shieldT} />
        )}
        {snap.speedT > 0 && <Chip label="SPEED" seconds={snap.speedT} hot />}
        {snap.blades > 0 && <Chip label={`BLADE ×${snap.blades}`} hot />}
        {snap.reflect && <Chip label="反射" hot />}
        {snap.bombs > 0 && <Chip label="BOMB" hot />}
      </div>
      {snap.boss >= 0 && (
        <div className="hud-boss mt-3 max-w-xs">
          <p className="hud-boss-label mb-1 text-xs font-semibold tracking-widest text-accent">BOSS</p>
          <div className="boss-bar h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-accent" style={{ width: `${Math.round(snap.boss * 100)}%` }} />
          </div>
        </div>
      )}
      {snap.hint && (
        <p className="pointer-events-none absolute bottom-[max(1.35rem,env(safe-area-inset-bottom))] left-1/2 w-max max-w-[calc(100%-7.5rem)] -translate-x-1/2 rounded-full bg-bg/80 px-4 py-2 text-center text-sm font-semibold text-fg">
          画面を指でドラッグして移動
        </p>
      )}
      </div>
      <button
        type="button"
        className={`pointer-events-auto absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1.15rem,env(safe-area-inset-bottom))] inline-flex size-14 items-center justify-center rounded-lg border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${snap.bombs > 0 ? "border-accent text-accent" : "border-line text-muted opacity-50"}`}
        onClick={onBomb}
        disabled={snap.bombs <= 0}
        aria-label={snap.bombs > 0 ? "ボム" : "ボムなし"}
      >
        <Bomb className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function Chip({ label, seconds, hot = false }: { label: string; seconds?: number; hot?: boolean }) {
  return (
    <span
      className={`hud-chip rounded-md border border-line bg-surface/90 px-2 py-1 text-xs font-bold tracking-wide ${hot ? "text-accent" : "text-primary"}`}
    >
      {label}
      {seconds !== undefined && <span className="ml-2 text-muted tabular-nums">{Math.ceil(seconds)}s</span>}
    </span>
  );
}

function Paused({ snap, game }: { snap: Snapshot; game: RefObject<Game | null> }) {
  return (
    <Card>
      <p className="text-xs font-semibold tracking-widest text-primary">PAUSED</p>
      <h2 className="mt-1 font-display text-4xl font-extrabold">一時停止</h2>
      <p className="mt-2 text-sm text-muted tabular-nums">
        SCORE {pad(snap.score)} · WAVE {String(snap.wave).padStart(2, "0")}
      </p>
      <div className="mt-5 grid gap-2">
        <button type="button" className={btnPrimary} onClick={() => game.current?.resume()}>
          再開
        </button>
        <button type="button" className={btnGhost} onClick={() => game.current?.start()}>
          最初から
        </button>
        <button type="button" className={btnGhost} onClick={() => game.current?.showScores("paused")}>
          ハイスコア
        </button>
        <button type="button" className={btnGhost} onClick={() => game.current?.toTitle()}>
          タイトル
        </button>
      </div>
      <SettingsRow snap={snap} game={game} />
    </Card>
  );
}

function SettingsRow({ snap, game }: { snap: Snapshot; game: RefObject<Game | null> }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        type="button"
        className={btnGhost}
        aria-pressed={!snap.muted}
        onClick={() => game.current?.toggleMute()}
      >
        {snap.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        {snap.muted ? "音オフ" : "音オン"}
      </button>
      <button
        type="button"
        className={btnGhost}
        aria-pressed={snap.shake}
        onClick={() => game.current?.toggleShake()}
      >
        {snap.shake ? "揺れオン" : "揺れオフ"}
      </button>
    </div>
  );
}

function GameOver({ snap, game }: { snap: Snapshot; game: RefObject<Game | null> }) {
  return (
    <Card>
      <p className="text-xs font-semibold tracking-widest text-accent">SIGNAL LOST</p>
      <h2 className="mt-1 font-display text-4xl font-extrabold">航路途絶</h2>
      <p className="mt-4 font-display text-5xl text-primary tabular-nums">{pad(snap.finalScore)}</p>
      <p className="mt-1 text-sm text-muted">WAVE {String(snap.finalWave).padStart(2, "0")}</p>
      {snap.rank > 0 && <p className="mt-2 text-sm font-semibold text-accent">ハイスコア {snap.rank}位</p>}
      <div className="mt-5 grid gap-2">
        <button type="button" className={btnPrimary} onClick={() => game.current?.start()}>
          もう一度
        </button>
        <button type="button" className={btnGhost} onClick={() => game.current?.showScores("over")}>
          ハイスコア
        </button>
        <button type="button" className={btnGhost} onClick={() => game.current?.toTitle()}>
          タイトル
        </button>
      </div>
    </Card>
  );
}

function Scores({ snap, onBack }: { snap: Snapshot; onBack: () => void }) {
  return (
    <Card>
      <p className="text-xs font-semibold tracking-widest text-primary">LOCAL BOARD</p>
      <h2 className="mt-1 font-display text-4xl font-extrabold">ハイスコア</h2>
      <p className="mt-2 text-sm text-muted">この端末のトップ8。アカウントには保存しません。</p>
      <ScoreTable rows={snap.rows} highlightAt={snap.highlightAt} />
      <button type="button" className={`${btnGhost} mt-4 w-full`} onClick={onBack}>
        戻る
      </button>
    </Card>
  );
}

function ScoreTable({ rows, highlightAt }: { rows: ScoreRow[]; highlightAt: number }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">まだ航路の記録はない。最初の一機になれ。</p>;
  }
  return (
    <div className="mt-4 max-h-72 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs tracking-widest text-muted">
          <tr>
            <th className="py-2 font-medium">#</th>
            <th className="py-2 font-medium">NAME</th>
            <th className="py-2 text-right font-medium">SCORE</th>
            <th className="py-2 text-right font-medium">WAVE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.at}-${i}`} className={row.at === highlightAt ? "text-accent" : "text-fg"}>
              <td className="py-1.5 tabular-nums">{i + 1}</td>
              <td className="py-1.5 font-display tracking-widest">{row.name}</td>
              <td className="py-1.5 text-right tabular-nums">{row.score.toLocaleString("ja-JP")}</td>
              <td className="py-1.5 text-right tabular-nums">{row.wave}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NameEntry({
  score,
  wave,
  onSubmit,
}: {
  score: number;
  wave: number;
  onSubmit: (name: string) => void;
}) {
  const [chars, setChars] = useState(() => loadName().padEnd(3, "A").slice(0, 3).split(""));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => (i + 2) % 3);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setIdx((i) => (i + 1) % 3);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setChars((prev) => rotate(prev, idx, -1));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setChars((prev) => rotate(prev, idx, 1));
      } else if (e.code === "Enter") {
        e.preventDefault();
        onSubmit(chars.join(""));
      } else if (e.code === "Backspace") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (/^[a-zA-Z0-9]$/.test(e.key)) {
        const glyph = e.key.toUpperCase();
        e.preventDefault();
        setChars((prev) => {
          const next = [...prev];
          next[idx] = glyph;
          return next;
        });
        setIdx((i) => Math.min(2, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chars, idx, onSubmit]);

  return (
    <Card>
      <p className="text-xs font-semibold tracking-widest text-accent">NAME ENTRY</p>
      <h2 className="mt-1 font-display text-4xl font-extrabold">ネームエントリー</h2>
      <p className="mt-2 text-sm text-muted tabular-nums">
        {pad(score)} · WAVE {String(wave).padStart(2, "0")} · トップ8入り
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {chars.map((ch, i) => (
          <div
            key={i}
            className={`rounded-md border px-1 py-1 ${i === idx ? "border-primary" : "border-line"}`}
          >
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-center text-muted"
              aria-label={`${i + 1}文字目を前へ`}
              onClick={() => {
                setIdx(i);
                setChars((prev) => rotate(prev, i, -1));
              }}
            >
              <ChevronUp className="size-5" />
            </button>
            <p className="py-1 text-center font-display text-4xl">{ch}</p>
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-center text-muted"
              aria-label={`${i + 1}文字目を次へ`}
              onClick={() => {
                setIdx(i);
                setChars((prev) => rotate(prev, i, 1));
              }}
            >
              <ChevronDown className="size-5" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={`${btnPrimary} mt-5 w-full`} onClick={() => onSubmit(chars.join(""))}>
        決定
      </button>
    </Card>
  );
}

function rotate(chars: string[], index: number, dir: number): string[] {
  const next = [...chars];
  const cur = GLYPHS.indexOf(next[index] ?? "A");
  const i = cur < 0 ? 0 : (cur + dir + GLYPHS.length) % GLYPHS.length;
  next[index] = GLYPHS[i] ?? "A";
  return next;
}
