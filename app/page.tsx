"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/useGame";
import { Flappy } from "./Flappy";
import { DrawCanvas } from "./DrawCanvas";
import { Banana } from "./Banana";
import { Geom } from "./Geom";
import { Felix } from "./Felix";
import styles from "./play.module.css";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

export default function PlayPage() {
  const { state, youAreTeamId, send, connected, error } = useGame("player");
  const [name, setName] = useState("");
  const [drawSubmitTrigger, setDrawSubmitTrigger] = useState(0);
  const [viewportW, setViewportW] = useState(420);

  // Track real viewport width on the client (avoids SSR/hydration mismatch).
  useEffect(() => {
    const update = () => setViewportW(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
      // Minigame: spacebar = flap (flappy) or jump (geom) or shoot/buzz (felix)
      if (state?.phase === "minigame" && state.minigame) {
        const k = state.minigame.kind;
        const s = state.minigame.status;
        if (k === "flappy" && s === "playing") {
          e.preventDefault();
          send({ type: "flap" });
          return;
        }
        if (k === "geom" && s === "playing") {
          e.preventDefault();
          send({ type: "jump" });
          return;
        }
        if (k === "felix" && (s === "shoot1" || s === "shoot2")) {
          e.preventDefault();
          send({ type: "shoot" });
          return;
        }
        if (k === "felix" && s === "questionPlay") {
          e.preventDefault();
          send({ type: "buzz" });
          return;
        }
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

        {state.phase === "minigame" && state.minigame?.kind === "felix" && (() => {
          const mg = state.minigame!;
          const isShoot = mg.status === "shoot1" || mg.status === "shoot2";
          const isPlay = mg.status === "questionPlay";
          const buzzedWrong = mg.felixBuzzedWrong?.includes(youAreTeamId!) ?? false;
          return (
            <>
              <Felix mg={mg} teams={state.teams} isHost={false} />
              {(isShoot || isPlay) && (
                <div
                  style={{
                    position: "fixed",
                    bottom: 24,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    zIndex: 60000,
                    pointerEvents: "none",
                  }}
                >
                  {isShoot && (
                    <motion.button
                      onClick={() => send({ type: "shoot" })}
                      whileTap={{ scale: 0.92 }}
                      style={{
                        pointerEvents: "auto",
                        background: "#ff2a4a",
                        color: "#fff",
                        border: "4px solid #2e2418",
                        borderRadius: 18,
                        padding: "22px 48px",
                        fontFamily: "Press Start 2P, monospace",
                        fontSize: "1.4rem",
                        letterSpacing: 4,
                        boxShadow: "0 8px 0 0 #2e2418, 0 0 30px #ff2a4a",
                        cursor: "pointer",
                      }}
                    >
                      SHOOT
                    </motion.button>
                  )}
                  {isPlay && !buzzedWrong && (
                    <motion.button
                      onClick={() => send({ type: "buzz" })}
                      whileTap={{ scale: 0.92 }}
                      style={{
                        pointerEvents: "auto",
                        background: "#fff700",
                        color: "#2e2418",
                        border: "4px solid #2e2418",
                        borderRadius: 18,
                        padding: "22px 48px",
                        fontFamily: "Press Start 2P, monospace",
                        fontSize: "1.4rem",
                        letterSpacing: 4,
                        boxShadow: "0 8px 0 0 #2e2418, 0 0 30px #fff700",
                        cursor: "pointer",
                      }}
                    >
                      BUZZ
                    </motion.button>
                  )}
                  {isPlay && buzzedWrong && (
                    <div
                      style={{
                        pointerEvents: "none",
                        background: "#2e2418",
                        color: "#ff2a4a",
                        border: "3px solid #ff2a4a",
                        borderRadius: 14,
                        padding: "14px 28px",
                        fontFamily: "Press Start 2P, monospace",
                        fontSize: "0.9rem",
                        letterSpacing: 3,
                      }}
                    >
                      LOCKED OUT — FELIX SAID NO
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}

        {state.phase === "minigame" && state.minigame?.kind === "geom" && (() => {
          const mg = state.minigame!;
          const w = Math.min(440, viewportW - 24);
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
          const w = Math.min(440, viewportW - 24);
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
          const isBananaLoss = j && !j.correct && (j.pointsDelta ?? 0) < 0;
          const iWasHit = isBananaLoss && j.teamId === youAreTeamId;
          const iWon = j?.correct && j.teamId === youAreTeamId;
          const subjectName = j ? state.teams.find((t) => t.id === j.teamId)?.name : null;
          const headline = (() => {
            if (isBananaLoss) return "BANANA TAX!";
            if (!j?.correct) return "NOBODY GOT IT";
            switch (j.modifier) {
              case "doble":   return "DOUBLE POINTS!";
              case "triple":  return "TRIPLE POINTS!";
              case "jackpot": return "JACKPOT!";
              case "trueque": return "TRADE COMPLETE!";
              default:        return "CORRECT!";
            }
          })();
          const headlineColor = (j?.correct ? "var(--avocado)" : "var(--tomato)");
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
              {(j?.correct || isBananaLoss) && (
                <>
                  <div className={styles.revealWho}>
                    {iWon
                      ? "YOU WON!"
                      : iWasHit
                      ? "YOU GOT HIT!"
                      : isBananaLoss
                      ? `${subjectName} GOT HIT`
                      : `${subjectName} WON`}
                  </div>
                  <div
                    className={styles.revealPoints}
                    style={{ color: (j!.pointsDelta ?? 0) >= 0 ? "var(--avocado)" : "var(--tomato)" }}
                  >
                    {(j!.pointsDelta ?? 0) >= 0 ? "+" : ""}{j!.pointsDelta.toLocaleString()} pts
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
