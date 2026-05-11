"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/useGame";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./board.module.css";
import { MODIFIERS } from "@/lib/types";
import { Wheel } from "./Wheel";

// warm muted team palette: coral, teal, mustard, plum
const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

export default function MainBoard() {
  const { state, send, connected } = useGame("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<number, string>>({});

  // Auto-advance the reveal screen after 1.5s so the host doesn't have to click NEXT every round.
  useEffect(() => {
    if (state?.phase !== "reveal") return;
    const t = setTimeout(() => send({ type: "next" }), 1500);
    return () => clearTimeout(t);
  }, [state?.phase, send]);

  if (!state) {
    return <div className={styles.center}>{connected ? "LOADING..." : "CONNECTING..."}</div>;
  }

  const seconds = (state.timerMs / 1000).toFixed(1);
  const danger = state.phase === "question" && state.timerMs <= 5000;
  const hideTimer = state.modifier === "mudo";
  const activeMod = state.modifier ? MODIFIERS.find((m) => m.key === state.modifier) : null;
  // Hide top scores during countdown + question + buzzed + ended (slide them out).
  const scoresHidden =
    state.phase === "countdown" ||
    state.phase === "question" ||
    state.phase === "buzzed" ||
    state.phase === "ended";

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

  // Sort teams by score for the podium
  const podium = [...state.teams].sort((a, b) => b.score - a.score);

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
            state.lastJudgment?.correct &&
            state.lastJudgment.teamId === i;
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
                const heights = ["260px", "360px", "180px"];
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

      {/* Full-screen red nuclear flash overlay when timer ≤ 5s */}
      {danger && !hideTimer && <div className={styles.nukeFlash} />}
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
