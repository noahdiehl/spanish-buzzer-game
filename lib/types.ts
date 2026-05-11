export type Phase =
  | "lobby"
  | "question"
  | "buzzed"
  | "timeout"
  | "reveal"
  | "wheel"
  | "ready"
  | "tradeChoice";

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
  | { type: "reset" };

export type ServerMsg =
  | { type: "state"; state: GameState; youAreTeamId: number | null }
  | { type: "error"; message: string };
