"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/useGame";
import { Flappy } from "./Flappy";
import { DrawCanvas } from "./DrawCanvas";
import { Banana } from "./Banana";
import { Geom } from "./Geom";
import styles from "./play.module.css";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

export default function PlayPage() {
  const { state, youAreTeamId, send, connected, error } = useGame("player");
  const [name, setName] = useState("");
  const [drawSubmitTrigger, setDrawSubmitTrigger] = useState(0);

  // Auto-submit drawing when the draw phase ends (status transitions to judging).
  useEffect(() => {
    if (
      state?.phase === "minigame" &&
      state.minigame?.kind === "draw" &&
      state.minigame.status === "judging" &&
      youAreTeamId !== null
    ) {
      setDrawSubmitTrigger((n) => n + 1);
    }
  }, [state?.phase, state?.minigame?.kind, state?.minigame?.status, youAreTeamId]);

  // Periodic auto-submit during drawing — every 3s so the server always has the
  // latest snapshot in case the connection drops or the deadline submit fails.
  useEffect(() => {
    if (
      state?.phase !== "minigame" ||
      state.minigame?.kind !== "draw" ||
      state.minigame?.status !== "drawing"
    ) return;
    const id = setInterval(() => {
      setDrawSubmitTrigger((n) => n + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [state?.phase, state?.minigame?.kind, state?.minigame?.status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" || youAreTeamId === null) return;
      // Minigame: spacebar = flap (flappy) or jump (geom)
      if (state?.phase === "minigame" && state.minigame?.status === "playing") {
        e.preventDefault();
        if (state.minigame.kind === "flappy") send({ type: "flap" });
        else if (state.minigame.kind === "geom") send({ type: "jump" });
        return;
      }
      // Regular question: spacebar = buzz (with locks)
      if (state?.phase !== "question") return;
      const isLocked = state.lockedTeamId === youAreTeamId && state.lockedMs > 0;
      const alreadyWrong = state.answeredWrong.includes(youAreTeamId);
      if (isLocked || alreadyWrong) return;
      e.preventDefault();
      send({ type: "buzz" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, state?.phase, state?.minigame?.status, state?.lockedTeamId, state?.lockedMs, state?.answeredWrong, youAreTeamId]);

  if (!state) {
    return <div className={styles.center}>{connected ? "LOADING..." : "CONNECTING..."}</div>;
  }

  if (youAreTeamId === null) {
    return (
      <div className={styles.shell}>
        <div className={styles.center}>
          <h1 className={styles.title}>TEAM NAME</h1>
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
              maxLength={12}
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

        {state.phase === "minigame" && state.minigame?.kind === "banana" && (
          <Banana mg={state.minigame} teams={state.teams} size="player" />
        )}

        {state.phase === "minigame" && state.minigame?.kind === "geom" && (() => {
          const mg = state.minigame!;
          const w = Math.min(420, typeof window !== "undefined" ? window.innerWidth - 32 : 420);
          // Match host aspect ratio (900x520)
          const h = Math.round((w * 520) / 900);
          const myCube = mg.cubes.find((c) => c.teamId === youAreTeamId);
          return (
            <div className={styles.center}>
              <div className={styles.subtitle}>GEOMETRY MARCO</div>
              <Geom
                mg={mg}
                teams={state.teams}
                highlightTeamId={youAreTeamId}
                width={w}
                height={h}
              />
              {mg.status === "playing" && (
                myCube?.alive ? (
                  <motion.button
                    className={`primary ${styles.flapBtn}`}
                    onClick={() => send({ type: "jump" })}
                    whileTap={{ scale: 0.9 }}
                  >
                    TAP / SPACE TO JUMP
                  </motion.button>
                ) : (
                  <div className={styles.hint}>YOU CRASHED — watch the rest</div>
                )
              )}
            </div>
          );
        })()}

        {state.phase === "minigame" && state.minigame?.kind === "flappy" && (() => {
          const w = Math.min(420, typeof window !== "undefined" ? window.innerWidth - 32 : 420);
          // Match host aspect ratio (820x520)
          const h = Math.round((w * 520) / 820);
          return (
          <div className={styles.center}>
            <div className={styles.subtitle}>FLAPPY MARCO</div>
            <Flappy
              mg={state.minigame!}
              teams={state.teams}
              highlightTeamId={youAreTeamId}
              width={w}
              height={h}
            />
            {state.minigame.status === "playing" && (() => {
              const myBird = state.minigame!.birds.find((b) => b.teamId === youAreTeamId);
              if (!myBird?.alive) {
                return <div className={styles.hint}>YOU CRASHED — watch the rest</div>;
              }
              return (
                <motion.button
                  className={`primary ${styles.flapBtn}`}
                  onClick={() => send({ type: "flap" })}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.04 }}
                >
                  TAP / SPACE TO FLAP
                </motion.button>
              );
            })()}
          </div>
          );
        })()}

        {state.phase === "minigame" && state.minigame?.kind === "draw" && (() => {
          const mg = state.minigame!;
          const canvasSize = Math.min(260, typeof window !== "undefined" ? window.innerWidth - 60 : 260);
          return (
            <div className={styles.center}>
              <div className={styles.subtitle}>DRAW MARCO</div>
              {mg.status === "study" && (
                <>
                  <div className={styles.hint}>STUDY HIM... {Math.ceil(mg.countdownMs / 1000)}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/marco/study.png"
                    alt=""
                    style={{
                      width: canvasSize,
                      height: canvasSize,
                      objectFit: "contain",
                      border: "3px solid var(--ink)",
                      borderRadius: 14,
                      background: "#fbf6e4",
                      boxShadow: "0 5px 0 0 var(--ink)",
                    }}
                  />
                </>
              )}
              {mg.status === "drawing" && (
                <>
                  <div className={styles.hint}>{Math.ceil(mg.countdownMs / 1000)}s — DRAW HIM FROM MEMORY</div>
                  <DrawCanvas
                    size={canvasSize}
                    onSubmit={(dataUrl) => send({ type: "submitDrawing", dataUrl })}
                    submitTrigger={drawSubmitTrigger}
                  />
                </>
              )}
              {mg.status === "judging" && (
                <div className={styles.hint}>PENCILS DOWN — host is picking the winner...</div>
              )}
            </div>
          );
        })()}

        {state.phase === "countdown" && (
          <motion.div
            key={Math.ceil(state.timerMs / 1000)}
            className={styles.center}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.4, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
          >
            <div className={styles.countdownNum}>
              {Math.max(1, Math.ceil(state.timerMs / 1000))}
            </div>
          </motion.div>
        )}

        {state.phase === "ended" && (
          <div className={styles.center}>
            <div className={styles.subtitle}>GAME OVER</div>
            <div className={styles.endedScores}>
              {[...state.teams].sort((a, b) => b.score - a.score).map((t, idx) => (
                <div
                  key={t.id}
                  className={styles.endedRow}
                  style={{ color: TEAM_COLORS[t.id] }}
                >
                  <span className={styles.endedRank}>#{idx + 1}</span>
                  <span>{t.name}</span>
                  <span>{t.score}</span>
                </div>
              ))}
            </div>
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

        {state.phase === "reveal" && (() => {
          const j = state.lastJudgment;
          const iWon = j?.correct && j.teamId === youAreTeamId;
          const winnerName = j ? state.teams.find((t) => t.id === j.teamId)?.name : null;
          const headline = (() => {
            if (!j?.correct) return "NOBODY GOT IT";
            switch (j.modifier) {
              case "doble":   return "DOUBLE POINTS!";
              case "triple":  return "TRIPLE POINTS!";
              case "jackpot": return "JACKPOT!";
              case "trueque": return "TRADE COMPLETE!";
              default:        return "CORRECT!";
            }
          })();
          const headlineColor = j?.correct ? "var(--avocado)" : "var(--tomato)";
          return (
            <motion.div
              className={styles.center}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14 }}
            >
              <div className={styles.revealHeadline} style={{ color: headlineColor }}>
                {headline}
              </div>
              {j?.correct && (
                <>
                  <div className={styles.revealWho}>
                    {iWon ? "YOU WON!" : `${winnerName} WON`}
                  </div>
                  <div
                    className={styles.revealPoints}
                    style={{ color: (j.pointsDelta ?? 0) >= 0 ? "var(--avocado)" : "var(--tomato)" }}
                  >
                    {(j.pointsDelta ?? 0) >= 0 ? "+" : ""}{j.pointsDelta} pts
                  </div>
                </>
              )}
            </motion.div>
          );
        })()}

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

        {state.phase === "wheel" && (() => {
          const canISpin =
            state.lastWinnerTeamId === youAreTeamId &&
            !state.wheelResult;
          const winnerName = state.lastWinnerTeamId !== null
            ? state.teams.find((t) => t.id === state.lastWinnerTeamId)?.name
            : null;
          return (
            <div className={styles.center}>
              <div className={styles.subtitle}>WHEEL OF MARCO</div>
              {canISpin ? (
                <>
                  <div className={styles.hint}>YOU WON LAST — SPIN IT!</div>
                  <motion.button
                    className={`primary ${styles.bigSpinBtn}`}
                    onClick={() => send({ type: "spinWheel" })}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    animate={{
                      boxShadow: [
                        "0 6px 0 0 var(--ink)",
                        "0 12px 0 0 var(--ink)",
                        "0 6px 0 0 var(--ink)",
                      ],
                    }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    SPIN
                  </motion.button>
                </>
              ) : state.wheelResult ? (
                <div className={styles.hint}>(watch the screen)</div>
              ) : winnerName ? (
                <div className={styles.hint}>waiting for {winnerName} to spin...</div>
              ) : (
                <div className={styles.hint}>(watch the screen)</div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
