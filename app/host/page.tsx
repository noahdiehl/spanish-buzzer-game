"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/useGame";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./board.module.css";
import { MODIFIERS } from "@/lib/types";
import { Wheel } from "./Wheel";
import { Flappy } from "../Flappy";
import { Banana } from "../Banana";
import { Geom } from "../Geom";
import { Felix } from "../Felix";

// warm muted team palette: coral, teal, mustard, plum
const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

export default function MainBoard() {
  const { state, send, connected } = useGame("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<number, string>>({});
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpDraft, setJumpDraft] = useState("");
  const nukeAudioRef = useRef<HTMLAudioElement | null>(null);
  const nukePlayedRef = useRef(false);
  const buzzAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastBuzzedRef = useRef<number | null>(null);
  const flappyMusicRef = useRef<HTMLAudioElement | null>(null);
  const bananaMusicRef = useRef<HTMLAudioElement | null>(null);
  const felixMusicRef = useRef<HTMLAudioElement | null>(null);
  const blipCtxRef = useRef<AudioContext | null>(null);
  const prevFelixShotsRef = useRef(0);
  const prevFelixStatusRef = useRef<string | null>(null);
  const prevFelixRejectsRef = useRef(0);
  // Voice queue: ensures voice lines never overlap and Felix runs through
  // every file before repeating any.
  const voiceQueueRef = useRef<string[]>([]);
  const voiceDeckRef = useRef<string[]>([]);
  const voicePlayingRef = useRef(false);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  function enqueueVoice(file: string) {
    voiceQueueRef.current.push(file);
    if (!voicePlayingRef.current) playNextVoice();
  }
  function playNextVoice() {
    const file = voiceQueueRef.current.shift();
    if (!file) {
      voicePlayingRef.current = false;
      return;
    }
    voicePlayingRef.current = true;
    const a = new Audio(file);
    voiceAudioRef.current = a;
    a.volume = 1;
    a.onended = () => playNextVoice();
    a.onerror = () => playNextVoice();
    a.play().catch(() => playNextVoice());
  }
  function takeFromDeck(pool: string[]): string {
    if (voiceDeckRef.current.length === 0) {
      voiceDeckRef.current = [...pool].sort(() => Math.random() - 0.5);
    }
    return voiceDeckRef.current.shift()!;
  }
  function stopVoice() {
    voiceQueueRef.current = [];
    voiceDeckRef.current = [];
    voicePlayingRef.current = false;
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
  }
  const wheelLastSegRef = useRef<number>(-1);
  const wheelRafRef = useRef<number>(0);

  // Play one-shot SFX (overlapping allowed)
  function playSfx(src: string, volume = 0.85) {
    try {
      const a = new Audio(src);
      a.volume = volume;
      a.play().catch(() => {});
    } catch {}
  }

  // Auto-advance the reveal screen after 1.5s so the host doesn't have to click NEXT every round.
  useEffect(() => {
    if (state?.phase !== "reveal") return;
    const t = setTimeout(() => send({ type: "next" }), 1500);
    return () => clearTimeout(t);
  }, [state?.phase, send]);

  // Buzz sound: play when any team buzzes (phase enters "buzzed" with a new team).
  useEffect(() => {
    if (state?.phase === "buzzed" && state.buzzedTeamId !== null) {
      if (lastBuzzedRef.current !== state.buzzedTeamId) {
        lastBuzzedRef.current = state.buzzedTeamId;
        const a = buzzAudioRef.current;
        if (a) {
          a.currentTime = 0;
          a.play().catch(() => {});
        }
      }
    } else {
      lastBuzzedRef.current = null;
    }
  }, [state?.phase, state?.buzzedTeamId]);

  // ===== FELIX BOSS AUDIO =====
  // Battle music loops during all felix phases
  useEffect(() => {
    const audio = felixMusicRef.current;
    if (!audio) return;
    audio.loop = true;
    const inFelix =
      state?.phase === "minigame" &&
      state.minigame?.kind === "felix" &&
      state.minigame.status !== "felixOver";
    if (inFelix) {
      audio.volume = 0.45;
      if (audio.paused) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    }
  }, [state?.phase, state?.minigame?.kind, state?.minigame?.status]);

  // Felix status-triggered voice lines + sounds (one-shots, status transitions)
  useEffect(() => {
    const status = state?.minigame?.kind === "felix" ? state.minigame.status : null;
    const prev = prevFelixStatusRef.current;
    prevFelixStatusRef.current = status ?? null;
    if (status === prev) return;
    if (status === "intro") {
      // Reset queue and start with iconic "I am Felix"
      voiceQueueRef.current = [];
      voiceDeckRef.current = [];
      enqueueVoice("/sounds/felix_iam.mp3");
    } else if (status === "questionThrow") {
      // Slap is non-voice SFX, plays directly
      playSfx("/sounds/slap.mp3", 1);
    } else if (status === "questionCountdown") {
      playSfx("/sounds/epic_countdown.mp3", 1);
      setTimeout(() => playSfx("/sounds/epic_countdown.mp3", 1), 1000);
      setTimeout(() => playSfx("/sounds/epic_countdown.mp3", 1), 2000);
    } else if (status === "shoot2") {
      // Detect the transition source
      if (prev === "questionPlay" || prev === "questionBuzzed") {
        const mg = state?.minigame;
        if (mg && mg.kind === "felix") {
          const allWrong = (mg.felixBuzzedWrong?.length ?? 0) >= state.teams.length;
          if (allWrong) {
            // Clear any pending voice and play the big "NO ONE WINS" reveal
            voiceQueueRef.current = [];
            voiceDeckRef.current = [];
            if (voiceAudioRef.current) voiceAudioRef.current.pause();
            voicePlayingRef.current = false;
            enqueueVoice("/sounds/felix_noonewins.mp3");
          }
        }
      }
    } else if (status === "death") {
      // Stop everything and play death line cleanly
      voiceQueueRef.current = [];
      voiceDeckRef.current = [];
      if (voiceAudioRef.current) voiceAudioRef.current.pause();
      voicePlayingRef.current = false;
      enqueueVoice("/sounds/felix_dies.mp3");
    } else if (status === "felixOver" || status === null) {
      stopVoice();
    }
  }, [state?.minigame?.status, state?.minigame?.kind, state?.minigame, state?.teams]);

  // Keep voice queue topped up during shoot phases — Felix never shuts up.
  useEffect(() => {
    const status = state?.minigame?.kind === "felix" ? state.minigame.status : null;
    if (status !== "shoot1" && status !== "shoot2") return;
    const shoot1Pool = [
      "/sounds/felix_iam.mp3",
      "/sounds/felix_dontlike.mp3",
      "/sounds/felix_laugh.mp3",
    ];
    const shoot2Pool = [
      "/sounds/felix_stop.mp3",
      "/sounds/felix_actuallystop.mp3",
      "/sounds/felix_laugh.mp3",
    ];
    const pool = status === "shoot1" ? shoot1Pool : shoot2Pool;
    const id = setInterval(() => {
      if (voiceQueueRef.current.length < 1) {
        enqueueVoice(takeFromDeck(pool));
      }
    }, 400);
    return () => clearInterval(id);
  }, [state?.minigame?.status, state?.minigame?.kind]);

  // Felix slap+laugh on every rejection (auto-judge)
  useEffect(() => {
    const total = (state?.minigame?.kind === "felix" ? state.minigame.felixRejectionsTotal : 0) ?? 0;
    if (total > prevFelixRejectsRef.current) {
      prevFelixRejectsRef.current = total;
      playSfx("/sounds/slap.mp3", 1);
      enqueueVoice("/sounds/felix_laugh.mp3");
    }
  }, [state?.minigame, state?.minigame?.kind]);

  // Late-shoot1 transition warnings: when HP gets low, switch random pool to "stop"
  useEffect(() => {
    const mg = state?.minigame;
    if (!mg || mg.kind !== "felix") return;
    if (mg.status !== "shoot1") return;
    // When HP first hits the floor, play "stop shooting"
    if (mg.felixHp <= 30) {
      // Throttle this — only every ~3s while at floor
      // (handled by status change useEffect when transition happens)
    }
  }, [state?.minigame]);

  // Laser sound on each new shot
  useEffect(() => {
    const total = state?.minigame?.felixShotsTotal ?? 0;
    if (total > prevFelixShotsRef.current) {
      const burst = Math.min(3, total - prevFelixShotsRef.current);
      for (let i = 0; i < burst; i++) {
        setTimeout(() => playSfx("/sounds/laser.mp3", 0.6), i * 30);
      }
    }
    prevFelixShotsRef.current = total;
  }, [state?.minigame?.felixShotsTotal]);

  // Banana music — plays during the banana event.
  useEffect(() => {
    const audio = bananaMusicRef.current;
    if (!audio) return;
    audio.loop = true;
    if (state?.phase === "minigame" && state.minigame?.kind === "banana") {
      audio.volume = 0.55;
      if (audio.paused) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
    }
  }, [state?.phase, state?.minigame?.kind]);

  // VG dialog blip — short square-wave click via WebAudio.
  function playBlip() {
    try {
      if (!blipCtxRef.current) {
        blipCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = blipCtxRef.current;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 720;
      g.gain.value = 0.07;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.07, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
      o.start(now);
      o.stop(now + 0.05);
    } catch {}
  }

  // Flappy bird music — plays during the entire minigame phase (intro + playing + over).
  // Skip the first 5 seconds and re-seek to 5 each loop.
  useEffect(() => {
    const audio = flappyMusicRef.current;
    if (!audio) return;
    audio.loop = false;
    const onEnded = () => {
      audio.currentTime = 5;
      audio.play().catch(() => {});
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  useEffect(() => {
    const audio = flappyMusicRef.current;
    if (!audio) return;
    if (state?.phase === "minigame" && state.minigame?.kind === "flappy") {
      audio.volume = 0.6;
      if (audio.paused) {
        audio.currentTime = 5;
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) audio.pause();
      audio.currentTime = 5;
    }
  }, [state?.phase, state?.minigame?.kind]);

  // Nuclear countdown audio: starts 3 sec before the 9-sec danger window (timerMs <= 12000)
  // so the 3-sec intro plays and the actual countdown audio aligns with timerMs <= 9000.
  useEffect(() => {
    const audio = nukeAudioRef.current;
    if (!audio) return;
    const phase = state?.phase;
    const timerMs = state?.timerMs ?? 0;
    const mudo = state?.modifier === "mudo";
    if (phase !== "question" || mudo || timerMs > 12000) {
      if (!audio.paused) audio.pause();
      audio.currentTime = 0;
      nukePlayedRef.current = false;
      return;
    }
    if (!nukePlayedRef.current) {
      nukePlayedRef.current = true;
      audio.currentTime = Math.max(0, (12000 - timerMs) / 1000);
      audio.play().catch(() => {});
    }
  }, [state?.phase, state?.timerMs, state?.modifier]);

  if (!state) {
    return <div className={styles.center}>{connected ? "LOADING..." : "CONNECTING..."}</div>;
  }

  const seconds = (state.timerMs / 1000).toFixed(1);
  const danger = state.phase === "question" && state.timerMs <= 9000;
  const hideTimer = state.modifier === "mudo";
  const activeMod = state.modifier ? MODIFIERS.find((m) => m.key === state.modifier) : null;
  // Hide top scores during countdown + question + buzzed + ended + minigame (slide them out).
  const scoresHidden =
    state.phase === "countdown" ||
    state.phase === "question" ||
    state.phase === "buzzed" ||
    state.phase === "ended" ||
    state.phase === "minigame";

  function openEditScores() {
    if (!state) return;
    const draft: Record<number, string> = {};
    for (const t of state.teams) draft[t.id] = String(t.score);
    setDraftScores(draft);
    setScoreOpen(true);
    setMenuOpen(false);
  }

  function saveScores() {
    if (!state) return;
    for (const t of state.teams) {
      const v = parseInt(draftScores[t.id] ?? "0", 10);
      if (!isNaN(v) && v !== t.score) send({ type: "setScore", teamId: t.id, score: v });
    }
    setScoreOpen(false);
  }

  // Sort teams by score for the podium — exclude any ghost teams that
  // disconnected without playing (no score and not connected).
  const podium = [...state.teams]
    .filter((t) => t.connected || t.score !== 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div className={styles.board}>
      {/* TEAM BOXES — slide up/out during countdown/question/buzzed */}
      <motion.div
        className={styles.teamRow}
        animate={{
          y: scoresHidden ? -160 : 0,
          opacity: scoresHidden ? 0 : 1,
        }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
      >
        {[0, 1, 2, 3].map((i) => {
          const team = state.teams.find((t) => t.id === i);
          const color = TEAM_COLORS[i];
          const isBuzzed = state.buzzedTeamId === i;
          const justWon =
            state.phase === "reveal" &&
            state.lastJudgment != null &&
            state.lastJudgment.teamId === i &&
            (state.lastJudgment.pointsDelta ?? 0) !== 0;
          const isOut = state.answeredWrong.includes(i);
          const isLocked = state.lockedTeamId === i && state.lockedMs > 0;
          return (
            <motion.div
              key={i}
              className={`${styles.teamBox} ${isOut ? styles.teamOut : ""}`}
              animate={{
                scale: isBuzzed ? 1.08 : 1,
                boxShadow: isBuzzed
                  ? `0 0 60px ${color}, inset 0 0 40px ${color}`
                  : `0 0 16px ${color}55, inset 0 0 16px ${color}33`,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              style={{ borderColor: color, color }}
            >
              {isLocked && (
                <div className={styles.lockBadge}>
                  🔒 {Math.ceil(state.lockedMs / 1000)}
                </div>
              )}
              {isOut && <div className={styles.outBadge}>OUT</div>}
              <div className={styles.teamName}>
                {team ? team.name : <span className={styles.empty}>EMPTY</span>}
              </div>
              <motion.div
                className={styles.teamScore}
                key={team?.score ?? 0}
                animate={justWon ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                {team ? team.score : 0}
              </motion.div>
              <AnimatePresence>
                {justWon && (
                  <motion.div
                    key="plus"
                    className={styles.plus500}
                    initial={{ opacity: 0, y: 30, scale: 0.5 }}
                    animate={{ opacity: 1, y: -120, scale: 1.4 }}
                    exit={{ opacity: 0, y: -160 }}
                    transition={{ duration: 1.4, ease: "easeOut" }}
                    style={{ color: (state.lastJudgment?.pointsDelta ?? 0) >= 0 ? "var(--avocado)" : "var(--tomato)" }}
                  >
                    {(state.lastJudgment?.pointsDelta ?? 0) >= 0 ? "+" : ""}{state.lastJudgment?.pointsDelta ?? 0}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      {/* HAMBURGER MENU */}
      <div className={styles.menuWrap}>
        <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)} aria-label="menu">
          <span /><span /><span />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className={styles.menuPanel}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18 }}
            >
              <button onClick={() => { send({ type: "reset" }); setMenuOpen(false); }}>RESET GAME</button>
              <button onClick={() => { send({ type: "endGame" }); setMenuOpen(false); }}>END GAME</button>
              <button onClick={openEditScores}>EDIT SCORES</button>
              <button onClick={() => { setJumpDraft(String(state.questionsAnswered)); setJumpOpen(true); setMenuOpen(false); }}>GO TO Q...</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* JUMP TO QUESTION PANEL */}
      <AnimatePresence>
        {jumpOpen && (
          <motion.div
            className={styles.scoreModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.scoreCard}>
              <h2 className={styles.scoreTitle}>GO TO Q</h2>
              <div className={styles.scoreRow}>
                <span>SET COUNT TO</span>
                <input
                  autoFocus
                  type="number"
                  value={jumpDraft}
                  onChange={(e) => setJumpDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const n = parseInt(jumpDraft, 10);
                      if (!isNaN(n)) send({ type: "setQuestionsAnswered", count: n });
                      setJumpOpen(false);
                    }
                  }}
                />
              </div>
              <p style={{ fontFamily: "VT323, monospace", fontSize: "1rem", color: "var(--ink-soft)", textAlign: "center", letterSpacing: 1 }}>
                e.g. 19 → next answer triggers minigame 4 (geom)<br />
                4 → next answer triggers minigame 1 (flappy)
              </p>
              <div className={styles.scoreActions}>
                <button onClick={() => setJumpOpen(false)}>CANCEL</button>
                <button className="success" onClick={() => {
                  const n = parseInt(jumpDraft, 10);
                  if (!isNaN(n)) send({ type: "setQuestionsAnswered", count: n });
                  setJumpOpen(false);
                }}>GO</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT SCORES PANEL */}
      <AnimatePresence>
        {scoreOpen && (
          <motion.div
            className={styles.scoreModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.scoreCard}>
              <h2 className={styles.scoreTitle}>EDIT SCORES</h2>
              {state.teams.map((t) => (
                <div key={t.id} className={styles.scoreRow}>
                  <span style={{ color: TEAM_COLORS[t.id] }}>{t.name}</span>
                  <input
                    type="number"
                    value={draftScores[t.id] ?? ""}
                    onChange={(e) =>
                      setDraftScores({ ...draftScores, [t.id]: e.target.value })
                    }
                  />
                </div>
              ))}
              <div className={styles.scoreActions}>
                <button onClick={() => setScoreOpen(false)}>CANCEL</button>
                <button className="success" onClick={saveScores}>SAVE</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVE MODIFIER BANNER */}
      {activeMod && (state.phase === "question" || state.phase === "buzzed") && (
        <motion.div
          className={styles.modBanner}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ borderColor: activeMod.color, color: activeMod.color }}
        >
          <span className={styles.modLabel}>{activeMod.label}</span>
          <span className={styles.modDesc}>{activeMod.description}</span>
        </motion.div>
      )}

      {/* CENTER */}
      <div className={styles.center}>
        {state.phase === "lobby" && (
          <div className={styles.lobby}>
            <h1 className={styles.title}>SPANISH BUZZER</h1>
            <p className={styles.subtitle}>WAITING FOR TEAMS — {state.teams.length}/4 CONNECTED</p>
            <button className="primary" onClick={() => send({ type: "start" })}>START GAME</button>
          </div>
        )}

        {/* === ENDED / WINNER === */}
        {state.phase === "ended" && (
          <motion.div
            className={styles.podiumWrap}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Confetti />
            <motion.h1
              className={styles.podiumTitle}
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              GAME OVER
            </motion.h1>
            {/* Visual order: 2nd | 1st | 3rd (centered on first place)
                Reveal order: 3rd at 0.6s, 2nd at 1.6s, 1st at 2.6s */}
            <div className={styles.podium}>
              {[1, 0, 2].map((rank) => {
                const t = podium[rank];
                const heights = ["22vh", "30vh", "16vh"];
                const labels = ["2nd", "1st", "3rd"];
                const medals = ["🥈", "🥇", "🥉"];
                // Reveal in reverse order of place: 3rd first, then 2nd, then 1st
                const delay = rank === 2 ? 0.6 : rank === 1 ? 1.6 : 2.6;
                const isFirst = rank === 0;
                if (!t) {
                  return <div key={`empty-${rank}`} className={styles.podiumPlace} style={{ visibility: "hidden" }} />;
                }
                return (
                  <motion.div
                    key={t.id}
                    className={`${styles.podiumPlace} ${isFirst ? styles.podiumFirst : ""}`}
                    initial={{ y: 400, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay,
                      type: "spring",
                      stiffness: 220,
                      damping: 12,
                      mass: 0.9,
                    }}
                  >
                    {/* Spotlight only on 1st */}
                    {isFirst && (
                      <motion.div
                        className={styles.spotlight}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: delay + 0.3, duration: 0.6 }}
                      />
                    )}
                    <motion.div
                      className={styles.podiumMedal}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        delay: delay + 0.5,
                        type: "spring",
                        stiffness: 300,
                        damping: 14,
                      }}
                    >
                      {medals[rank]}
                    </motion.div>
                    <motion.div
                      className={styles.podiumName}
                      style={{ color: TEAM_COLORS[t.id] }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: delay + 0.6, duration: 0.3 }}
                    >
                      {t.name}
                    </motion.div>
                    <motion.div
                      className={styles.podiumScore}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: delay + 0.7, duration: 0.3 }}
                    >
                      {t.score}
                    </motion.div>
                    <motion.div
                      className={styles.podiumBlock}
                      style={{ background: TEAM_COLORS[t.id] }}
                      initial={{ height: 0 }}
                      animate={{ height: heights[rank] }}
                      transition={{
                        delay: delay + 0.2,
                        duration: 0.5,
                        ease: [0.34, 1.56, 0.64, 1],
                      }}
                    >
                      <div className={styles.podiumLabel}>{labels[rank]}</div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
            <motion.button
              onClick={() => send({ type: "reset" })}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 4.0, duration: 0.4 }}
            >
              NEW GAME
            </motion.button>
          </motion.div>
        )}

        {state.phase === "minigame" && state.minigame?.kind === "flappy" && (
          <div className={styles.minigameWrap}>
            <h2 className={styles.minigameTitle}>FLAPPY MARCO</h2>
            <Flappy mg={state.minigame} teams={state.teams} height={520} width={820} />
          </div>
        )}

        {state.phase === "minigame" && state.minigame?.kind === "geom" && (
          <div className={styles.minigameWrap}>
            <h2 className={styles.minigameTitle}>GEOMETRY MARCO</h2>
            <Geom mg={state.minigame} teams={state.teams} height={520} width={900} />
          </div>
        )}

        {state.phase === "minigame" && state.minigame?.kind === "draw" && (() => {
          const mg = state.minigame!;
          return (
            <div className={styles.minigameWrap}>
              <h2 className={styles.minigameTitle}>DRAW MARCO FROM MEMORY</h2>

              {mg.status === "study" && (
                <div className={styles.drawStudy}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/marco/study.png" alt="" className={styles.drawStudyImg} />
                  <div className={styles.drawCountdown}>{Math.max(1, Math.ceil(mg.countdownMs / 1000))}</div>
                  <div className={styles.subtitle}>STUDY HIM...</div>
                </div>
              )}

              {mg.status === "drawing" && (
                <div className={styles.drawStudy}>
                  <div className={styles.drawBigCountdown}>{Math.max(0, Math.ceil(mg.countdownMs / 1000))}</div>
                  <div className={styles.subtitle}>DRAW HIM FROM MEMORY</div>
                </div>
              )}

              {mg.status === "judging" && (
                <div className={styles.drawJudgeWrap}>
                  <div className={styles.drawReferenceRow}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/marco/study.png" alt="" className={styles.drawReference} />
                    <div className={styles.drawReferenceLabel}>THE REAL MARCO</div>
                  </div>
                  <div className={styles.drawGrid}>
                    {state.teams.map((t) => {
                      const color = TEAM_COLORS[t.id];
                      const url = mg.drawings[t.id];
                      return (
                        <div key={t.id} className={styles.drawCard} style={{ borderColor: color }}>
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className={styles.drawImg} />
                          ) : (
                            <div className={styles.drawEmpty}>NO ENTRY</div>
                          )}
                          <div className={styles.drawName} style={{ color }}>{t.name}</div>
                          <button
                            className="success"
                            onClick={() => send({ type: "judgeDraw", winnerTeamId: t.id })}
                          >
                            WINNER
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {state.phase === "countdown" && (
          <motion.div
            key={Math.ceil(state.timerMs / 1000)}
            className={styles.countdown}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.6, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
          >
            {Math.max(1, Math.ceil(state.timerMs / 1000))}
          </motion.div>
        )}

        {state.phase === "tradeChoice" && (
          <motion.div
            className={styles.buzzed}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          >
            <div className={styles.buzzedLabel}>TRADE!</div>
            <div className={styles.buzzedName}>
              {state.teams.find((t) => t.id === state.buzzedTeamId)?.name}
            </div>
            <div className={styles.subtitle}>is choosing a team to swap scores with...</div>
          </motion.div>
        )}

        {state.phase === "wheel" && (() => {
          const winnerTeam = state.lastWinnerTeamId !== null
            ? state.teams.find((t) => t.id === state.lastWinnerTeamId)
            : null;
          return (
            <Wheel
              result={state.wheelResult}
              onSpinRequest={() => send({ type: "spinWheel" })}
              onSpinComplete={() => send({ type: "wheelDone" })}
              canSpinHere={state.lastWinnerTeamId === null}
              waitingForName={winnerTeam?.name ?? null}
            />
          );
        })()}

        {(state.phase === "question" || state.phase === "buzzed") && (
          <>
            <AnimatePresence mode="wait">
              {state.phase === "question" && (
                <motion.div
                  key="q"
                  className={styles.question}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.3 }}
                >
                  {state.question}
                </motion.div>
              )}

              {state.phase === "buzzed" && (
                <motion.div
                  key="buzzed"
                  className={styles.buzzed}
                  initial={{ scale: 0.2, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                >
                  <div className={styles.buzzedLabel}>BUZZED IN</div>
                  <div className={styles.buzzedName}>
                    {state.teams.find((t) => t.id === state.buzzedTeamId)?.name}
                  </div>
                  <div className={styles.judgeRow}>
                    <button
                      className="success"
                      onClick={() => send({ type: "judge", correct: true })}
                    >
                      ✓ CORRECTO
                    </button>
                    <button
                      className="danger"
                      onClick={() => send({ type: "judge", correct: false })}
                    >
                      ✗ FALSO
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {state.phase === "question" && !hideTimer && (
              <motion.div
                key={Math.floor(state.timerMs / 100)}
                className={`${styles.timer} terminal`}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 0.15 }}
                style={{
                  color: danger ? "var(--tomato)" : "var(--ink)",
                  textShadow: danger ? "0 0 24px var(--tomato)" : "none",
                }}
              >
                {seconds}
              </motion.div>
            )}
            {state.phase === "question" && state.answeredWrong.length > 0 && (
              <div className={styles.teamsLeftBadge}>
                {state.teams.length - state.answeredWrong.length} TEAM{state.teams.length - state.answeredWrong.length === 1 ? "" : "S"} LEFT TO BUZZ
              </div>
            )}
            {state.phase === "question" && hideTimer && (
              <div className={`${styles.timer} ${styles.timerHidden} terminal`}>--.--</div>
            )}
          </>
        )}

        {state.phase === "timeout" && (
          <motion.div
            className={styles.timeout}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marco/marco1.png" alt="" className={styles.loseImg} />
            <button onClick={() => send({ type: "next" })}>NEXT QUESTION</button>
          </motion.div>
        )}

        {state.phase === "reveal" && (
          <motion.div
            className={styles.reveal}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 250, damping: 16 }}
          >
            <h2 className={styles.goodText}>
              {(() => {
                if (state.lastJudgment && !state.lastJudgment.correct && (state.lastJudgment.pointsDelta ?? 0) < 0) {
                  return "BANANA TAX!";
                }
                if (!state.lastJudgment?.correct) return "ROUND OVER";
                switch (state.lastJudgment?.modifier) {
                  case "doble":   return "DOUBLE POINTS!";
                  case "triple":  return "TRIPLE POINTS!";
                  case "jackpot": return "JACKPOT!";
                  case "trueque": return "TRADE COMPLETE!";
                  case "regalo":  return "GIFT!";
                  case "demora":  return "GOOD JOB!";
                  case "mudo":    return "GOOD JOB!";
                  default:        return "GOOD JOB";
                }
              })()}
            </h2>
            <button onClick={() => send({ type: "next" })}>NEXT QUESTION</button>
          </motion.div>
        )}
      </div>

      {/* footer counter */}
      <div className={styles.footer}>
        <div className={styles.qCounter}>Q {state.questionsAnswered + 1}</div>
      </div>

      {/* Full-screen red nuclear flash overlay when timer ≤ 9s */}
      {danger && !hideTimer && <div className={styles.nukeFlash} />}

      {/* Nuke countdown audio */}
      <audio ref={nukeAudioRef} src="/sounds/nuke.mp3" preload="auto" />
      {/* Buzz sound */}
      <audio ref={buzzAudioRef} src="/sounds/buzz.mp3" preload="auto" />
      {/* Flappy minigame background music */}
      <audio ref={flappyMusicRef} src="/sounds/nostalgic.mp3" preload="auto" />
      {/* Banana event music */}
      <audio ref={bananaMusicRef} src="/sounds/banana.mp3" preload="auto" />
      {/* Felix boss music */}
      <audio ref={felixMusicRef} src="/sounds/felix_music.mp3" preload="auto" />

      {/* Banana event overlay */}
      {state.phase === "minigame" && state.minigame?.kind === "banana" && (
        <Banana mg={state.minigame} teams={state.teams} size="host" onTypeBlip={playBlip} />
      )}

      {/* Felix boss overlay */}
      {state.phase === "minigame" && state.minigame?.kind === "felix" && (
        <Felix
          mg={state.minigame}
          teams={state.teams}
          isHost
          onJudge={(correct) => {
            if (!correct) playSfx("/sounds/felix_laugh.mp3", 1);
            send({ type: "judge", correct });
          }}
        />
      )}
    </div>
  );
}

// Simple CSS confetti
function Confetti() {
  const pieces = Array.from({ length: 60 });
  return (
    <div className={styles.confettiWrap}>
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const dur = 3 + Math.random() * 3;
        const colors = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f", "#7ba84c", "#e8a838"];
        const bg = colors[i % colors.length];
        return (
          <span
            key={i}
            className={styles.confettiPiece}
            style={{
              left: `${left}%`,
              background: bg,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          />
        );
      })}
    </div>
  );
}
