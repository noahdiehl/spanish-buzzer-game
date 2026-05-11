# Spanish Buzzer Game — Context

## Purpose
Buzzer-style classroom game for Spanish class. One main board (projector) + 4 team computers connecting via website. Real-time via WebSockets.

## Stack
- **Next.js + TypeScript + React** (great for shaders & animations — Framer Motion, react-three-fiber for shader overlay)
- **WebSockets** via `ws` library + Next.js custom server (`server.ts`)
- **Deploy: Railway** (handles persistent WebSockets out of the box)
- All clients on same school Wi-Fi

## Routes
- `/` — Main board (teacher's screen / projector)
- `/play` — Team computer (4 of these)

## Theme
- "Super advanced hacker" + colorful video-game vibe
- Shader overlay: CRT scanlines, chromatic aberration, glow (post-processing)
- Framer Motion for the timer bounce + buzz-in morph animation

## Main Board UI
- **Top:** 4 horizontal team boxes showing team names + current scores (live updates)
- **Center:** Current Spanish question (placeholder: "2+2")
- **Timer:** Big flashing-red nuclear countdown, 15 sec, bounces on each tick, sound placeholder
- **On buzz:** Smooth FAST morph animation — timer collapses into "TEAM X BUZZED" display
- **Teacher controls:** CORRECT / INCORRECT buttons → updates that team's score, advances to next question
- **On timeout (no buzz):** Big Entrelazados character image + "laughs at the class" placeholder

## Team Computer UI
- **On load:** Prompt for team name. First 4 connections fill the 4 slots in order.
- **During question:** Shows placeholder images of Entrelazados characters (user will swap real images later)
- **Buzz:** SPACEBAR press → sends buzz event

## Scoring
- Persistent per session
- Correct = +1 (or configurable), Incorrect = no change (or -1, TBD — defaulting to +1/0)
- Shown in each team's top box

## Questions
- User will provide a long list — **questions only, no answers** (teacher knows answers verbally)
- Stored in `questions.json` or similar; teacher advances with CORRECT/INCORRECT button

## WebSocket Messages (draft)
- Client→Server: `join {name}`, `buzz`, `setQuestion {idx}`, `judge {correct: bool}`, `reset`
- Server→Client: `state {teams, question, timer, buzzedTeam, phase}` (broadcast full state)

## Game Phases
- `lobby` — waiting for 4 teams
- `question` — timer running
- `buzzed` — someone buzzed, awaiting CORRECT/INCORRECT
- `timeout` — nobody buzzed in time
- `reveal` — between questions

## Open / Deferred
- Real Entrelazados images — user adds later
- Tick & laugh sound effects — user adds later
- Questions list — user will paste
