export type Phase =
  | "lobby"
  | "question"
  | "buzzed"
  | "timeout"
  | "reveal"
  | "wheel"
  | "ready"
  | "tradeChoice"
  | "countdown"
  | "ended"
  | "minigame";

export type ModifierKey =
  | "doble"
  | "triple"
  | "jackpot"
  | "trueque"
  | "regalo"
  | "demora"
  | "mudo";

export interface ModifierDef {
  key: ModifierKey;
  label: string;
  description: string;
  color: string;
  image: string;
}

export const MODIFIERS: ModifierDef[] = [
  { key: "doble",   label: "DOUBLE",  description: "Your score x2",        color: "#e8a838", image: "/marco/wheel/doble.png" },
  { key: "triple",  label: "TRIPLE",  description: "Your score x3",        color: "#e07a5f", image: "/marco/wheel/triple.png" },
  { key: "jackpot", label: "JACKPOT", description: "+5000 points!",         color: "#7ba84c", image: "/marco/wheel/jackpot.png" },
  { key: "trueque", label: "TRADE",   description: "Swap with another team", color: "#9b5c8f", image: "/marco/wheel/robo.png" },
  { key: "regalo",  label: "GIFT",    description: "+200 to everyone",      color: "#4a9b8e", image: "/marco/wheel/todos.png" },
  { key: "demora",  label: "DELAY",   description: "4 second delay",        color: "#e35a3c", image: "/marco/wheel/peligro.png" },
  { key: "mudo",    label: "SILENT",  description: "Timer hidden",          color: "#d4a13a", image: "/marco/wheel/chisme.png" },
];

export interface Team {
  id: number;
  name: string;
  score: number;
  connected: boolean;
}

export type MinigameKind = "flappy" | "draw" | "banana" | "geom";

export interface GeomCube {
  teamId: number;
  y: number;        // 0 = ground, 1 = ceiling
  vy: number;
  onGround: boolean;
  alive: boolean;
  scoreMs: number;
  rotation: number; // visual rotation, accumulates while airborne
}

export type GeomObstacleType = "spike" | "ceiling_spike" | "block" | "bounce_pad" | "bounce_orb";

export interface GeomObstacle {
  id: number;
  x: number;          // 0 left edge, 1 right edge
  y: number;          // base y (for blocks: top of block; for spikes: where the tip sits)
  type: GeomObstacleType;
  consumed?: boolean; // for bounce orbs once used
}

export type BananaStatus =
  | "enter"      // banana man slides up
  | "dialog1"    // "Time to remove points..."
  | "dialog2"    // "I think I'll remove 50,000,000,000 points."
  | "roulette"   // cycling team highlight
  | "reveal"     // landed on victim, points deducted
  | "laugh"      // "Team X. Haw haw haw!"
  | "exit";      // banana man slides out

export interface FlappyBird {
  teamId: number;
  y: number;       // 0 = top, 1 = bottom
  vy: number;      // velocity (per second)
  alive: boolean;
  scoreMs: number; // frozen at death; equals elapsedMs if still alive
}

export interface FlappyPipe {
  id: number;
  x: number;       // 0 = left edge, 1 = right edge
  gapY: number;    // center of gap (0..1)
}

export interface MinigameState {
  kind: MinigameKind;
  status: "intro" | "playing" | "over" | "study" | "drawing" | "judging" | BananaStatus;
  countdownMs: number; // for intro / study / drawing / banana phase timers
  elapsedMs: number;   // since playing started (flappy)
  // Flappy-specific
  birds: FlappyBird[];
  pipes: FlappyPipe[];
  // Draw-specific: teamId -> data URL of submitted drawing
  drawings: Record<number, string>;
  // Banana-specific
  bananaVictimId: number | null;
  bananaDeduction: number;
  // Geom-specific
  cubes: GeomCube[];
  obstacles: GeomObstacle[];
}

export interface GameState {
  phase: Phase;
  teams: Team[];
  questionIdx: number;
  question: string | null;
  timerMs: number;
  buzzedTeamId: number | null;
  lastJudgment: {
    teamId: number;
    correct: boolean;
    pointsDelta: number;
    modifier: ModifierKey | null;
  } | null;
  questionsAnswered: number;
  modifier: ModifierKey | null;
  wheelResult: ModifierKey | null;
  // Teams that have already buzzed wrong this round (locked out for the round)
  answeredWrong: number[];
  // DELAY modifier: one random team's buzzer is locked for X ms at the start
  lockedTeamId: number | null;
  lockedMs: number;
  // Team that won the most recent question — gets to spin the next wheel
  lastWinnerTeamId: number | null;
  // Active minigame state — null when not in minigame phase
  minigame: MinigameState | null;
  // Counter incremented every minigame; used to cycle between flappy / draw / etc.
  minigameCount: number;
  // When true, the next `next` advance skips the wheel/minigame trigger check
  // (used after wheel-triggered trades and after minigame wins).
  bypassNextRoundCheck: boolean;
}

export type ClientMsg =
  | { type: "join"; name: string }
  | { type: "buzz" }
  | { type: "start" }
  | { type: "next" }
  | { type: "judge"; correct: boolean }
  | { type: "spinWheel" }
  | { type: "wheelDone" }
  | { type: "tradeChoice"; targetTeamId: number }
  | { type: "endGame" }
  | { type: "setScore"; teamId: number; score: number }
  | { type: "setQuestionsAnswered"; count: number }
  | { type: "flap" }
  | { type: "jump" }
  | { type: "submitDrawing"; dataUrl: string }
  | { type: "judgeDraw"; winnerTeamId: number }
  | { type: "resume"; token: string }
  | { type: "reset" };

export type ServerMsg =
  | { type: "state"; state: GameState; youAreTeamId: number | null }
  | { type: "token"; token: string }
  | { type: "error"; message: string };
