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

export function Felix({ mg, teams, isHost, onJudge }: Props) {
  const flashing = mg.elapsedMs < mg.felixFlashUntilMs;
  const hpFrac = Math.max(0, mg.felixHp / mg.felixHpMax);

  // Walking animation — pure CSS keyframe driven by status
  const walking = mg.status === "shoot1" || mg.status === "shoot2";
  const dying = mg.status === "death" || mg.status === "felixOver";
  const isShootPhase = mg.status === "shoot1" || mg.status === "shoot2";

  // Laser blast effects — spawn briefly on each new shot
  const [lasers, setLasers] = useState<{ id: number; angle: number }[]>([]);
  const lastShotsRef = useRef(0);
  useEffect(() => {
    if (mg.felixShotsTotal !== lastShotsRef.current) {
      const newShots = mg.felixShotsTotal - lastShotsRef.current;
      lastShotsRef.current = mg.felixShotsTotal;
      // Spawn a couple of lasers max per state update
      const burst = Math.min(3, newShots);
      const fresh: { id: number; angle: number }[] = [];
      for (let i = 0; i < burst; i++) {
        fresh.push({
          id: Date.now() + Math.random(),
          angle: -25 + Math.random() * 50,
        });
      }
      setLasers((prev) => [...prev, ...fresh].slice(-12));
      const timeout = setTimeout(() => {
        setLasers((prev) => prev.slice(burst));
      }, 350);
      return () => clearTimeout(timeout);
    }
  }, [mg.felixShotsTotal]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50000,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, #1a0033 0%, #4a0050 35%, #8a1530 70%, #b03020 100%)",
        pointerEvents: "none",
      }}
    >
      {/* Distant grid floor */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "30vh",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255, 50, 70, 0.35) 100%)," +
            "repeating-linear-gradient(90deg, transparent 0 60px, rgba(255,80,120,0.25) 60px 62px)",
          perspective: 400,
          transformStyle: "preserve-3d",
        }}
      />

      {/* Pulsing red vignette during shoot phases */}
      {isShootPhase && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 200px rgba(255, 30, 50, 0.55)",
            animation: "felixPulse 1.5s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <style>{`
        @keyframes felixPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes felixWalk { 0% { transform: translateX(-12vw); } 50% { transform: translateX(12vw); } 100% { transform: translateX(-12vw); } }
        @keyframes felixCrumble { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(120vh) rotate(-25deg); opacity: 0; } }
      `}</style>

      {/* HP Bar */}
      {!dying && (
        <div
          style={{
            position: "absolute",
            top: isHost ? 40 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: isHost ? 720 : "85vw",
            maxWidth: "85vw",
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontFamily: "Press Start 2P, monospace",
              fontSize: isHost ? "1.3rem" : "0.85rem",
              color: "#ff2a4a",
              textShadow: "3px 3px 0 #2e2418",
              letterSpacing: 3,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            FELIX 9000
          </div>
          <div
            style={{
              height: isHost ? 24 : 16,
              background: "rgba(0,0,0,0.6)",
              border: "3px solid #2e2418",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 0 16px rgba(255, 50, 80, 0.6)",
            }}
          >
            <div
              style={{
                width: `${hpFrac * 100}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, #ff2a4a 0%, #ff7e1e 100%)",
                transition: "width 80ms linear",
                boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.3)",
              }}
            />
          </div>
        </div>
      )}

      {/* Felix robot (upper body) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "12vh",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          pointerEvents: "none",
          animation: walking
            ? "felixWalk 5s ease-in-out infinite"
            : dying
            ? "felixCrumble 2.5s ease-in forwards"
            : undefined,
        }}
      >
        <div
          style={{
            position: "relative",
            width: isHost ? 520 : 280,
            height: isHost ? 560 : 320,
            filter: flashing ? "brightness(2.5) saturate(2)" : undefined,
            transition: "filter 60ms linear",
          }}
        >
          {/* Robot body — chunky metal torso */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "44%",
              transform: "translateX(-50%)",
              width: "92%",
              height: "55%",
              background:
                "linear-gradient(180deg, #4a4a55 0%, #2a2a35 100%)",
              border: "6px solid #1a1a22",
              borderRadius: "30% 30% 18% 18%",
              boxShadow:
                "inset -10px -10px 0 rgba(0,0,0,0.3), inset 6px 6px 0 rgba(255,255,255,0.07), 0 12px 0 #1a1a22",
            }}
          >
            {/* Chest LEDs */}
            <div
              style={{
                position: "absolute",
                top: "28%",
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 16,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ff2a4a",
                    boxShadow: "0 0 12px #ff2a4a",
                    border: "2px solid #1a1a22",
                  }}
                />
              ))}
            </div>
            {/* Vent / mouth grille */}
            <div
              style={{
                position: "absolute",
                bottom: "12%",
                left: "20%",
                right: "20%",
                height: 16,
                background: "repeating-linear-gradient(90deg, #1a1a22 0 6px, #4a4a55 6px 10px)",
                borderRadius: 4,
              }}
            />
          </div>

          {/* Felix's face on top */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              transform: "translateX(-50%)",
              width: "60%",
              height: "55%",
              borderRadius: "44%",
              background: "#3a3a44",
              border: "6px solid #1a1a22",
              overflow: "hidden",
              boxShadow:
                "0 0 30px rgba(255, 50, 80, 0.45), inset 0 -8px 0 rgba(0,0,0,0.25), inset 0 6px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marco/felix.png"
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {/* Antenna with blinking light */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -22,
              transform: "translateX(-50%)",
              width: 6,
              height: 32,
              background: "#1a1a22",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -34,
              transform: "translateX(-50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#ff2a4a",
              boxShadow: "0 0 14px #ff2a4a",
              animation: "felixPulse 0.7s ease-in-out infinite",
            }}
          />

          {/* Red overlay flash on hit */}
          {flashing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255, 30, 50, 0.45)",
                mixBlendMode: "screen",
                pointerEvents: "none",
                borderRadius: "30% 30% 18% 18%",
              }}
            />
          )}
        </div>
      </div>

      {/* Lasers — animated bolts from bottom going toward Felix */}
      <AnimatePresence>
        {lasers.map((l) => (
          <motion.div
            key={l.id}
            initial={{ y: 0, opacity: 1, scaleY: 0.4 }}
            animate={{ y: "-70vh", opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              position: "absolute",
              bottom: "10vh",
              left: "50%",
              width: 6,
              height: 80,
              background: "linear-gradient(180deg, #fff 0%, #00f0ff 30%, #b14aff 100%)",
              borderRadius: 4,
              boxShadow: "0 0 16px #00f0ff, 0 0 32px #b14aff",
              transform: `translateX(-50%) rotate(${l.angle}deg)`,
              transformOrigin: "50% 100%",
              pointerEvents: "none",
            }}
          />
        ))}
      </AnimatePresence>

      {/* Status overlays */}
      {mg.status === "intro" && (
        <CenterText big={isHost} color="#ff2a4a" subtle={isHost ? "BOSS BATTLE" : null}>
          DESTROY FELIX
        </CenterText>
      )}
      {isShootPhase && (
        <div
          style={{
            position: "absolute",
            bottom: isHost ? 50 : 80,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Press Start 2P, monospace",
            fontSize: isHost ? "1.3rem" : "0.9rem",
            color: "#fff",
            textShadow: "3px 3px 0 #2e2418, 0 0 16px #ff2a4a",
            letterSpacing: 3,
          }}
        >
          {isHost ? "SMASH SPACEBAR TO SHOOT" : "TAP / SPACE = SHOOT"}
        </div>
      )}

      {mg.status === "questionThrow" && isHost && (
        <CenterText big color="#fff700">
          INCOMING
        </CenterText>
      )}

      {mg.status === "questionCountdown" && (
        <CenterText big={isHost} color="#ff2a4a">
          {Math.max(1, Math.ceil(mg.countdownMs / 1000))}
        </CenterText>
      )}

      {/* Question card (during throw / countdown / play / buzzed) */}
      {(mg.status === "questionThrow" ||
        mg.status === "questionCountdown" ||
        mg.status === "questionPlay" ||
        mg.status === "questionBuzzed") && (
        <motion.div
          initial={{ y: -200, rotate: -8, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          style={{
            position: "absolute",
            top: "22%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#fffaea",
            border: "6px solid #2e2418",
            borderRadius: 18,
            padding: isHost ? "26px 56px" : "16px 22px",
            boxShadow: "0 12px 0 0 #2e2418, 0 0 60px rgba(255, 80, 120, 0.5)",
            maxWidth: "84vw",
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: isHost ? "2.4rem" : "1.2rem",
            color: "#2e2418",
            textAlign: "center",
            fontWeight: 700,
            zIndex: 6,
          }}
        >
          {mg.felixQuestion}
        </motion.div>
      )}

      {/* Felix questionPlay HUD */}
      {mg.status === "questionPlay" && (
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "VT323, monospace",
            fontSize: isHost ? "2rem" : "1.2rem",
            color: "#fff",
            textShadow: "3px 3px 0 #2e2418",
            letterSpacing: 3,
            zIndex: 5,
          }}
        >
          {Math.max(0, Math.ceil(mg.countdownMs / 1000))}s — BUZZ!
        </div>
      )}

      {/* Buzzed: show CORRECT / FALSO buttons on host */}
      {mg.status === "questionBuzzed" && isHost && (
        <div
          style={{
            position: "absolute",
            top: "52%",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            zIndex: 7,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              fontFamily: "Press Start 2P, monospace",
              fontSize: "1.4rem",
              color: "#fff",
              textShadow: "3px 3px 0 #2e2418, 0 0 16px #ff2a4a",
              letterSpacing: 3,
            }}
          >
            BUZZED
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <button className="success" onClick={() => onJudge?.(true)}>✓ CORRECTO</button>
            <button className="danger" onClick={() => onJudge?.(false)}>✗ FALSO (NO!)</button>
          </div>
        </div>
      )}

      {/* Death overlay */}
      {(mg.status === "death" || mg.status === "felixOver") && (
        <CenterText big={isHost} color="#39ff14">
          FELIX DEFEATED
        </CenterText>
      )}
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
        top: "42%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: "Press Start 2P, monospace",
        fontSize: big ? "4.5rem" : "1.8rem",
        color,
        textShadow: "6px 6px 0 #2e2418, 0 0 40px " + color,
        letterSpacing: 4,
        zIndex: 9,
      }}
    >
      {children}
      {subtle && (
        <div
          style={{
            fontSize: "1.1rem",
            color: "#fff",
            marginTop: 16,
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
