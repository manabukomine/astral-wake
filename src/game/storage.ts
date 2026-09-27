export type ScoreRow = {
  name: string;
  score: number;
  wave: number;
  at: number;
};

export type Settings = {
  muted: boolean;
  shake: boolean;
};

const SCORE_KEY = "astral-wake.scores.v1";
const SETTINGS_KEY = "astral-wake.settings.v1";
const NAME_KEY = "astral-wake.name.v1";
const MAX_ROWS = 8;

type ScoreFile = { version: 1; rows: ScoreRow[] };

function canStore(): boolean {
  return typeof localStorage !== "undefined";
}

function validRow(row: unknown): row is ScoreRow {
  if (!row || typeof row !== "object") return false;
  const r = row as ScoreRow;
  return (
    typeof r.name === "string" &&
    r.name.length > 0 &&
    typeof r.score === "number" &&
    Number.isFinite(r.score) &&
    typeof r.wave === "number" &&
    typeof r.at === "number"
  );
}

export function loadScores(): ScoreRow[] {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.rows)) return [];
    return parsed.rows.filter(validRow).slice(0, MAX_ROWS);
  } catch {
    return [];
  }
}

export function qualifies(score: number, rows: ScoreRow[]): boolean {
  if (score <= 0) return false;
  if (rows.length < MAX_ROWS) return true;
  return score > rows[rows.length - 1].score;
}

export function saveScore(row: ScoreRow): ScoreRow[] {
  const next = [...loadScores(), row]
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, MAX_ROWS);
  if (canStore()) {
    try {
      const file: ScoreFile = { version: 1, rows: next };
      localStorage.setItem(SCORE_KEY, JSON.stringify(file));
    } catch {
      /* quota / private mode */
    }
  }
  return next;
}

export function loadSettings(): Settings {
  const fallback: Settings = { muted: false, shake: true };
  if (!canStore()) return fallback;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Settings> & { version?: number };
    if (!parsed || parsed.version !== 1) return fallback;
    return {
      muted: Boolean(parsed.muted),
      shake: parsed.shake !== false,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  if (!canStore()) return;
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, muted: settings.muted, shake: settings.shake }),
    );
  } catch {
    /* ignore */
  }
}

export function loadName(): string {
  if (!canStore()) return "ACE";
  const raw = localStorage.getItem(NAME_KEY);
  if (!raw) return "ACE";
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (clean + "AAA").slice(0, 3);
}

export function saveName(name: string): void {
  if (!canStore()) return;
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 3));
  } catch {
    /* ignore */
  }
}
