import { createServer } from "http";
import { parse } from "url";
import { randomUUID } from "crypto";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMsg, GameState, ServerMsg, Team, ModifierKey, MinigameState, FlappyPipe, GeomObstacleType } from "./lib/types";
import { MODIFIERS } from "./lib/types";
import { QUESTIONS } from "./lib/questions";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const TIMER_MS = 15000;
const TICK_MS = 100;
const DEMORA_MS = 4000;
const COUNTDOWN_MS = 3000;
const WHEEL_EVERY = 3;
const MINIGAME_EVERY = 5;

// Flappy bird constants (normalized 0..1)
const FLAPPY_TICK_MS = 33;
const FLAPPY_INTRO_MS = 3000;
const FLAPPY_MAX_MS = 60000;
const FLAPPY_GRAVITY = 1.6;       // per second
const FLAPPY_JUMP_VY = -0.6;
const FLAPPY_PIPE_SPEED = 0.22;   // per second
const FLAPPY_PIPE_GAP = 0.38;
const FLAPPY_PIPE_INTERVAL_MS = 1300;
const FLAPPY_FIRST_PIPE_DELAY_MS = 900;
const FLAPPY_MAX_GAP_DELTA = 0.22; // max change in gap-Y between consecutive pipes
const FLAPPY_BIRD_X = 0.3;
const FLAPPY_BIRD_RADIUS = 0.04;
const FLAPPY_PIPE_WIDTH = 0.09;

const DRAW_STUDY_MS = 5000;
const DRAW_DRAWING_MS = 20000;
const DRAW_WINNER_POINTS = 10000;

const MINIGAME_CYCLE: ("flappy" | "draw" | "banana" | "geom" | "felix")[] = [
  "flappy", "draw", "banana", "geom", "felix",
];

// === DESTROY FELIX constants ===
const FELIX_TICK_MS = 60;
const FELIX_INTRO_MS = 1800;
const FELIX_SHOOT1_MS = 14000;
const FELIX_QUESTION_THROW_MS = 2400;
const FELIX_QUESTION_COUNTDOWN_MS = 3200;
const FELIX_QUESTION_MAX_MS = 15000;
const FELIX_SHOOT2_MS = 6000;
const FELIX_DEATH_MS = 2800;
const FELIX_OVER_MS = 800;
const FELIX_HP_MAX = 600;
const FELIX_HP_FLOOR_SHOOT1 = 180;
const FELIX_SHOT_COOLDOWN_MS = 140;
const FELIX_SHOT_DAMAGE = 1;
const FELIX_FLASH_MS = 130;
const FELIX_CORRECT_BONUS = 10000;
const FELIX_AUTO_REJECT_MS = 1100; // Felix auto-rejects this fast — host can't even click

// === GEOMETRY DASH constants ===
const GEOM_TICK_MS = 33;
const GEOM_INTRO_MS = 3000;
const GEOM_MAX_MS = 60000;
const GEOM_GRAVITY = 4.2;            // per second (downward)
const GEOM_JUMP_VY = 1.55;
const GEOM_PAD_VY = 2.3;
const GEOM_ORB_VY = 1.8;
const GEOM_BASE_SPEED = 0.45;        // base obstacle scroll speed (per second)
const GEOM_CUBE_X = 0.22;
// World coords aren't aspect-corrected, so we pick W and H separately
// so the rendered cube looks roughly square in pixels (host arena is 900x506).
const GEOM_CUBE_W = 0.06;            // world-x width
const GEOM_CUBE_H = 0.10;            // world-y height
const GEOM_ORB_RADIUS = 0.07;        // how close cube must be to consume orb
const GEOM_GROUND_Y = 0;             // bottom
const GEOM_CEILING_Y = 1;
const GEOM_BASE_SPAWN_MS = 1100;     // base interval between obstacles

// Banana event timings
const BANANA_ENTER_MS = 900;
const BANANA_DIALOG1_MS = 2400;
const BANANA_DIALOG2_MS = 2800;
const BANANA_ROULETTE_MS = 3500;
const BANANA_REVEAL_MS = 1300;
const BANANA_LAUGH_MS = 2400;
const BANANA_EXIT_MS = 900;
const BANANA_DEDUCTION = 50_000_000;

interface ClientInfo {
  ws: WebSocket;
  teamId: number | null;
  token: string | null;
  lastShotAt?: number;
}

const clients = new Set<ClientInfo>();
// token -> teamId, persists across player disconnects so refresh restores the slot
const tokenToTeam = new Map<string, number>();

function freshState(): GameState {
  return {
    phase: "lobby",
    teams: [],
    questionIdx: 0,
    question: null,
    timerMs: TIMER_MS,
    buzzedTeamId: null,
    lastJudgment: null,
    questionsAnswered: 0,
    modifier: null,
    wheelResult: null,
    answeredWrong: [],
    lockedTeamId: null,
    lockedMs: 0,
    lastWinnerTeamId: null,
    minigame: null,
    minigameCount: 0,
    bypassNextRoundCheck: false,
  };
}

const state: GameState = freshState();

let tickInterval: NodeJS.Timeout | null = null;

function broadcast() {
  for (const c of clients) {
    const msg: ServerMsg = { type: "state", state, youAreTeamId: c.teamId };
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(JSON.stringify(msg));
    }
  }
}

function stopTimer() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function startTimer(resume: boolean = false) {
  stopTimer();
  if (!resume) state.timerMs = TIMER_MS;
  tickInterval = setInterval(() => {
    state.timerMs -= TICK_MS;
    if (state.lockedTeamId !== null) {
      state.lockedMs -= TICK_MS;
      if (state.lockedMs <= 0) {
        state.lockedMs = 0;
        state.lockedTeamId = null;
      }
    }
    if (state.timerMs <= 0) {
      state.timerMs = 0;
      state.phase = "timeout";
      stopTimer();
    }
    broadcast();
  }, TICK_MS);
}

function startCountdown() {
  stopTimer();
  state.phase = "countdown";
  state.timerMs = COUNTDOWN_MS;
  state.question = QUESTIONS[state.questionIdx] ?? "(no more questions)";
  state.buzzedTeamId = null;
  state.answeredWrong = [];
  state.lockedTeamId = null;
  state.lockedMs = 0;
  tickInterval = setInterval(() => {
    state.timerMs -= TICK_MS;
    if (state.timerMs <= 0) {
      stopTimer();
      _enterQuestionAfterCountdown();
    }
    broadcast();
  }, TICK_MS);
}

function _enterQuestionAfterCountdown() {
  state.phase = "question";
  state.lastJudgment = null;
  if (state.modifier === "demora") {
    // Lock the spinner (the team that won the previous question).
    // Fallback: random team if no winner yet (first round edge case).
    let victimId: number | null = state.lastWinnerTeamId;
    if (victimId === null && state.teams.length > 0) {
      victimId = state.teams[Math.floor(Math.random() * state.teams.length)].id;
    }
    if (victimId !== null) {
      state.lockedTeamId = victimId;
      state.lockedMs = DEMORA_MS;
    } else {
      state.lockedTeamId = null;
      state.lockedMs = 0;
    }
  } else {
    state.lockedTeamId = null;
    state.lockedMs = 0;
  }
  startTimer(false);
}

// ====== FLAPPY BIRD MINIGAME ======

let pipeIdCounter = 0;
let flappyPipeTimer = 0;
let flappyLastGapY = 0.5;

function startMinigame() {
  stopTimer();
  state.phase = "minigame";
  state.question = null;
  state.buzzedTeamId = null;
  state.modifier = null;
  state.wheelResult = null;
  state.answeredWrong = [];
  state.lockedTeamId = null;
  state.lockedMs = 0;

  const kind = MINIGAME_CYCLE[state.minigameCount % MINIGAME_CYCLE.length];
  state.minigameCount += 1;

  if (kind === "flappy") startFlappy();
  else if (kind === "draw") startDraw();
  else if (kind === "banana") startBanana();
  else if (kind === "geom") startGeom();
  else startFelix();
}

function startFlappy() {
  const mg: MinigameState = {
    kind: "flappy",
    status: "intro",
    countdownMs: FLAPPY_INTRO_MS,
    elapsedMs: 0,
    birds: state.teams.map((t) => ({
      teamId: t.id,
      y: 0.5,
      vy: 0,
      alive: true,
      scoreMs: 0,
    })),
    pipes: [],
    drawings: {},
    bananaVictimId: null,
    bananaDeduction: 0,
    cubes: [],
    obstacles: [],
    felixHp: FELIX_HP_MAX,
    felixHpMax: FELIX_HP_MAX,
    felixFlashUntilMs: 0,
    felixShotsTotal: 0,
    felixQuestion: null,
    felixBuzzedWrong: [],
    felixSavedQuestionMs: 0,
    felixRejectionsTotal: 0,
  };
  state.minigame = mg;
  flappyPipeTimer = FLAPPY_PIPE_INTERVAL_MS - FLAPPY_FIRST_PIPE_DELAY_MS;
  pipeIdCounter = 0;
  flappyLastGapY = 0.5;

  tickInterval = setInterval(() => {
    minigameTick();
    broadcast();
  }, FLAPPY_TICK_MS);
}

function startDraw() {
  const mg: MinigameState = {
    kind: "draw",
    status: "study",
    countdownMs: DRAW_STUDY_MS,
    elapsedMs: 0,
    birds: [],
    pipes: [],
    drawings: {},
    bananaVictimId: null,
    bananaDeduction: 0,
    cubes: [],
    obstacles: [],
    felixHp: FELIX_HP_MAX,
    felixHpMax: FELIX_HP_MAX,
    felixFlashUntilMs: 0,
    felixShotsTotal: 0,
    felixQuestion: null,
    felixBuzzedWrong: [],
    felixSavedQuestionMs: 0,
    felixRejectionsTotal: 0,
  };
  state.minigame = mg;

  tickInterval = setInterval(() => {
    drawTick();
    broadcast();
  }, FLAPPY_TICK_MS);
}

// ============================================================
//  GEOMETRY DASH MINIGAME
// ============================================================

let geomObstacleId = 0;
let geomSpawnTimer = 0;

function startGeom() {
  const mg: MinigameState = {
    kind: "geom",
    status: "intro",
    countdownMs: GEOM_INTRO_MS,
    elapsedMs: 0,
    birds: [],
    pipes: [],
    drawings: {},
    bananaVictimId: null,
    bananaDeduction: 0,
    cubes: state.teams.map((t) => ({
      teamId: t.id,
      y: 0,
      vy: 0,
      onGround: true,
      alive: true,
      scoreMs: 0,
      rotation: 0,
    })),
    obstacles: [],
    felixHp: FELIX_HP_MAX,
    felixHpMax: FELIX_HP_MAX,
    felixFlashUntilMs: 0,
    felixShotsTotal: 0,
    felixQuestion: null,
    felixBuzzedWrong: [],
    felixSavedQuestionMs: 0,
    felixRejectionsTotal: 0,
  };
  state.minigame = mg;
  geomObstacleId = 0;
  geomSpawnTimer = 700; // first obstacle ~400ms after GO

  tickInterval = setInterval(() => {
    geomTick();
    broadcast();
  }, GEOM_TICK_MS);
}

function geomCurrentSpeed(elapsedMs: number): number {
  // Scale from 1x to 1.6x over the full game duration.
  const t = Math.min(1, elapsedMs / GEOM_MAX_MS);
  return GEOM_BASE_SPEED * (1 + 0.6 * t);
}

function geomCurrentSpawnInterval(elapsedMs: number): number {
  // Tighter over time: 1100ms → 600ms.
  const t = Math.min(1, elapsedMs / GEOM_MAX_MS);
  return GEOM_BASE_SPAWN_MS * (1 - 0.45 * t);
}

function pickObstacleType(elapsedMs: number): GeomObstacleType {
  const t = Math.min(1, elapsedMs / GEOM_MAX_MS);
  // Weighted random — early levels favor spikes, later ones mix more.
  const weights: Record<GeomObstacleType, number> = {
    spike: 4,
    block: 2 + t * 2,
    bounce_pad: 1 + t * 1,
    bounce_orb: 1 + t * 2,
    ceiling_spike: t * 1.5,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return k as GeomObstacleType;
  }
  return "spike";
}

function spawnObstacle(elapsedMs: number) {
  const mg = state.minigame;
  if (!mg) return;
  const type = pickObstacleType(elapsedMs);
  let y = 0;
  if (type === "ceiling_spike") {
    y = 1;
  } else if (type === "bounce_orb") {
    // Snap orb to grid cells (cube heights), at 3 or 4 cells up
    const cells = 3 + Math.floor(Math.random() * 2);
    y = Math.min(0.92, cells * GEOM_CUBE_H);
  } else if (type === "block") {
    // Block height is an integer multiple of cube height (grid stacks)
    const cells = 1 + Math.floor(Math.random() * 2); // 1 or 2 cells tall
    y = cells * GEOM_CUBE_H;
  }
  mg.obstacles.push({ id: geomObstacleId++, x: 1.1, y, type });
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function geomTick() {
  const mg = state.minigame;
  if (!mg || mg.kind !== "geom") return;
  const dt = GEOM_TICK_MS / 1000;

  if (mg.status === "intro") {
    mg.countdownMs -= GEOM_TICK_MS;
    if (mg.countdownMs <= 0) {
      mg.status = "playing";
      mg.countdownMs = 0;
    }
    return;
  }
  if (mg.status !== "playing") return;

  mg.elapsedMs += GEOM_TICK_MS;
  const speed = geomCurrentSpeed(mg.elapsedMs);

  // Physics for cubes
  for (const cube of mg.cubes) {
    if (!cube.alive) continue;
    cube.vy -= GEOM_GRAVITY * dt;
    cube.y += cube.vy * dt;
    cube.onGround = false;
    if (cube.y <= GEOM_GROUND_Y) {
      cube.y = GEOM_GROUND_Y;
      cube.vy = 0;
      cube.onGround = true;
      // Snap rotation to nearest 90° on landing
      cube.rotation = Math.round(cube.rotation / 90) * 90;
    }
    if (cube.y > GEOM_CEILING_Y) {
      // Hit ceiling — die
      cube.alive = false;
      cube.scoreMs = mg.elapsedMs;
      continue;
    }
    // Rotate while airborne
    if (!cube.onGround) {
      cube.rotation += 360 * dt * 1.6; // ~1.6 rotations per second
    }
  }

  // Move obstacles
  for (const o of mg.obstacles) o.x -= speed * dt;
  mg.obstacles = mg.obstacles.filter((o) => o.x > -0.2);

  // Spawn schedule
  geomSpawnTimer -= GEOM_TICK_MS;
  if (geomSpawnTimer <= 0) {
    spawnObstacle(mg.elapsedMs);
    geomSpawnTimer = geomCurrentSpawnInterval(mg.elapsedMs);
  }

  // Collisions / interactions
  for (const cube of mg.cubes) {
    if (!cube.alive) continue;
    const cx = GEOM_CUBE_X - GEOM_CUBE_W / 2;
    const cy = cube.y; // bottom of cube
    const cw = GEOM_CUBE_W;
    const ch = GEOM_CUBE_H;

    for (const o of mg.obstacles) {
      switch (o.type) {
        case "spike": {
          // Ground spike: 1 cell wide, 1 cell tall (matches cube). Base at world y=0.
          // Slight forgiveness inset (~15% smaller hitbox than visual).
          const inset = 0.012;
          if (rectsOverlap(cx, cy, cw, ch,
              o.x - GEOM_CUBE_W / 2 + inset, 0,
              GEOM_CUBE_W - 2 * inset, GEOM_CUBE_H - inset)) {
            cube.alive = false;
            cube.scoreMs = mg.elapsedMs;
          }
          break;
        }
        case "ceiling_spike": {
          // Ceiling spike: base at top (y=1), tip down — matches cube size.
          const inset = 0.012;
          if (rectsOverlap(cx, cy, cw, ch,
              o.x - GEOM_CUBE_W / 2 + inset, 1 - GEOM_CUBE_H + inset,
              GEOM_CUBE_W - 2 * inset, GEOM_CUBE_H - inset)) {
            cube.alive = false;
            cube.scoreMs = mg.elapsedMs;
          }
          break;
        }
        case "block": {
          // Solid block: from ground up to o.y. Cube can land on top.
          const blockH = o.y;
          const bx = o.x - GEOM_CUBE_W / 2;
          const bw = GEOM_CUBE_W;
          if (rectsOverlap(cx, cy, cw, ch, bx, 0, bw, blockH)) {
            const cubeBottom = cy;
            if (cube.vy <= 0 && cubeBottom + 0.04 >= blockH) {
              cube.y = blockH;
              cube.vy = 0;
              cube.onGround = true;
              cube.rotation = Math.round(cube.rotation / 90) * 90;
            } else {
              cube.alive = false;
              cube.scoreMs = mg.elapsedMs;
            }
          }
          break;
        }
        case "bounce_pad": {
          // Pad on ground — touching top = big launch.
          const px = o.x - GEOM_CUBE_W / 2;
          const pw = GEOM_CUBE_W;
          if (rectsOverlap(cx, cy, cw, ch, px, 0, pw, 0.035)) {
            cube.vy = GEOM_PAD_VY;
            cube.onGround = false;
          }
          break;
        }
        case "bounce_orb": {
          // Orb consumed on jump input when nearby — handled in "jump" handler.
          // Just visual here.
          break;
        }
      }
      if (!cube.alive) break;
    }
  }

  // Update aliveMs for living cubes
  for (const cube of mg.cubes) {
    if (cube.alive) cube.scoreMs = mg.elapsedMs;
  }

  // End conditions
  const aliveCount = mg.cubes.filter((c) => c.alive).length;
  if (aliveCount === 0 || mg.elapsedMs >= GEOM_MAX_MS) {
    endGeom();
  }
}

function endGeom() {
  const mg = state.minigame;
  if (!mg) return;
  mg.status = "over";
  stopTimer();
  const ranked = [...mg.cubes].sort((a, b) => b.scoreMs - a.scoreMs);
  const awards = [10000, 5000, 2000, 0];
  ranked.forEach((c, i) => {
    const team = state.teams.find((t) => t.id === c.teamId);
    if (team) team.score += awards[i] ?? 0;
  });
  broadcast();
  setTimeout(() => {
    if (state.phase === "minigame") finalizeMinigameWin(ranked[0]?.teamId ?? null, awards[0]);
  }, 5000);
}

// ============================================================
//  DESTROY FELIX MINIGAME
// ============================================================

function startFelix() {
  stopTimer();
  state.phase = "minigame";
  state.question = null;
  state.buzzedTeamId = null;
  state.modifier = null;
  state.wheelResult = null;
  state.answeredWrong = [];
  state.lockedTeamId = null;
  state.lockedMs = 0;

  const mg: MinigameState = {
    kind: "felix",
    status: "intro",
    countdownMs: FELIX_INTRO_MS,
    elapsedMs: 0,
    birds: [],
    pipes: [],
    drawings: {},
    bananaVictimId: null,
    bananaDeduction: 0,
    cubes: [],
    obstacles: [],
    felixHp: FELIX_HP_MAX,
    felixHpMax: FELIX_HP_MAX,
    felixFlashUntilMs: 0,
    felixShotsTotal: 0,
    felixQuestion: null,
    felixBuzzedWrong: [],
    felixSavedQuestionMs: 0,
    felixRejectionsTotal: 0,
  };
  state.minigame = mg;

  tickInterval = setInterval(() => {
    felixTick();
    broadcast();
  }, FELIX_TICK_MS);
}

function felixTick() {
  const mg = state.minigame;
  if (!mg || mg.kind !== "felix") return;
  mg.elapsedMs += FELIX_TICK_MS;
  mg.countdownMs -= FELIX_TICK_MS;
  if (mg.countdownMs > 0) return;

  // Phase transition
  switch (mg.status) {
    case "intro":
      mg.status = "shoot1";
      mg.countdownMs = FELIX_SHOOT1_MS;
      break;
    case "shoot1":
      mg.status = "questionThrow";
      mg.countdownMs = FELIX_QUESTION_THROW_MS;
      mg.felixQuestion = QUESTIONS[state.questionIdx] ?? "(no question)";
      break;
    case "questionThrow":
      mg.status = "questionCountdown";
      mg.countdownMs = FELIX_QUESTION_COUNTDOWN_MS;
      break;
    case "questionCountdown":
      mg.status = "questionPlay";
      mg.countdownMs = FELIX_QUESTION_MAX_MS;
      state.buzzedTeamId = null;
      state.answeredWrong = [];
      break;
    case "questionPlay":
      // Time ran out without a buzz — move on to final shoot.
      mg.status = "shoot2";
      mg.countdownMs = FELIX_SHOOT2_MS;
      break;
    case "questionBuzzed": {
      // Felix slams the answer away — auto-reject (host can't beat him).
      const winnerId = state.buzzedTeamId;
      if (winnerId !== null && !mg.felixBuzzedWrong.includes(winnerId)) {
        mg.felixBuzzedWrong.push(winnerId);
      }
      mg.felixRejectionsTotal += 1;
      state.buzzedTeamId = null;
      const remaining = state.teams.length - mg.felixBuzzedWrong.length;
      if (remaining <= 0) {
        mg.status = "shoot2";
        mg.countdownMs = FELIX_SHOOT2_MS;
      } else {
        mg.status = "questionPlay";
        // Restore what was left of the play timer (minus a small penalty)
        mg.countdownMs = Math.max(2000, mg.felixSavedQuestionMs - 500);
      }
      break;
    }
    case "shoot2":
      mg.status = "death";
      mg.countdownMs = FELIX_DEATH_MS;
      mg.felixHp = 0;
      break;
    case "death":
      mg.status = "felixOver";
      mg.countdownMs = FELIX_OVER_MS;
      break;
    case "felixOver":
      // This is the LAST minigame. End the game.
      stopTimer();
      state.minigame = null;
      state.phase = "ended";
      state.lastJudgment = null;
      break;
  }
}

function startBanana() {
  // Pick a victim upfront — the roulette animates and lands on this team.
  const victim = state.teams.length > 0
    ? state.teams[Math.floor(Math.random() * state.teams.length)]
    : null;
  const mg: MinigameState = {
    kind: "banana",
    status: "enter",
    countdownMs: BANANA_ENTER_MS,
    elapsedMs: 0,
    birds: [],
    pipes: [],
    drawings: {},
    bananaVictimId: victim?.id ?? null,
    bananaDeduction: BANANA_DEDUCTION,
  };
  state.minigame = mg;

  tickInterval = setInterval(() => {
    bananaTick();
    broadcast();
  }, FLAPPY_TICK_MS);
}

function bananaTick() {
  const mg = state.minigame;
  if (!mg || mg.kind !== "banana") return;
  mg.countdownMs -= FLAPPY_TICK_MS;
  if (mg.countdownMs > 0) return;

  // Phase transition
  switch (mg.status) {
    case "enter":
      mg.status = "dialog1";
      mg.countdownMs = BANANA_DIALOG1_MS;
      break;
    case "dialog1":
      mg.status = "dialog2";
      mg.countdownMs = BANANA_DIALOG2_MS;
      break;
    case "dialog2":
      mg.status = "roulette";
      mg.countdownMs = BANANA_ROULETTE_MS;
      break;
    case "roulette":
      // Apply deduction server-side — no floor, can go deep into the negative.
      if (mg.bananaVictimId !== null) {
        const victim = state.teams.find((t) => t.id === mg.bananaVictimId);
        if (victim) victim.score -= mg.bananaDeduction;
      }
      mg.status = "reveal";
      mg.countdownMs = BANANA_REVEAL_MS;
      break;
    case "reveal":
      mg.status = "laugh";
      mg.countdownMs = BANANA_LAUGH_MS;
      break;
    case "laugh":
      mg.status = "exit";
      mg.countdownMs = BANANA_EXIT_MS;
      break;
    case "exit":
      // Done — go through reveal so the team boxes slide back in and the
      // victim's box gets the negative -deduction animation.
      stopTimer();
      if (mg.bananaVictimId !== null) {
        state.lastJudgment = {
          teamId: mg.bananaVictimId,
          correct: false,
          pointsDelta: -mg.bananaDeduction,
          modifier: null,
        };
      } else {
        state.lastJudgment = null;
      }
      state.minigame = null;
      state.bypassNextRoundCheck = true;
      state.phase = "reveal";
      break;
  }
}

function drawTick() {
  const mg = state.minigame;
  if (!mg || mg.kind !== "draw") return;
  if (mg.status === "study") {
    mg.countdownMs -= FLAPPY_TICK_MS;
    if (mg.countdownMs <= 0) {
      mg.status = "drawing";
      mg.countdownMs = DRAW_DRAWING_MS;
    }
    return;
  }
  if (mg.status === "drawing") {
    mg.countdownMs -= FLAPPY_TICK_MS;
    if (mg.countdownMs <= 0) {
      mg.status = "judging";
      mg.countdownMs = 0;
      stopTimer(); // host now picks winner manually
    }
    return;
  }
}

function minigameTick() {
  const mg = state.minigame;
  if (!mg) return;
  const dt = FLAPPY_TICK_MS / 1000;

  if (mg.status === "intro") {
    mg.countdownMs -= FLAPPY_TICK_MS;
    if (mg.countdownMs <= 0) {
      mg.status = "playing";
      mg.countdownMs = 0;
    }
    return;
  }

  if (mg.status !== "playing") return;

  mg.elapsedMs += FLAPPY_TICK_MS;

  // Physics for each alive bird
  for (const bird of mg.birds) {
    if (!bird.alive) continue;
    bird.vy += FLAPPY_GRAVITY * dt;
    bird.y += bird.vy * dt;
    // Ground / ceiling
    if (bird.y >= 1 || bird.y <= 0) {
      bird.alive = false;
      bird.y = Math.max(0, Math.min(1, bird.y));
      bird.scoreMs = mg.elapsedMs;
    }
  }

  // Move pipes left
  for (const pipe of mg.pipes) pipe.x -= FLAPPY_PIPE_SPEED * dt;
  mg.pipes = mg.pipes.filter((p) => p.x > -0.2);

  // Spawn pipes
  flappyPipeTimer += FLAPPY_TICK_MS;
  if (flappyPipeTimer >= FLAPPY_PIPE_INTERVAL_MS) {
    flappyPipeTimer = 0;
    // Constrain new gap-Y so consecutive pipes are reachable
    const lo = Math.max(0.22, flappyLastGapY - FLAPPY_MAX_GAP_DELTA);
    const hi = Math.min(0.78, flappyLastGapY + FLAPPY_MAX_GAP_DELTA);
    const newGapY = lo + Math.random() * (hi - lo);
    flappyLastGapY = newGapY;
    mg.pipes.push({
      id: pipeIdCounter++,
      x: 1.15,
      gapY: newGapY,
    });
  }

  // Collisions
  for (const bird of mg.birds) {
    if (!bird.alive) continue;
    for (const pipe of mg.pipes) {
      // Bird x range vs pipe x range
      const bxL = FLAPPY_BIRD_X - FLAPPY_BIRD_RADIUS;
      const bxR = FLAPPY_BIRD_X + FLAPPY_BIRD_RADIUS;
      const pxL = pipe.x - FLAPPY_PIPE_WIDTH / 2;
      const pxR = pipe.x + FLAPPY_PIPE_WIDTH / 2;
      if (bxR > pxL && bxL < pxR) {
        const gapTop = pipe.gapY - FLAPPY_PIPE_GAP / 2;
        const gapBot = pipe.gapY + FLAPPY_PIPE_GAP / 2;
        if (bird.y - FLAPPY_BIRD_RADIUS < gapTop || bird.y + FLAPPY_BIRD_RADIUS > gapBot) {
          bird.alive = false;
          bird.scoreMs = mg.elapsedMs;
          break;
        }
      }
    }
  }

  // Keep alive birds' scoreMs updated to current elapsed
  for (const bird of mg.birds) {
    if (bird.alive) bird.scoreMs = mg.elapsedMs;
  }

  // End conditions
  const aliveCount = mg.birds.filter((b) => b.alive).length;
  if (aliveCount === 0 || mg.elapsedMs >= FLAPPY_MAX_MS) {
    endMinigame();
  }
}

function endMinigame() {
  const mg = state.minigame;
  if (!mg) return;
  mg.status = "over";
  stopTimer();
  // Award points by survival time rank
  const ranked = [...mg.birds].sort((a, b) => b.scoreMs - a.scoreMs);
  const awards = [10000, 5000, 2000, 0];
  ranked.forEach((b, i) => {
    const team = state.teams.find((t) => t.id === b.teamId);
    if (team) team.score += awards[i] ?? 0;
  });
  broadcast();
  // Auto-advance to next question after 5s
  setTimeout(() => {
    if (state.phase === "minigame") finalizeMinigameWin(ranked[0]?.teamId ?? null, awards[0]);
  }, 5000);
}

function finalizeMinigameWin(winnerTeamId: number | null, points: number) {
  state.minigame = null;
  if (winnerTeamId !== null) {
    const team = state.teams.find((t) => t.id === winnerTeamId);
    if (team) {
      state.lastWinnerTeamId = winnerTeamId;
      state.lastJudgment = {
        teamId: winnerTeamId,
        correct: true,
        pointsDelta: points,
        modifier: null,
      };
    }
  }
  state.phase = "reveal";
  state.bypassNextRoundCheck = true;
  broadcast();
}

// ====== END FLAPPY BIRD MINIGAME ======

function applyCorrectScore(team: Team, mod: ModifierKey | null) {
  switch (mod) {
    case "doble":   team.score = team.score * 2; break;
    case "triple":  team.score = team.score * 3; break;
    case "jackpot": team.score += 5000; break;
    default:        team.score += 500; break;
  }
}

function startQuestion() {
  // Always go through the 3-second countdown so scores can slide out etc.
  startCountdown();
}

function beginNextRound() {
  // Minigame takes priority over wheel
  if (state.questionsAnswered > 0 && state.questionsAnswered % MINIGAME_EVERY === 0) {
    startMinigame();
    return;
  }
  if (state.questionsAnswered > 0 && state.questionsAnswered % WHEEL_EVERY === 0) {
    state.phase = "wheel";
    state.wheelResult = null;
    state.question = null;
    stopTimer();
    return;
  }
  startQuestion();
}

function advanceToNextQuestion() {
  state.questionIdx = (state.questionIdx + 1) % QUESTIONS.length;
  state.buzzedTeamId = null;
  state.lastJudgment = null;
  state.answeredWrong = [];
  beginNextRound();
}

function applyImmediateModifiers() {
  // GIFT: +200 to everyone, skip the question entirely.
  if (state.modifier === "regalo") {
    for (const t of state.teams) t.score += 200;
    state.lastJudgment = null;
    state.modifier = null;
    state.questionsAnswered += 1;
    advanceToNextQuestion();
    return true;
  }
  return false;
}

function endRoundNoWinner() {
  stopTimer();
  state.phase = "timeout";
  broadcast();
}

function handleMessage(client: ClientInfo, msg: ClientMsg) {
  switch (msg.type) {
    case "join": {
      if (client.teamId !== null) {
        const t = state.teams.find((x) => x.id === client.teamId);
        if (t) t.name = msg.name.slice(0, 12) || t.name;
        broadcast();
        return;
      }
      if (state.teams.length >= 4) {
        const err: ServerMsg = { type: "error", message: "Game full (4 teams already joined)" };
        client.ws.send(JSON.stringify(err));
        return;
      }
      const id = state.teams.length;
      const team: Team = {
        id,
        name: msg.name.slice(0, 12) || `Team ${id + 1}`,
        score: 0,
        connected: true,
      };
      state.teams.push(team);
      client.teamId = id;
      // Issue a reconnect token
      const token = randomUUID();
      client.token = token;
      tokenToTeam.set(token, id);
      const tokenMsg: ServerMsg = { type: "token", token };
      client.ws.send(JSON.stringify(tokenMsg));
      broadcast();
      return;
    }
    case "resume": {
      if (client.teamId !== null) return; // already attached
      const teamId = tokenToTeam.get(msg.token);
      if (teamId === undefined) return; // bad token
      const team = state.teams.find((t) => t.id === teamId);
      if (!team) {
        tokenToTeam.delete(msg.token);
        return;
      }
      client.teamId = teamId;
      client.token = msg.token;
      team.connected = true;
      broadcast();
      return;
    }
    case "flap": {
      if (state.phase !== "minigame" || !state.minigame) return;
      if (state.minigame.status !== "playing") return;
      if (client.teamId === null) return;
      const bird = state.minigame.birds.find((b) => b.teamId === client.teamId);
      if (bird && bird.alive) bird.vy = FLAPPY_JUMP_VY;
      return;
    }
    case "shoot": {
      if (state.phase !== "minigame" || !state.minigame) return;
      if (state.minigame.kind !== "felix") return;
      const status = state.minigame.status;
      if (status !== "shoot1" && status !== "shoot2") return;
      if (client.teamId === null) return;
      // Rate limit per player
      const now = Date.now();
      if (client.lastShotAt && now - client.lastShotAt < FELIX_SHOT_COOLDOWN_MS) return;
      client.lastShotAt = now;
      // Apply damage (with floor during shoot1)
      const floor = status === "shoot1" ? FELIX_HP_FLOOR_SHOOT1 : 0;
      state.minigame.felixHp = Math.max(floor, state.minigame.felixHp - FELIX_SHOT_DAMAGE);
      state.minigame.felixFlashUntilMs = state.minigame.elapsedMs + FELIX_FLASH_MS;
      state.minigame.felixShotsTotal += 1;
      return;
    }
    case "jump": {
      if (state.phase !== "minigame" || !state.minigame) return;
      if (state.minigame.kind !== "geom") return;
      if (state.minigame.status !== "playing") return;
      if (client.teamId === null) return;
      const cube = state.minigame.cubes.find((c) => c.teamId === client.teamId);
      if (!cube || !cube.alive) return;
      if (cube.onGround) {
        cube.vy = GEOM_JUMP_VY;
        cube.onGround = false;
        return;
      }
      // Air tap: consume nearest unused bounce orb within range.
      const cubeCx = GEOM_CUBE_X;
      const cubeCy = cube.y + GEOM_CUBE_H / 2;
      let bestOrb: typeof state.minigame.obstacles[number] | null = null;
      let bestDist = Infinity;
      for (const o of state.minigame.obstacles) {
        if (o.type !== "bounce_orb" || o.consumed) continue;
        const dx = o.x - cubeCx;
        const dy = o.y - cubeCy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < GEOM_ORB_RADIUS && d < bestDist) {
          bestDist = d;
          bestOrb = o;
        }
      }
      if (bestOrb) {
        bestOrb.consumed = true;
        cube.vy = GEOM_ORB_VY;
      }
      return;
    }
    case "submitDrawing": {
      if (state.phase !== "minigame" || !state.minigame) return;
      if (state.minigame.kind !== "draw") return;
      if (client.teamId === null) return;
      // Cap size to avoid abuse (rough check, ~500KB)
      if (typeof msg.dataUrl !== "string" || msg.dataUrl.length > 500_000) return;
      state.minigame.drawings[client.teamId] = msg.dataUrl;
      broadcast();
      return;
    }
    case "judgeDraw": {
      if (state.phase !== "minigame" || !state.minigame) return;
      if (state.minigame.kind !== "draw" || state.minigame.status !== "judging") return;
      const winner = state.teams.find((t) => t.id === msg.winnerTeamId);
      if (!winner) return;
      winner.score += DRAW_WINNER_POINTS;
      finalizeMinigameWin(winner.id, DRAW_WINNER_POINTS);
      return;
    }
    case "endGame": {
      stopTimer();
      state.phase = "ended";
      state.modifier = null;
      state.wheelResult = null;
      state.buzzedTeamId = null;
      state.answeredWrong = [];
      state.lockedTeamId = null;
      state.lockedMs = 0;
      broadcast();
      return;
    }
    case "setQuestionsAnswered": {
      // Dev/testing affordance: jump to a specific question. Aligns the minigame
      // cycle so the NEXT minigame trigger uses the appropriate kind.
      const n = Math.max(0, Math.min(9999, Math.floor(msg.count)));
      stopTimer();
      state.questionsAnswered = n;
      state.minigameCount = Math.floor(n / MINIGAME_EVERY);
      state.questionIdx = n % QUESTIONS.length;
      state.modifier = null;
      state.wheelResult = null;
      state.buzzedTeamId = null;
      state.lastJudgment = null;
      state.answeredWrong = [];
      state.lockedTeamId = null;
      state.lockedMs = 0;
      state.bypassNextRoundCheck = false;
      state.minigame = null;
      startQuestion();
      broadcast();
      return;
    }
    case "setScore": {
      const team = state.teams.find((t) => t.id === msg.teamId);
      if (!team) return;
      const s = Math.max(0, Math.floor(msg.score));
      team.score = isFinite(s) ? s : 0;
      broadcast();
      return;
    }
    case "buzz": {
      if (client.teamId === null) return;
      // Standard buzz during a regular question
      if (state.phase === "question") {
        if (state.answeredWrong.includes(client.teamId)) return;
        if (state.lockedTeamId === client.teamId && state.lockedMs > 0) return;
        state.phase = "buzzed";
        state.buzzedTeamId = client.teamId;
        stopTimer();
        broadcast();
        return;
      }
      // Felix boss-fight question buzz
      if (
        state.phase === "minigame" &&
        state.minigame?.kind === "felix" &&
        state.minigame.status === "questionPlay"
      ) {
        if (state.minigame.felixBuzzedWrong.includes(client.teamId)) return;
        state.minigame.felixSavedQuestionMs = state.minigame.countdownMs;
        state.minigame.countdownMs = FELIX_AUTO_REJECT_MS;
        state.minigame.status = "questionBuzzed";
        state.buzzedTeamId = client.teamId;
        return;
      }
      return;
    }
    case "start": {
      state.questionsAnswered = 0;
      state.modifier = null;
      startQuestion();
      broadcast();
      return;
    }
    case "judge": {
      // Felix boss fight judging
      if (
        state.phase === "minigame" &&
        state.minigame?.kind === "felix" &&
        state.minigame.status === "questionBuzzed" &&
        state.buzzedTeamId !== null
      ) {
        const mg = state.minigame;
        const winnerId = state.buzzedTeamId;
        const team = state.teams.find((t) => t.id === winnerId);
        if (msg.correct && team) {
          // CORRECT — award + skip straight to finishing him off
          team.score += FELIX_CORRECT_BONUS;
          state.lastWinnerTeamId = winnerId;
          mg.status = "shoot2";
          mg.countdownMs = FELIX_SHOOT2_MS;
          state.buzzedTeamId = null;
          broadcast();
          return;
        }
        // WRONG — Felix yells NO. Lock this team out; if room for more buzzes, return to play.
        mg.felixBuzzedWrong.push(winnerId);
        const remaining = state.teams.length - mg.felixBuzzedWrong.length;
        state.buzzedTeamId = null;
        if (remaining <= 0) {
          // Everyone got it wrong — final shoot phase
          mg.status = "shoot2";
          mg.countdownMs = FELIX_SHOOT2_MS;
        } else {
          mg.status = "questionPlay";
          // Don't reset countdown — keep the remaining time from when buzz happened
        }
        broadcast();
        return;
      }

      if (state.phase !== "buzzed" || state.buzzedTeamId === null) return;
      const winnerId = state.buzzedTeamId;
      const team = state.teams.find((t) => t.id === winnerId);
      const usedModifier = state.modifier;

      if (team && msg.correct) {
        // CORRECT — round ends, points awarded
        const before = team.score;
        applyCorrectScore(team, state.modifier);
        const delta = team.score - before;

        // TRADE: winner must pick a team to swap with — pause for choice
        if (state.modifier === "trueque") {
          const others = state.teams.filter((t) => t.id !== winnerId);
          if (others.length > 0) {
            state.phase = "tradeChoice";
            broadcast();
            return;
          }
        }

        state.lastJudgment = { teamId: winnerId, correct: true, pointsDelta: delta, modifier: usedModifier };
        state.lastWinnerTeamId = winnerId;
        state.phase = "reveal";
        state.questionsAnswered += 1;
        state.modifier = null;
        state.answeredWrong = [];
        state.lockedTeamId = null;
        state.lockedMs = 0;
        broadcast();
        return;
      }

      // WRONG — lock this team out, resume the round
      if (team) state.answeredWrong.push(winnerId);
      const teamsLeftToTry = state.teams.length - state.answeredWrong.length;
      if (teamsLeftToTry <= 1) {
        // Only 1 team hasn't buzzed (or 0) — round ends with no winner
        state.buzzedTeamId = null;
        state.lastJudgment = null;
        state.questionsAnswered += 1;
        state.modifier = null;
        state.lockedTeamId = null;
        state.lockedMs = 0;
        endRoundNoWinner();
        return;
      }
      // Continue the round: back to question phase, resume timer from where it was
      state.phase = "question";
      state.buzzedTeamId = null;
      startTimer(true);
      broadcast();
      return;
    }
    case "tradeChoice": {
      if (state.phase !== "tradeChoice" || state.buzzedTeamId === null) return;
      if (client.teamId !== state.buzzedTeamId) return;
      const winnerId = state.buzzedTeamId;
      const winner = state.teams.find((t) => t.id === winnerId);
      const partner = state.teams.find((t) => t.id === msg.targetTeamId);
      if (!winner || !partner || winner.id === partner.id) return;
      const winnerBefore = winner.score;
      const tmp = winner.score;
      winner.score = partner.score;
      partner.score = tmp;
      const delta = winner.score - winnerBefore;
      state.lastJudgment = {
        teamId: winnerId,
        correct: true,
        pointsDelta: delta,
        modifier: "trueque",
      };
      state.lastWinnerTeamId = winnerId;
      state.phase = "reveal";
      // Only increment when this trade came from a correct answer (not the wheel).
      if (!state.bypassNextRoundCheck) state.questionsAnswered += 1;
      state.modifier = null;
      state.answeredWrong = [];
      state.lockedTeamId = null;
      state.lockedMs = 0;
      broadcast();
      return;
    }
    case "next": {
      // Guard: only valid from reveal or timeout. Otherwise this is a stale/double
      // message (e.g. host auto-advance + manual click) and would chain minigames.
      if (state.phase !== "reveal" && state.phase !== "timeout") return;
      if (state.bypassNextRoundCheck) {
        state.bypassNextRoundCheck = false;
        state.lastJudgment = null;
        state.answeredWrong = [];
        state.lockedTeamId = null;
        state.lockedMs = 0;
        startQuestion();
        broadcast();
        return;
      }
      advanceToNextQuestion();
      broadcast();
      return;
    }
    case "spinWheel": {
      if (state.phase !== "wheel") return;
      if (state.wheelResult) return; // already spinning
      // If there's a previous winner, only they can spin. Otherwise anyone (host fallback).
      if (state.lastWinnerTeamId !== null) {
        if (client.teamId !== state.lastWinnerTeamId) return;
      }
      const pick = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
      state.wheelResult = pick.key;
      broadcast();
      return;
    }
    case "wheelDone": {
      if (state.phase !== "wheel" || !state.wheelResult) return;
      state.modifier = state.wheelResult;
      state.wheelResult = null;
      if (applyImmediateModifiers()) {
        broadcast();
        return;
      }
      // TRADE: spinner picks immediately, no waiting for a correct answer
      if (state.modifier === "trueque" && state.lastWinnerTeamId !== null && state.teams.length > 1) {
        state.phase = "tradeChoice";
        state.buzzedTeamId = state.lastWinnerTeamId;
        state.bypassNextRoundCheck = true;
        broadcast();
        return;
      }
      startQuestion();
      broadcast();
      return;
    }
    case "reset": {
      stopTimer();
      Object.assign(state, freshState());
      tokenToTeam.clear();
      for (const c of clients) { c.teamId = null; c.token = null; }
      broadcast();
      return;
    }
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 4 * 1024 * 1024, // 4MB headroom for drawings
    perMessageDeflate: { threshold: 1024 },
  });

  // Heartbeat: clients that don't respond to pings within 60s are dropped.
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      const ws = client.ws as WebSocket & { isAlive?: boolean };
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30000);
  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws, req) => {
    const client: ClientInfo = { ws, teamId: null, token: null };
    clients.add(client);
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on("pong", () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });

    if (req.url && req.url.includes("role=board")) {
      stopTimer();
      Object.assign(state, freshState());
      tokenToTeam.clear();
      for (const c of clients) { c.teamId = null; c.token = null; }
    }

    const initial: ServerMsg = { type: "state", state, youAreTeamId: null };
    ws.send(JSON.stringify(initial));

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMsg;
        handleMessage(client, msg);
      } catch (e) {
        console.error("Bad message", e);
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      if (client.teamId !== null) {
        // Keep the team alive — just mark disconnected so they can reconnect with cookie token.
        const team = state.teams.find((t) => t.id === client.teamId);
        if (team) team.connected = false;
      }
      broadcast();
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket on ws://${hostname}:${port}/ws`);
  });
});
