"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MinigameState, Team } from "@/lib/types";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];

interface Props {
  mg: MinigameState;
  teams: Team[];
  size: "host" | "player";
  /** play VG-style click for each typed char (only host) */
  onTypeBlip?: () => void;
}

function useTypewriter(text: string, active: boolean, charMs: number, onBlip?: () => void) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) {
      setShown(0);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (onBlip && text[i - 1] !== " ") onBlip();
      if (i >= text.length) clearInterval(id);
    }, charMs);
    return () => clearInterval(id);
  }, [text, active, charMs, onBlip]);
  return text.slice(0, shown);
}

export function Banana({ mg, teams, size, onTypeBlip }: Props) {
  const isHost = size === "host";
  const dialog1Active = mg.status === "dialog1";
  const dialog2Active = mg.status === "dialog2";
  const laughActive = mg.status === "laugh";

  const dialog1 = useTypewriter("Time to remove points from one of the players.", dialog1Active, 30, onTypeBlip);
  const dialog2 = useTypewriter("I think I'll remove 50,000,000,000 points.", dialog2Active, 30, onTypeBlip);
  const victim = mg.bananaVictimId !== null ? teams.find((t) => t.id === mg.bananaVictimId) : null;
  const laughText = useTypewriter(
    victim ? `Team ${victim.name}. Haw haw haw!` : "Haw haw haw!",
    laughActive,
    30,
    onTypeBlip
  );

  // Roulette: cycle a highlighted index, slow → fast → lock on victim at end.
  const [highlightIdx, setHighlightIdx] = useState(0);
  const rouletteStartRef = useRef<number | null>(null);
  useEffect(() => {
    if (mg.status !== "roulette") {
      rouletteStartRef.current = null;
      return;
    }
    if (rouletteStartRef.current === null) rouletteStartRef.current = Date.now();
    let timeout: ReturnType<typeof setTimeout>;
    const totalMs = 3500;
    function step() {
      const elapsed = Date.now() - (rouletteStartRef.current as number);
      const t = Math.min(1, elapsed / totalMs);
      // Lock onto victim near the end
      if (t > 0.92) {
        const vIdx = teams.findIndex((tm) => tm.id === mg.bananaVictimId);
        if (vIdx >= 0) setHighlightIdx(vIdx);
        return;
      }
      setHighlightIdx((prev) => (prev + 1) % Math.max(1, teams.length));
      // Start slow (~350ms), accelerate to ~25ms
      const speedFactor = 1 - t;
      const stepMs = 25 + Math.pow(speedFactor, 3) * 325;
      timeout = setTimeout(step, stepMs);
    }
    timeout = setTimeout(step, 350);
    return () => clearTimeout(timeout);
  }, [mg.status, mg.bananaVictimId, teams]);

  // Enter slide-up animation: banana starts off-screen and rises during "enter"
  const isVisible = mg.status !== "exit";
  // Banana size scales with host vs player
  const bananaImgSize = isHost ? 220 : 110;
  const dialogFont = isHost ? 2.0 : 1.0; // rem

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(5, 0, 20, 0.94)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isHost ? 28 : 14,
        padding: isHost ? 40 : 16,
        pointerEvents: "none",
      }}
    >
      {/* Dialog box — rendered FIRST so it sits ABOVE the banana visually */}
      {(dialog1Active || dialog2Active || laughActive) && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            background: "var(--panel)",
            border: "5px solid var(--ink)",
            borderRadius: 18,
            padding: isHost ? "32px 48px" : "14px 18px",
            boxShadow: "0 10px 0 0 var(--ink)",
            maxWidth: isHost ? "84vw" : "92vw",
            minWidth: isHost ? 720 : 280,
            fontFamily: "'Press Start 2P', monospace",
            fontSize: `${dialogFont}rem`,
            lineHeight: 1.5,
            color: "var(--ink)",
            textShadow: "3px 3px 0 var(--amber)",
            letterSpacing: 2,
            textAlign: isHost ? "center" : "left",
          }}
        >
          {dialog1Active && (
            <>
              {dialog1}
              <Caret />
            </>
          )}
          {dialog2Active && (
            <>
              {dialog2}
              <Caret />
            </>
          )}
          {laughActive && (
            <>
              {laughText}
              <Caret />
            </>
          )}
        </motion.div>
      )}

      {/* Banana Man */}
      <AnimatePresence>
        <motion.img
          key="banana"
          src="/marco/banana.jpg"
          alt=""
          initial={{ y: 700, rotate: 0 }}
          animate={{
            y: isVisible ? 0 : 700,
            rotate: laughActive ? [0, -8, 8, -6, 6, 0] : 0,
          }}
          transition={{
            y: { duration: 0.9, ease: "easeOut" },
            rotate: laughActive ? { duration: 0.6, repeat: 2 } : { duration: 0.3 },
          }}
          style={{
            width: bananaImgSize,
            height: bananaImgSize,
            objectFit: "cover",
            border: "5px solid #ffe66d",
            borderRadius: 18,
            boxShadow: "0 0 60px rgba(255, 230, 100, 0.6), 0 8px 0 0 #2e2418",
          }}
        />
      </AnimatePresence>

      {/* Team roulette */}
      {(mg.status === "roulette" || mg.status === "reveal") && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, teams.length)}, 1fr)`,
            gap: isHost ? 16 : 8,
            width: isHost ? "min(900px, 80vw)" : "92vw",
          }}
        >
          {teams.map((t, i) => {
            const highlighted = i === highlightIdx;
            const color = TEAM_COLORS[t.id];
            const isVictim = mg.status === "reveal" && t.id === mg.bananaVictimId;
            return (
              <motion.div
                key={t.id}
                animate={{
                  scale: highlighted ? (isVictim ? 1.35 : 1.18) : 1,
                  rotate: isVictim ? [0, -3, 3, -2, 2, 0] : 0,
                }}
                transition={{
                  scale: { type: "spring", stiffness: 600, damping: 18 },
                  rotate: isVictim ? { duration: 0.5, repeat: 1 } : { duration: 0.2 },
                }}
                style={{
                  background: highlighted ? color : "var(--panel)",
                  color: highlighted ? "#fff" : "var(--ink)",
                  border: `${isHost ? 4 : 3}px solid var(--ink)`,
                  borderRadius: 14,
                  padding: isHost ? "20px 14px" : "12px 8px",
                  textAlign: "center",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: isHost ? "1.4rem" : "0.85rem",
                  letterSpacing: 2,
                  textShadow: highlighted ? "2px 2px 0 var(--ink)" : "2px 2px 0 var(--amber)",
                  boxShadow: highlighted ? `0 0 50px ${color}, 0 8px 0 0 var(--ink)` : "0 6px 0 0 var(--ink)",
                  minWidth: 0,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "clip",
                }}
              >
                {t.name}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Deduction reveal */}
      {mg.status === "reveal" && victim && (
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 250, damping: 14, delay: 0.4 }}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: isHost ? "2.2rem" : "1.1rem",
            color: "var(--tomato)",
            textShadow: "4px 4px 0 var(--ink)",
            letterSpacing: 3,
          }}
        >
          -{mg.bananaDeduction.toLocaleString()} PTS
        </motion.div>
      )}
    </div>
  );
}

function Caret() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.6, repeat: Infinity }}
      style={{ marginLeft: 4 }}
    >
      ▌
    </motion.span>
  );
}
