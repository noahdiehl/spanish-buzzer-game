"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { MinigameState, Team } from "@/lib/types";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

interface Props {
  mg: MinigameState;
  teams: Team[];
  isHost: boolean;
  onJudge?: (correct: boolean) => void;
}

const SHAKE_THROTTLE_MS = 220;
const MAX_LASERS = 3;

export function Felix({ mg, teams, isHost }: Props) {
  const flashing = mg.elapsedMs < mg.felixFlashUntilMs;
  const hpFrac = Math.max(0, mg.felixHp / mg.felixHpMax);

  const isShootPhase = mg.status === "shoot1" || mg.status === "shoot2";
  const isThrowing = mg.status === "questionThrow";
  const isCountdown = mg.status === "questionCountdown";
  const isPlay = mg.status === "questionPlay";
  const isBuzzed = mg.status === "questionBuzzed";
  const showQuestion = isCountdown || isPlay || isBuzzed;
  const dying = mg.status === "death" || mg.status === "felixOver";

  // === Screen shake (throttled) ===
  const [shakeTick, setShakeTick] = useState(0);
  const lastShakeAt = useRef(0);
  const lastShotsRef = useRef(0);
  useEffect(() => {
    if (mg.felixShotsTotal !== lastShotsRef.current) {
      lastShotsRef.current = mg.felixShotsTotal;
      const now = Date.now();
      if (now - lastShakeAt.current > SHAKE_THROTTLE_MS) {
        lastShakeAt.current = now;
        setShakeTick((n) => n + 1);
      }
    }
  }, [mg.felixShotsTotal]);

  // === Lasers (capped) ===
  const [lasers, setLasers] = useState<{ id: number; angle: number }[]>([]);
  const lastLaserShotsRef = useRef(0);
  useEffect(() => {
    if (mg.felixShotsTotal !== lastLaserShotsRef.current) {
      lastLaserShotsRef.current = mg.felixShotsTotal;
      const id = Date.now() + Math.random();
      const angle = -25 + Math.random() * 50;
      setLasers((prev) => [...prev, { id, angle }].slice(-MAX_LASERS));
      const t = setTimeout(() => {
        setLasers((prev) => prev.filter((l) => l.id !== id));
      }, 260);
      return () => clearTimeout(t);
    }
  }, [mg.felixShotsTotal]);

  // Robot dimensions
  const robotW = isHost ? "min(560px, 50vw)" : "min(280px, 70vw)";
  const robotH = isHost ? "min(640px, 64vh)" : "min(340px, 50vh)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50000,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url('/marco/felix_bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.15) brightness(0.7)",
        }}
      />
      {/* Dark red wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(80, 0, 20, 0.5) 0%, rgba(180, 30, 30, 0.35) 60%, rgba(20, 0, 10, 0.7) 100%)",
        }}
      />

      {/* Pulsing red vignette during shoot phases */}
      {isShootPhase && (
        <div
          className="felix-pulse"
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 280px rgba(255, 30, 50, 0.7)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* CSS-only screen shake — keyed off shakeTick */}
      {shakeTick > 0 && (
        <div
          key={shakeTick}
          style={{
            position: "absolute",
            inset: 0,
            animation: "felixShake 0.14s ease-out",
            pointerEvents: "none",
          }}
        />
      )}

      <style>{`
        @keyframes felixPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .felix-pulse { animation: felixPulse 1.5s ease-in-out infinite; }
        @keyframes felixWalk {
          0% { transform: translateX(-18vw); }
          50% { transform: translateX(18vw); }
          100% { transform: translateX(-18vw); }
        }
        @keyframes felixHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes felixShake {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-8px, 4px); }
          50% { transform: translate(7px, -3px); }
          75% { transform: translate(-4px, 6px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes felixCorePulse {
          0%, 100% { opacity: 0.85; box-shadow: 0 0 28px #ff2a4a, inset 0 0 12px rgba(0,0,0,0.5); }
          50% { opacity: 1; box-shadow: 0 0 56px #ff5577, inset 0 0 18px rgba(0,0,0,0.4); }
        }
        @keyframes felixAntennaBlink { 0%, 60%, 100% { opacity: 1; } 70%, 90% { opacity: 0.2; } }
        @keyframes felixCrumble {
          0% { transform: translateY(0) rotate(0); opacity: 1; }
          50% { transform: translateY(20vh) rotate(-12deg); opacity: 0.7; }
          100% { transform: translateY(120vh) rotate(-40deg); opacity: 0; }
        }
        @keyframes handFlash {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* HP Bar — smaller */}
      {!dying && (
        <div
          style={{
            position: "absolute",
            top: isHost ? 28 : 18,
            left: "50%",
            transform: "translateX(-50%)",
            width: isHost ? 460 : "65vw",
            maxWidth: "85vw",
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontFamily: "Press Start 2P, monospace",
              fontSize: isHost ? "0.95rem" : "0.7rem",
              color: "#ff2a4a",
              textShadow: "2px 2px 0 #2e2418, 0 0 14px #ff2a4a",
              letterSpacing: 3,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            FELIX 9000
          </div>
          <div
            style={{
              height: isHost ? 18 : 12,
              background: "rgba(0,0,0,0.75)",
              border: "3px solid #2e2418",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 0 16px rgba(255, 50, 80, 0.6), inset 0 3px 0 rgba(255,255,255,0.05)",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${hpFrac * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ff2a4a 0%, #ff7e1e 70%, #ffd166 100%)",
                transition: "width 120ms linear",
                boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.35), inset 0 3px 0 rgba(255,255,255,0.18)",
              }}
            />
          </div>
        </div>
      )}

      {/* Felix Robot — outer walks, inner hovers */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "8vh",
          width: robotW,
          height: robotH,
          marginLeft: `calc(${robotW} / -2)`,
          animation: dying
            ? "felixCrumble 2.6s cubic-bezier(0.5, 0, 0.7, 1) forwards"
            : isShootPhase
            ? "felixWalk 5.5s ease-in-out infinite"
            : undefined,
          filter: flashing ? "brightness(2.2) saturate(2.5)" : undefined,
          transition: "filter 80ms linear",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            animation: isShootPhase && !dying ? "felixHover 3.4s ease-in-out infinite" : undefined,
          }}
        >
          <RobotBody />
        </div>
      </div>

      {/* Laser bolts */}
      {lasers.map((l) => (
        <div
          key={l.id}
          style={{
            position: "absolute",
            bottom: "8vh",
            left: "50%",
            width: 8,
            height: 90,
            background: "linear-gradient(180deg, #fff 0%, #00f0ff 30%, #ff2bd6 100%)",
            borderRadius: 5,
            boxShadow: "0 0 16px #00f0ff, 0 0 32px #ff2bd6",
            transform: `translateX(-50%) rotate(${l.angle}deg)`,
            transformOrigin: "50% 100%",
            animation: "laserFly 0.26s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      ))}
      <style>{`
        @keyframes laserFly {
          0% { transform: translate(-50%, 0) rotate(var(--a, 0deg)); opacity: 1; }
          100% { transform: translate(-50%, -78vh) rotate(var(--a, 0deg)); opacity: 0; }
        }
      `}</style>

      {/* Hand — slaps in during questionThrow + briefly during rejection */}
      <AnimatePresence>
        {(isThrowing || isBuzzed) && (
          <motion.div
            key={isBuzzed ? `reject-${mg.felixRejectionsTotal}` : "slap"}
            initial={{ y: "-110%", rotate: -25, scale: 1.2, opacity: 0 }}
            animate={
              isThrowing
                ? {
                    y: ["−110%", "-40%", "5%", "0%"] as unknown as number[],
                    rotate: [-25, -10, 8, 0],
                    scale: [1.2, 1.3, 1.45, 1.4],
                    opacity: 1,
                  }
                : {
                    y: ["−110%", "-5%", "0%"] as unknown as number[],
                    rotate: [-15, 12, 0],
                    scale: [1.2, 1.3, 1.25],
                    opacity: 1,
                  }
            }
            exit={{ y: "120%", rotate: 20, scale: 1, opacity: 0, transition: { duration: 0.35 } }}
            transition={{
              duration: isThrowing ? 1.6 : 0.5,
              ease: "easeIn",
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: "15%",
              width: isHost ? "min(680px, 65vw)" : "min(340px, 75vw)",
              height: isHost ? "min(620px, 65vh)" : "min(380px, 60vh)",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              filter: "drop-shadow(0 18px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 50px rgba(255, 50, 80, 0.65))",
              zIndex: 6,
            }}
          >
            <GiantPalm />
          </motion.div>
        )}
      </AnimatePresence>

      {/* === STATUS OVERLAYS === */}
      {mg.status === "intro" && (
        <CenterText big={isHost} color="#ff2a4a" subtle={isHost ? "BOSS BATTLE" : null}>
          DESTROY FELIX
        </CenterText>
      )}

      {isShootPhase && (
        <div
          style={{
            position: "absolute",
            bottom: isHost ? 60 : 100,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Press Start 2P, monospace",
            fontSize: isHost ? "1.6rem" : "0.95rem",
            color: "#fff",
            textShadow: "3px 3px 0 #2e2418, 0 0 18px #ff2a4a",
            letterSpacing: 4,
            zIndex: 4,
          }}
        >
          {isHost ? "SMASH SPACEBAR" : "TAP / SPACE = SHOOT"}
        </div>
      )}

      {/* HUGE countdown numbers */}
      <AnimatePresence mode="popLayout">
        {isCountdown && (
          <motion.div
            key={Math.max(1, Math.ceil(mg.countdownMs / 1000))}
            initial={{ scale: 0.1, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            style={{
              position: "absolute",
              top: "25%",
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: "Press Start 2P, monospace",
              fontSize: isHost ? "20rem" : "10rem",
              color: "#ff2a4a",
              textShadow: "8px 8px 0 #2e2418, 0 0 80px #ff2a4a, 0 0 160px #ff5577",
              letterSpacing: 4,
              lineHeight: 1,
              zIndex: 11,
              fontWeight: 700,
            }}
          >
            {Math.max(1, Math.ceil(mg.countdownMs / 1000))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question card */}
      <AnimatePresence>
        {showQuestion && mg.felixQuestion && !isCountdown && (
          <motion.div
            key="qcard"
            initial={{ scale: 0.4, opacity: 0, y: -40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(180deg, #2a0a18 0%, #4a0820 100%)",
              border: "5px solid #ff2a4a",
              borderRadius: 22,
              padding: isHost ? "30px 60px" : "16px 22px",
              boxShadow:
                "0 12px 0 0 #2e2418, 0 0 70px rgba(255, 50, 80, 0.65), inset 0 0 30px rgba(255, 80, 120, 0.25)",
              maxWidth: "82vw",
              minWidth: isHost ? 640 : 260,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: isHost ? "2.4rem" : "1.2rem",
              color: "#fff",
              textShadow: "3px 3px 0 #2e2418, 0 0 16px #ff2a4a",
              textAlign: "center",
              fontWeight: 700,
              letterSpacing: 1,
              zIndex: 9,
            }}
          >
            {[
              { top: 10, left: 10 },
              { top: 10, right: 10 },
              { bottom: 10, left: 10 },
              { bottom: 10, right: 10 },
            ].map((pos, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 30% 30%, #ff8aa8 0%, #ff2a4a 60%, #5a0010 100%)",
                  boxShadow: "0 0 8px #ff2a4a, inset 0 -2px 0 rgba(0,0,0,0.4)",
                }}
              />
            ))}
            {mg.felixQuestion}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play timer */}
      {isPlay && (
        <div
          style={{
            position: "absolute",
            top: "72%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "VT323, monospace",
            fontSize: isHost ? "2.2rem" : "1.2rem",
            color: "#fff",
            textShadow: "3px 3px 0 #2e2418, 0 0 14px #ff2a4a",
            letterSpacing: 3,
            zIndex: 5,
          }}
        >
          {Math.max(0, Math.ceil(mg.countdownMs / 1000))}s — BUZZ!
        </div>
      )}

      {/* Felix auto-rejects — show "NO!" stamp */}
      {isBuzzed && (
        <motion.div
          initial={{ scale: 0, rotate: -25, opacity: 0 }}
          animate={{ scale: 1.3, rotate: -8, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 12 }}
          style={{
            position: "absolute",
            top: "22%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: "Press Start 2P, monospace",
            fontSize: isHost ? "7rem" : "4rem",
            color: "#ff2a4a",
            textShadow: "6px 6px 0 #2e2418, 0 0 80px #ff2a4a, 0 0 160px #ff5577",
            letterSpacing: 6,
            zIndex: 12,
            pointerEvents: "none",
          }}
        >
          NO!
        </motion.div>
      )}

      {(mg.status === "death" || mg.status === "felixOver") && (
        <CenterText big={isHost} color="#39ff14">
          FELIX DEFEATED
        </CenterText>
      )}
    </div>
  );
}

// ----- ROBOT BODY -----
function RobotBody() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Shoulder plates */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "-12%",
          width: "44%",
          height: "30%",
          background: "linear-gradient(160deg, #6a6a78 0%, #2a2a35 100%)",
          border: "5px solid #1a1a22",
          borderRadius: "60% 30% 50% 40%",
          boxShadow: "inset -10px -10px 0 rgba(0,0,0,0.4), 4px 8px 0 #1a1a22",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "-12%",
          width: "44%",
          height: "30%",
          background: "linear-gradient(200deg, #6a6a78 0%, #2a2a35 100%)",
          border: "5px solid #1a1a22",
          borderRadius: "30% 60% 40% 50%",
          boxShadow: "inset 10px -10px 0 rgba(0,0,0,0.4), -4px 8px 0 #1a1a22",
        }}
      />
      {/* Shoulder cannons */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            top: "26%",
            left: side === -1 ? "-2%" : undefined,
            right: side === 1 ? "-2%" : undefined,
            width: "12%",
            height: "20%",
            background: "linear-gradient(180deg, #4a4a55 0%, #1a1a22 100%)",
            border: "4px solid #0a0a12",
            borderRadius: 8,
            transform: `rotate(${side * 15}deg)`,
            boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.4)",
          }}
        />
      ))}
      {/* Chest plate */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          transform: "translateX(-50%)",
          width: "70%",
          height: "55%",
          background: "linear-gradient(180deg, #5a5a68 0%, #2a2a35 50%, #1a1a22 100%)",
          border: "6px solid #0a0a12",
          borderRadius: "32% 32% 18% 18%",
          boxShadow:
            "inset -12px -12px 0 rgba(0,0,0,0.4), inset 8px 8px 0 rgba(255,255,255,0.08), 0 14px 0 #1a1a22",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "12%",
            right: "12%",
            height: 10,
            backgroundImage: "repeating-linear-gradient(45deg, #fff700 0 12px, #1a1a22 12px 24px)",
            borderRadius: 4,
            border: "2px solid #0a0a12",
          }}
        />
        <div
          className="felix-core"
          style={{
            position: "absolute",
            left: "50%",
            top: "32%",
            transform: "translate(-50%, 0)",
            width: "44%",
            height: "32%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, #ffd1d8 0%, #ff5577 30%, #ff2a4a 60%, #5a0010 100%)",
            border: "5px solid #0a0a12",
            animation: "felixCorePulse 1.4s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "16%",
            left: "18%",
            right: "18%",
            height: 18,
            background: "repeating-linear-gradient(90deg, #0a0a12 0 8px, #ff2a4a 8px 12px)",
            borderRadius: 4,
            border: "2px solid #0a0a12",
            boxShadow: "0 0 14px rgba(255, 50, 80, 0.6)",
          }}
        />
        {[
          { top: 8, left: 8 },
          { top: 8, right: 8 },
          { bottom: 8, left: 8 },
          { bottom: 8, right: 8 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #bbb 0%, #555 60%, #1a1a22 100%)",
              border: "2px solid #0a0a12",
            }}
          />
        ))}
      </div>
      {/* Helmet */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "0%",
          transform: "translateX(-50%)",
          width: "52%",
          height: "44%",
          borderRadius: "50% 50% 30% 30%",
          background: "linear-gradient(180deg, #4a4a55 0%, #2a2a35 60%, #1a1a22 100%)",
          border: "6px solid #0a0a12",
          overflow: "hidden",
          boxShadow:
            "0 0 40px rgba(255, 50, 80, 0.55), inset 0 -10px 0 rgba(0,0,0,0.3), inset 0 6px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "9% 12% 30% 12%",
            borderRadius: "50%",
            border: "4px solid #ff2a4a",
            boxShadow: "0 0 18px #ff2a4a, inset 0 0 14px rgba(255, 50, 80, 0.4)",
            overflow: "hidden",
            background: "#0a0a12",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marco/felix.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.25) 3px 4px)",
              pointerEvents: "none",
            }}
          />
        </div>
        {[-1, 1].map((s) => (
          <div
            key={s}
            style={{
              position: "absolute",
              top: -16,
              left: s === -1 ? "20%" : undefined,
              right: s === 1 ? "20%" : undefined,
              width: 6,
              height: 26,
              background: "#1a1a22",
              transformOrigin: "bottom center",
              transform: `rotate(${s * -18}deg)`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -10,
                left: -4,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#ff2a4a",
                boxShadow: "0 0 12px #ff2a4a",
                animation: "felixAntennaBlink 1.2s ease-in-out infinite",
              }}
            />
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "26%",
            right: "26%",
            height: 14,
            background: "repeating-linear-gradient(90deg, #0a0a12 0 5px, #4a4a55 5px 9px)",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

// ----- GIANT PALM (slap + reject) -----
function GiantPalm() {
  return (
    <svg viewBox="0 0 100 110" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="palmGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a7a88" />
          <stop offset="60%" stopColor="#3a3a45" />
          <stop offset="100%" stopColor="#1a1a22" />
        </linearGradient>
        <linearGradient id="fingerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#888896" />
          <stop offset="100%" stopColor="#2a2a35" />
        </linearGradient>
        <pattern id="hazPat" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="3" height="6" fill="#1a1a22" />
          <rect x="3" width="3" height="6" fill="#fff700" />
        </pattern>
      </defs>
      {[16, 32, 48, 64].map((x, i) => (
        <g key={i}>
          <rect x={x} y={6} width={12} height={36} rx={6} fill="url(#fingerGrad)" stroke="#0a0a12" strokeWidth={1.2} />
          <rect x={x + 1} y={14} width={10} height={2.2} fill="#0a0a12" opacity={0.6} />
          <rect x={x + 1} y={26} width={10} height={2.2} fill="#0a0a12" opacity={0.6} />
        </g>
      ))}
      <rect x={78} y={28} width={14} height={28} rx={6} fill="url(#fingerGrad)" stroke="#0a0a12" strokeWidth={1.2} transform="rotate(28 85 42)" />
      <rect x={10} y={40} width={70} height={56} rx={12} fill="url(#palmGrad)" stroke="#0a0a12" strokeWidth={1.5} />
      <rect x={14} y={56} width={62} height={6} fill="url(#hazPat)" stroke="#0a0a12" strokeWidth={0.6} />
      <circle cx={45} cy={76} r={8} fill="#ff2a4a" stroke="#0a0a12" strokeWidth={1.2} />
      <circle cx={45} cy={76} r={4} fill="#fff" opacity={0.8} />
      {[[18, 46], [70, 46], [18, 90], [70, 90], [44, 46], [44, 90]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={2.2} fill="#aaa" stroke="#0a0a12" strokeWidth={0.5} />
      ))}
    </svg>
  );
}

function CenterText({
  children,
  color,
  big,
  subtle,
}: {
  children: React.ReactNode;
  color: string;
  big?: boolean;
  subtle?: string | null;
}) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "absolute",
        top: "38%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: "Press Start 2P, monospace",
        fontSize: big ? "5.5rem" : "2rem",
        color,
        textShadow: `6px 6px 0 #2e2418, 0 0 50px ${color}`,
        letterSpacing: 5,
        zIndex: 9,
      }}
    >
      {children}
      {subtle && (
        <div
          style={{
            fontSize: "1.2rem",
            color: "#fff",
            marginTop: 18,
            letterSpacing: 6,
            opacity: 0.85,
          }}
        >
          {subtle}
        </div>
      )}
    </motion.div>
  );
}
