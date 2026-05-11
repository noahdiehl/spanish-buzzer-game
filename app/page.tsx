"use client";
import { useGame } from "@/lib/useGame";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./board.module.css";
import { MODIFIERS } from "@/lib/types";
import { Wheel } from "./Wheel";

// warm muted team palette: coral, teal, mustard, plum
const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

export default function MainBoard() {
  const { state, send, connected } = useGame("board");

  if (!state) {
    return <div className={styles.center}>{connected ? "LOADING..." : "CONNECTING..."}</div>;
  }

  const seconds = (state.timerMs / 1000).toFixed(1);
  const danger = state.phase === "question" && state.timerMs <= 5000;
  const hideTimer = state.modifier === "mudo";
  const activeMod = state.modifier ? MODIFIERS.find((m) => m.key === state.modifier) : null;

  return (
    <div className={styles.board}>
      {/* TEAM BOXES */}
      <div className={styles.teamRow}>
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
      </div>

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
            <h1 className={styles.title}>:: SPANISH BUZZER ::</h1>
            <p className={styles.subtitle}>WAITING FOR TEAMS — {state.teams.length}/4 CONNECTED</p>
            <button className="primary" onClick={() => send({ type: "start" })}>START GAME</button>
          </div>
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

        {state.phase === "wheel" && (
          <Wheel
            result={state.wheelResult}
            onSpinRequest={() => send({ type: "spinWheel" })}
            onSpinComplete={() => send({ type: "wheelDone" })}
          />
        )}

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

      {/* footer controls */}
      <div className={styles.footer}>
        <button className="warn" onClick={() => send({ type: "reset" })}>
          RESET
        </button>
        <div className={styles.qCounter}>Q {state.questionsAnswered + 1}</div>
      </div>

      {/* Full-screen red nuclear flash overlay when timer ≤ 5s */}
      {danger && !hideTimer && <div className={styles.nukeFlash} />}
    </div>
  );
}
