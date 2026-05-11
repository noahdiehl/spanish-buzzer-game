"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/useGame";
import styles from "./play.module.css";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

export default function PlayPage() {
  const { state, youAreTeamId, send, connected, error } = useGame("player");
  const [name, setName] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" || youAreTeamId === null || state?.phase !== "question") return;
      const isLocked = state.lockedTeamId === youAreTeamId && state.lockedMs > 0;
      const alreadyWrong = state.answeredWrong.includes(youAreTeamId);
      if (isLocked || alreadyWrong) return;
      e.preventDefault();
      send({ type: "buzz" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, state?.phase, state?.lockedTeamId, state?.lockedMs, state?.answeredWrong, youAreTeamId]);

  if (!state) {
    return <div className={styles.center}>{connected ? "LOADING..." : "CONNECTING..."}</div>;
  }

  if (youAreTeamId === null) {
    return (
      <div className={styles.shell}>
        <div className={styles.center}>
          <h1 className={styles.title}>:: TEAM NAME ::</h1>
          <p className={styles.subtitle}>{state.teams.length}/4 SLOTS FILLED</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) send({ type: "join", name: name.trim() });
            }}
            className={styles.form}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TEAM NAME"
              maxLength={24}
            />
            <button type="submit" className="primary" disabled={!name.trim() || state.teams.length >= 4}>
              CONNECT
            </button>
          </form>
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    );
  }

  const me = state.teams.find((t) => t.id === youAreTeamId);
  const color = TEAM_COLORS[youAreTeamId];
  const isMyBuzz = state.buzzedTeamId === youAreTeamId;

  return (
    <div className={styles.shell}>
      <div className={styles.play} style={{ borderColor: color }}>
        <div className={styles.header} style={{ color }}>
          <span className={styles.headerName}>{me?.name}</span>
          <span>SCORE: {me?.score ?? 0}</span>
        </div>

        {state.phase === "lobby" && (
          <div className={styles.center}>
            <p className={styles.subtitle}>WAITING TO START...</p>
            <p className={styles.hint}>{state.teams.length}/4 TEAMS</p>
          </div>
        )}

        {state.phase === "question" && (() => {
          const isLocked = state.lockedTeamId === youAreTeamId && state.lockedMs > 0;
          const alreadyWrong = state.answeredWrong.includes(youAreTeamId!);
          const disabled = isLocked || alreadyWrong;
          return (
            <div className={styles.center}>
              {isLocked && (
                <motion.div
                  className={styles.lockOverlay}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                >
                  <div className={styles.lockLabel}>DELAY!</div>
                  <div className={`${styles.lockNum} terminal`}>
                    {Math.ceil(state.lockedMs / 1000)}
                  </div>
                  <div className={styles.hint}>BUZZER LOCKED</div>
                </motion.div>
              )}
              {alreadyWrong && !isLocked && (
                <div className={styles.lockOverlay}>
                  <div className={styles.lockLabel}>OUT</div>
                  <div className={styles.hint}>YOU ALREADY ANSWERED</div>
                </div>
              )}
              {!disabled && (
                <motion.div
                  className={styles.buzzButton}
                  style={{ borderColor: color, color }}
                  animate={{
                    boxShadow: [
                      `0 6px 0 0 var(--ink)`,
                      `0 10px 0 0 var(--ink)`,
                      `0 6px 0 0 var(--ink)`,
                    ],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  onClick={() => send({ type: "buzz" })}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                >
                  <div className={styles.buzzSmall}>PRESS SPACE</div>
                  <div className={styles.buzzBig}>BUZZ</div>
                </motion.div>
              )}
            </div>
          );
        })()}

        {state.phase === "buzzed" && (
          <div className={styles.center}>
            {isMyBuzz ? (
              <motion.div
                className={styles.submitted}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 14 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marco/marco2.png" alt="" className={styles.submittedImg} />
                <div className={styles.submittedText} style={{ color }}>SUBMITTED</div>
              </motion.div>
            ) : (
              <div className={styles.subtitle}>
                {state.teams.find((t) => t.id === state.buzzedTeamId)?.name} BUZZED
              </div>
            )}
          </div>
        )}

        {state.phase === "timeout" && (
          <div className={styles.center}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marco/marco3.png" alt="" className={styles.submittedImg} />
          </div>
        )}

        {state.phase === "reveal" && (
          <div className={styles.center}>
            <div className={styles.subtitle}>NEXT QUESTION...</div>
          </div>
        )}

        {state.phase === "tradeChoice" && (
          <div className={styles.center}>
            {isMyBuzz ? (
              <>
                <div className={styles.subtitle}>PICK A TEAM TO SWAP SCORES WITH</div>
                <div className={styles.hint}>(you have to — even if you lose points!)</div>
                <div className={styles.tradeGrid}>
                  {state.teams
                    .filter((t) => t.id !== youAreTeamId)
                    .map((t) => {
                      const c = TEAM_COLORS[t.id];
                      return (
                        <button
                          key={t.id}
                          onClick={() => send({ type: "tradeChoice", targetTeamId: t.id })}
                          style={{ borderColor: c, color: c }}
                          className={styles.tradeBtn}
                        >
                          <div className={styles.tradeName}>{t.name}</div>
                          <div className={styles.tradeScore}>{t.score}</div>
                        </button>
                      );
                    })}
                </div>
              </>
            ) : (
              <div className={styles.subtitle}>
                {state.teams.find((t) => t.id === state.buzzedTeamId)?.name} IS CHOOSING...
              </div>
            )}
          </div>
        )}

        {state.phase === "wheel" && (
          <div className={styles.center}>
            <div className={styles.subtitle}>WHEEL OF MARCO...</div>
            <div className={styles.hint}>(watch the screen)</div>
          </div>
        )}

      </div>
    </div>
  );
}
