"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { MinigameState, Team } from "@/lib/types";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

interface Props {
  mg: MinigameState;
  teams: Team[];
  isHost: boolean;
  onJudge?: (correct: boolean) => void; // unused — Felix overrides
}

export function Felix({ mg, teams, isHost, onJudge }: Props) {
  const flashing = mg.elapsedMs < mg.felixFlashUntilMs;
  const hpFrac = Math.max(0, mg.felixHp / mg.felixHpMax);

  const isShootPhase = mg.status === "shoot1" || mg.status === "shoot2";
  const isThrowing = mg.status === "questionThrow";
  const isCountdown = mg.status === "questionCountdown";
  const isPlay = mg.status === "questionPlay";
  const isBuzzed = mg.status === "questionBuzzed";
  const showQuestion = isPlay || isBuzzed;
  const dying = mg.status === "death" || mg.status === "felixOver";

  // Screen shake on shot + arm impact
  const [shake, setShake] = useState(0);
  const lastShotsRef = useRef(0);
  useEffect(() => {
    if (mg.felixShotsTotal !== lastShotsRef.current) {
      lastShotsRef.current = mg.felixShotsTotal;
      setShake((n) => n + 1);
      const t = setTimeout(() => setShake((n) => Math.max(0, n - 1)), 120);
      return () => clearTimeout(t);
    }
  }, [mg.felixShotsTotal]);

  // Laser bolts
  const [lasers, setLasers] = useState<{ id: number; angle: number }[]>([]);
  useEffect(() => {
    if (mg.felixShotsTotal > 0) {
      const newId = Date.now() + Math.random();
      const angle = -30 + Math.random() * 60;
      setLasers((prev) => [...prev.slice(-10), { id: newId, angle }]);
      const t = setTimeout(() => {
        setLasers((prev) => prev.filter((l) => l.id !== newId));
      }, 280);
      return () => clearTimeout(t);
    }
  }, [mg.felixShotsTotal]);

  // Trigger screen flash on arm impact (end of questionThrow)
  const [armImpact, setArmImpact] = useState(false);
  useEffect(() => {
    if (mg.status === "questionThrow") {
      const id = setTimeout(() => setArmImpact(true), 1300);
      const off = setTimeout(() => setArmImpact(false), 1700);
      return () => { clearTimeout(id); clearTimeout(off); };
    }
  }, [mg.status]);

  // Wipe animation key — bumps each time Felix auto-rejects so the hand can flick.
  const wipeKey = mg.felixRejectionsTotal;

  // Hand is visible from the moment of the slap through the entire question phase.
  const handVisible = isThrowing || isCountdown || isPlay || isBuzzed;

  // Auto play-area dims based on isHost
  const robotW = isHost ? "min(640px, 60vw)" : "min(320px, 84vw)";
  const robotH = isHost ? "min(720px, 70vh)" : "min(380px, 56vh)";

  return (
    <motion.div
      animate={{
        x: shake > 0 ? [0, -6, 8, -4, 0] : 0,
        y: armImpact ? [0, 14, -8, 0] : 0,
      }}
      transition={{ duration: shake > 0 ? 0.12 : 0.25 }}
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
      {/* Dark red wash for danger atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(80, 0, 20, 0.5) 0%, rgba(180, 30, 30, 0.35) 60%, rgba(20, 0, 10, 0.7) 100%)",
        }}
      />

      {/* Pulsing red vignette during shoot phases */}
      {isShootPhase && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 280px rgba(255, 30, 50, 0.7)",
            animation: "felixPulse 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Impact white flash */}
      <AnimatePresence>
        {armImpact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, times: [0, 0.15, 1] }}
            style={{
              position: "absolute",
              inset: 0,
              background: "#ffffff",
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes felixPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes felixHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes felixCorePulse { 0%, 100% { opacity: 0.85; box-shadow: 0 0 28px #ff2a4a, inset 0 0 12px rgba(0,0,0,0.5); } 50% { opacity: 1; box-shadow: 0 0 56px #ff5577, inset 0 0 18px rgba(0,0,0,0.4); } }
        @keyframes felixAntennaBlink { 0%, 60%, 100% { opacity: 1; } 70%, 90% { opacity: 0.2; } }
        @keyframes felixCrumble { 0% { transform: translateY(0) rotate(0); opacity: 1; } 50% { transform: translateY(20vh) rotate(-12deg); opacity: 0.7; } 100% { transform: translateY(120vh) rotate(-40deg); opacity: 0; } }
        @keyframes felixDeathShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
      `}</style>

      {/* HP Bar */}
      {!dying && (
        <div
          style={{
            position: "absolute",
            top: isHost ? 40 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: isHost ? 820 : "85vw",
            maxWidth: "92vw",
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontFamily: "Press Start 2P, monospace",
              fontSize: isHost ? "1.5rem" : "0.85rem",
              color: "#ff2a4a",
              textShadow: "3px 3px 0 #2e2418, 0 0 18px #ff2a4a",
              letterSpacing: 4,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            FELIX 9000
          </div>
          <div
            style={{
              height: isHost ? 30 : 18,
              background: "rgba(0,0,0,0.75)",
              border: "4px solid #2e2418",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 0 22px rgba(255, 50, 80, 0.7), inset 0 4px 0 rgba(255,255,255,0.05)",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${hpFrac * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ff2a4a 0%, #ff7e1e 70%, #ffd166 100%)",
                transition: "width 80ms linear",
                boxShadow: "inset 0 -5px 0 rgba(0,0,0,0.35), inset 0 4px 0 rgba(255,255,255,0.18)",
              }}
            />
            {/* HP scanlines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,0.15) 14px 16px)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Felix Robot */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "8vh",
          transform: "translateX(-50%)",
          width: robotW,
          height: robotH,
          animation: dying
            ? "felixCrumble 2.6s cubic-bezier(0.5, 0, 0.7, 1) forwards"
            : isShootPhase
            ? "felixHover 3.2s ease-in-out infinite"
            : undefined,
          filter: flashing ? "brightness(2.2) saturate(2.5)" : undefined,
          transition: "filter 60ms linear",
          pointerEvents: "none",
        }}
      >
        <RobotBody isHost={isHost} />
      </div>

      {/* Laser bolts */}
      <AnimatePresence>
        {lasers.map((l) => (
          <motion.div
            key={l.id}
            initial={{ y: 0, opacity: 1, scaleY: 0.3 }}
            animate={{ y: "-78vh", opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: "10vh",
              left: "50%",
              width: 8,
              height: 90,
              background: "linear-gradient(180deg, #fff 0%, #00f0ff 30%, #ff2bd6 100%)",
              borderRadius: 5,
              boxShadow: "0 0 20px #00f0ff, 0 0 40px #ff2bd6",
              transform: `translateX(-50%) rotate(${l.angle}deg)`,
              transformOrigin: "50% 100%",
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>

      {/* === GIANT HAND: raises up, slaps down, then covers the screen === */}
      <AnimatePresence>
        {handVisible && (
          <motion.div
            key={`hand-${wipeKey}`}
            initial={
              isThrowing
                ? { y: "-110%", rotate: -20, scale: 1.3 }
                : { y: 0, rotate: 0, scale: 1 }
            }
            animate={
              isThrowing
                ? {
                    y: ["-110%", "-60%", "10%", "0%"],
                    rotate: [-20, -10, 8, 0],
                    scale: [1.3, 1.35, 1.55, 1.5],
                  }
                : isBuzzed
                ? {
                    // Felix wipes the answer away — quick swipe right + tilt
                    x: [0, 80, -40, 0],
                    rotate: [0, 12, -6, 0],
                    scale: [1.5, 1.55, 1.5, 1.5],
                    y: [0, -20, 0, 0],
                  }
                : { y: 0, rotate: 0, scale: 1.5 }
            }
            exit={{ y: "120%", rotate: 25, scale: 1.0, transition: { duration: 0.5 } }}
            transition={
              isThrowing
                ? { duration: 1.7, times: [0, 0.35, 0.75, 1], ease: "easeIn" }
                : isBuzzed
                ? { duration: 0.7, times: [0, 0.3, 0.7, 1], ease: "easeOut" }
                : { duration: 0.3, ease: "easeOut" }
            }
            style={{
              position: "absolute",
              left: "50%",
              top: "30%",
              width: isHost ? "min(1000px, 90vw)" : "min(440px, 95vw)",
              height: isHost ? "min(720px, 70vh)" : "min(380px, 60vh)",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              filter: "drop-shadow(0 18px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 60px rgba(255, 50, 80, 0.7))",
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

      {/* HUGE countdown numbers — only during countdown, NOT during throw */}
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
              top: "30%",
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: "Press Start 2P, monospace",
              fontSize: isHost ? "20rem" : "10rem",
              color: "#ff2a4a",
              textShadow: "8px 8px 0 #2e2418, 0 0 80px #ff2a4a, 0 0 160px #ff5577",
              letterSpacing: 4,
              lineHeight: 1,
              zIndex: 9,
              fontWeight: 700,
            }}
          >
            {Math.max(1, Math.ceil(mg.countdownMs / 1000))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question card — appears only DURING questionPlay/questionBuzzed (after countdown) */}
      <AnimatePresence>
        {showQuestion && mg.felixQuestion && (
          <motion.div
            key="qcard"
            initial={{ scale: 0.4, opacity: 0, y: -80 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: -40 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            style={{
              position: "absolute",
              top: "18%",
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(180deg, #2a0a18 0%, #4a0820 100%)",
              border: "5px solid #ff2a4a",
              borderRadius: 22,
              padding: isHost ? "32px 64px" : "18px 22px",
              boxShadow:
                "0 12px 0 0 #2e2418, 0 0 70px rgba(255, 50, 80, 0.65), inset 0 0 30px rgba(255, 80, 120, 0.25)",
              maxWidth: "86vw",
              minWidth: isHost ? 720 : 280,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: isHost ? "2.6rem" : "1.3rem",
              color: "#fff",
              textShadow: "3px 3px 0 #2e2418, 0 0 16px #ff2a4a",
              textAlign: "center",
              fontWeight: 700,
              letterSpacing: 1,
              zIndex: 9,
            }}
          >
            {/* corner rivets */}
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
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 30% 30%, #ff8aa8 0%, #ff2a4a 60%, #5a0010 100%)",
                  boxShadow: "0 0 10px #ff2a4a, inset 0 -2px 0 rgba(0,0,0,0.4)",
                }}
              />
            ))}
            {mg.felixQuestion}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Felix questionPlay HUD timer */}
      {isPlay && (
        <div
          style={{
            position: "absolute",
            top: "62%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "VT323, monospace",
            fontSize: isHost ? "2.4rem" : "1.3rem",
            color: "#fff",
            textShadow: "3px 3px 0 #2e2418, 0 0 14px #ff2a4a",
            letterSpacing: 3,
            zIndex: 5,
          }}
        >
          {Math.max(0, Math.ceil(mg.countdownMs / 1000))}s — BUZZ!
        </div>
      )}

      {/* Felix auto-rejects every buzz — show a "NO!" stamp */}
      {isBuzzed && (
        <motion.div
          initial={{ scale: 0, rotate: -25, opacity: 0 }}
          animate={{ scale: 1.3, rotate: -8, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 12 }}
          style={{
            position: "absolute",
            top: "44%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontFamily: "Press Start 2P, monospace",
            fontSize: isHost ? "9rem" : "4rem",
            color: "#ff2a4a",
            textShadow: "6px 6px 0 #2e2418, 0 0 80px #ff2a4a, 0 0 160px #ff5577",
            letterSpacing: 6,
            zIndex: 10,
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
    </motion.div>
  );
}

// ----- ROBOT BODY -----
function RobotBody({ isHost }: { isHost: boolean }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Big armored shoulder plates */}
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

      {/* Shoulder cannon barrels */}
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

      {/* Main chest plate */}
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
        {/* Hazard stripes top */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "12%",
            right: "12%",
            height: 10,
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff700 0 12px, #1a1a22 12px 24px)",
            borderRadius: 4,
            border: "2px solid #0a0a12",
          }}
        />

        {/* Glowing core */}
        <div
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

        {/* Heat vents */}
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

        {/* Bolts (corners) */}
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

      {/* Helmet / face plate */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "0%",
          transform: "translateX(-50%)",
          width: "52%",
          height: "44%",
          borderRadius: "50% 50% 30% 30%",
          background:
            "linear-gradient(180deg, #4a4a55 0%, #2a2a35 60%, #1a1a22 100%)",
          border: "6px solid #0a0a12",
          overflow: "hidden",
          boxShadow:
            "0 0 40px rgba(255, 50, 80, 0.55), inset 0 -10px 0 rgba(0,0,0,0.3), inset 0 6px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Visor glow ring around the face */}
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
          <img
            src="/marco/felix.png"
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* scanline */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.25) 3px 4px)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Side antennas */}
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

        {/* Mouth grille */}
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

// ----- GIANT PALM (slap + covers screen) -----
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
      </defs>

      {/* Fingers (4 + thumb) */}
      {[16, 32, 48, 64].map((x, i) => (
        <g key={i}>
          <rect x={x} y={6} width={12} height={36} rx={6} fill="url(#fingerGrad)" stroke="#0a0a12" strokeWidth={1.2} />
          {/* knuckle line */}
          <rect x={x + 1} y={14} width={10} height={2.2} fill="#0a0a12" opacity={0.6} />
          <rect x={x + 1} y={26} width={10} height={2.2} fill="#0a0a12" opacity={0.6} />
        </g>
      ))}
      {/* Thumb */}
      <rect x={78} y={28} width={14} height={28} rx={6} fill="url(#fingerGrad)" stroke="#0a0a12" strokeWidth={1.2} transform="rotate(28 85 42)" />

      {/* Palm */}
      <rect x={10} y={40} width={70} height={56} rx={12} fill="url(#palmGrad)" stroke="#0a0a12" strokeWidth={1.5} />

      {/* Hazard stripe across palm */}
      <rect x={14} y={56} width={62} height={6} fill="#fff700" stroke="#0a0a12" strokeWidth={0.6} />
      <rect x={14} y={56} width={62} height={6} fill="url(#hazPat)" />
      <pattern id="hazPat" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <rect width="3" height="6" fill="#1a1a22" />
        <rect x="3" width="3" height="6" fill="#fff700" />
      </pattern>

      {/* Red glowing core in palm */}
      <circle cx={45} cy={76} r={8} fill="#ff2a4a" stroke="#0a0a12" strokeWidth={1.2}>
        <animate attributeName="r" values="7;9;7" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx={45} cy={76} r={4} fill="#fff" opacity={0.8} />

      {/* Rivets */}
      {[
        [18, 46], [70, 46], [18, 90], [70, 90],
        [44, 46], [44, 90],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={2.2} fill="#aaa" stroke="#0a0a12" strokeWidth={0.5} />
      ))}

      {/* Heat vents at bottom */}
      <g>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={20 + i * 18} y={92} width={12} height={4} rx={1} fill="#ff2a4a" opacity={0.85}>
            <animate attributeName="opacity" values="0.6;1;0.6" dur="0.9s" repeatCount="indefinite" />
          </rect>
        ))}
      </g>
    </svg>
  );
}

// ----- THROWING ARM -----
function RobotArm({ isHost }: { isHost: boolean }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Upper arm (right) */}
      <div
        style={{
          position: "absolute",
          right: "0%",
          top: "20%",
          width: "55%",
          height: "60%",
          background: "linear-gradient(180deg, #6a6a78 0%, #2a2a35 100%)",
          border: "5px solid #0a0a12",
          borderRadius: "20% 60% 30% 50%",
          boxShadow: "inset -10px -10px 0 rgba(0,0,0,0.4)",
        }}
      />
      {/* Elbow joint */}
      <div
        style={{
          position: "absolute",
          left: "42%",
          top: "30%",
          width: "20%",
          height: "60%",
          background: "radial-gradient(circle at 35% 30%, #888 0%, #2a2a35 70%, #0a0a12 100%)",
          border: "4px solid #0a0a12",
          borderRadius: "50%",
          boxShadow: "inset -4px -4px 0 rgba(0,0,0,0.3)",
        }}
      />
      {/* Forearm */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "26%",
          width: "44%",
          height: "55%",
          background: "linear-gradient(180deg, #5a5a68 0%, #1a1a22 100%)",
          border: "5px solid #0a0a12",
          borderRadius: "40% 30% 50% 60%",
          boxShadow: "inset 8px -8px 0 rgba(0,0,0,0.3)",
        }}
      />
      {/* Fist */}
      <div
        style={{
          position: "absolute",
          left: "-10%",
          top: "10%",
          width: "30%",
          height: "85%",
          background: "linear-gradient(160deg, #6a6a78 0%, #2a2a35 100%)",
          border: "6px solid #0a0a12",
          borderRadius: "40% 35% 50% 55%",
          boxShadow:
            "inset -8px -10px 0 rgba(0,0,0,0.45), 0 0 50px rgba(255, 50, 80, 0.55)",
        }}
      >
        {/* Hazard stripes on knuckles */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "10%",
            right: "10%",
            height: 12,
            backgroundImage:
              "repeating-linear-gradient(45deg, #fff700 0 10px, #1a1a22 10px 20px)",
            borderRadius: 4,
          }}
        />
        {/* Glow line */}
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: "15%",
            right: "15%",
            height: 6,
            background: "#ff2a4a",
            borderRadius: 3,
            boxShadow: "0 0 12px #ff2a4a",
          }}
        />
      </div>
    </div>
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
