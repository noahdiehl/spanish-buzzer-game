import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMsg, GameState, ServerMsg, Team, ModifierKey } from "./lib/types";
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
const WHEEL_EVERY = 3;

interface ClientInfo {
  ws: WebSocket;
  teamId: number | null;
}

const clients = new Set<ClientInfo>();

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

function applyCorrectScore(team: Team, mod: ModifierKey | null) {
  switch (mod) {
    case "doble":   team.score = team.score * 2; break;
    case "triple":  team.score = team.score * 3; break;
    case "jackpot": team.score += 5000; break;
    default:        team.score += 500; break;
  }
}

function startQuestion() {
  state.question = QUESTIONS[state.questionIdx] ?? "(no more questions)";
  state.phase = "question";
  state.buzzedTeamId = null;
  state.lastJudgment = null;
  state.answeredWrong = [];
  // DELAY: pick a random team to lock for 4 seconds
  if (state.modifier === "demora" && state.teams.length > 0) {
    const victim = state.teams[Math.floor(Math.random() * state.teams.length)];
    state.lockedTeamId = victim.id;
    state.lockedMs = DEMORA_MS;
  } else {
    state.lockedTeamId = null;
    state.lockedMs = 0;
  }
  startTimer(false);
}

function beginNextRound() {
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
        if (t) t.name = msg.name.slice(0, 24) || t.name;
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
        name: msg.name.slice(0, 24) || `Team ${id + 1}`,
        score: 0,
        connected: true,
      };
      state.teams.push(team);
      client.teamId = id;
      broadcast();
      return;
    }
    case "buzz": {
      if (state.phase !== "question") return;
      if (client.teamId === null) return;
      // Already answered wrong this round — locked out
      if (state.answeredWrong.includes(client.teamId)) return;
      // DELAY lockout still active
      if (state.lockedTeamId === client.teamId && state.lockedMs > 0) return;
      state.phase = "buzzed";
      state.buzzedTeamId = client.teamId;
      stopTimer();
      broadcast();
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
      state.questionsAnswered += 1;
      state.modifier = null;
      state.answeredWrong = [];
      state.lockedTeamId = null;
      state.lockedMs = 0;
      broadcast();
      return;
    }
    case "next": {
      if (state.phase === "timeout") {
        // questionsAnswered was already bumped at round-end. Skip if mid-flow.
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
      startQuestion();
      broadcast();
      return;
    }
    case "reset": {
      stopTimer();
      Object.assign(state, freshState());
      for (const c of clients) c.teamId = null;
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

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const client: ClientInfo = { ws, teamId: null };
    clients.add(client);

    if (req.url && req.url.includes("role=board")) {
      stopTimer();
      Object.assign(state, freshState());
      for (const c of clients) c.teamId = null;
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
        const droppedId = client.teamId;
        state.teams = state.teams
          .filter((t) => t.id !== droppedId)
          .map((t, i) => ({ ...t, id: i }));
        for (const c of clients) {
          if (c.teamId === null) continue;
          if (c.teamId === droppedId) c.teamId = null;
          else if (c.teamId > droppedId) c.teamId -= 1;
        }
        if (state.buzzedTeamId === droppedId) {
          state.buzzedTeamId = null;
          if (state.phase === "buzzed") state.phase = "question";
        } else if (state.buzzedTeamId !== null && state.buzzedTeamId > droppedId) {
          state.buzzedTeamId -= 1;
        }
        // clean answeredWrong list of dropped IDs
        state.answeredWrong = state.answeredWrong
          .filter((id) => id !== droppedId)
          .map((id) => (id > droppedId ? id - 1 : id));
        if (state.lockedTeamId === droppedId) state.lockedTeamId = null;
        else if (state.lockedTeamId !== null && state.lockedTeamId > droppedId) state.lockedTeamId -= 1;
      }
      broadcast();
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket on ws://${hostname}:${port}/ws`);
  });
});
