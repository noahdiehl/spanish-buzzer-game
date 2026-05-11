"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { MinigameState, Team } from "@/lib/types";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];
// Image is base yellow (~50° hue). Rotate per team to roughly match team color.
// Team 2 (mustard) stays close to the original yellow.
const TEAM_HUE_ROTATE = [-40, 110, 0, 260]; // coral, teal, mustard, plum

interface Props {
  mg: MinigameState;
  teams: Team[];
  highlightTeamId?: number | null; // which bird to outline (player's own)
  height: number;                   // px
  width: number;                    // px (game arena)
}

export function Flappy({ mg, teams, highlightTeamId, height, width }: Props) {
  const PIPE_W = 0.09 * width;
  const PIPE_GAP = 0.32 * height;
  const BIRD_R = 0.04 * Math.min(width, height);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: "linear-gradient(180deg, #cfe7f6 0%, #f4e8cf 100%)",
        border: "4px solid var(--ink)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 8px 0 0 var(--ink)",
      }}
    >
      {/* Ground stripe */}
      <div
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          height: 12,
          background: "#7ba84c",
          borderTop: "3px solid var(--ink)",
        }}
      />

      {/* Pipes */}
      {mg.pipes.map((p) => {
        const x = p.x * width;
        const gapTop = (p.gapY - 0.32 / 2) * height;
        const gapBot = (p.gapY + 0.32 / 2) * height;
        return (
          <div key={p.id}>
            <div
              style={{
                position: "absolute",
                left: x - PIPE_W / 2,
                top: 0,
                width: PIPE_W,
                height: gapTop,
                background: "#4a9b8e",
                border: "3px solid var(--ink)",
                borderRadius: "0 0 6px 6px",
                boxShadow: "inset -8px 0 0 0 rgba(0,0,0,0.15)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - PIPE_W / 2,
                top: gapBot,
                width: PIPE_W,
                height: height - gapBot - 12,
                background: "#4a9b8e",
                border: "3px solid var(--ink)",
                borderRadius: "6px 6px 0 0",
                boxShadow: "inset -8px 0 0 0 rgba(0,0,0,0.15)",
              }}
            />
          </div>
        );
      })}

      {/* Birds */}
      {mg.birds.map((b) => {
        const team = teams.find((t) => t.id === b.teamId);
        if (!team) return null;
        const color = TEAM_COLORS[b.teamId] ?? "#888";
        const hue = TEAM_HUE_ROTATE[b.teamId] ?? 0;
        const x = 0.3 * width;
        const y = b.y * height;
        const tilt = Math.max(-30, Math.min(70, b.vy * 50));
        const highlight = highlightTeamId === b.teamId;
        const size = BIRD_R * 2.4;
        return (
          <div key={b.teamId}>
            {/* Alive bird */}
            {b.alive && (
              <motion.div
                style={{
                  position: "absolute",
                  left: x - size / 2,
                  top: y - size / 2,
                  width: size,
                  height: size,
                  filter: `hue-rotate(${hue}deg)${highlight ? " drop-shadow(0 0 8px rgba(255,255,255,0.9))" : ""}`,
                  outline: highlight ? "4px solid rgba(255,255,255,0.6)" : "none",
                  outlineOffset: 2,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                animate={{ rotate: tilt }}
                transition={{ type: "tween", duration: 0.08 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/marco/flappy.png"
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
                />
              </motion.div>
            )}

            {/* Dead bird: explosion! */}
            <AnimatePresence>
              {!b.alive && (
                <motion.div
                  key={`boom-${b.teamId}`}
                  style={{
                    position: "absolute",
                    left: x - size / 2,
                    top: y - size / 2,
                    width: size,
                    height: size,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: size * 0.95,
                    lineHeight: 1,
                    color: color,
                    pointerEvents: "none",
                  }}
                  initial={{ scale: 0, rotate: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1.8, 1.2, 1.4, 1.2],
                    rotate: [0, 60, -40, 30, 0],
                    opacity: [0, 1, 1, 0.9, 0.8],
                  }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut", times: [0, 0.2, 0.4, 0.7, 1] }}
                >
                  💥
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Intro countdown overlay */}
      {mg.status === "intro" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(244,232,207,0.55)",
            backdropFilter: "blur(2px)",
          }}
        >
          <motion.div
            key={Math.ceil(mg.countdownMs / 1000)}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
            style={{
              fontFamily: "Press Start 2P, monospace",
              fontSize: Math.min(height, width) * 0.18,
              color: "var(--amber)",
              textShadow: "6px 6px 0 var(--ink)",
              lineHeight: 1,
            }}
          >
            {mg.countdownMs > 0 ? Math.max(1, Math.ceil(mg.countdownMs / 1000)) : "GO!"}
          </motion.div>
        </div>
      )}

      {/* Game over overlay */}
      {mg.status === "over" && (() => {
        const ranked = [...mg.birds].sort((a, b) => b.scoreMs - a.scoreMs);
        const winner = ranked[0];
        const winnerTeam = winner ? teams.find((t) => t.id === winner.teamId) : null;
        const winnerColor = winner ? TEAM_COLORS[winner.teamId] : "#000";
        const awards = [10000, 5000, 2000, 0];
        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(244,232,207,0.92)",
              gap: 12,
              padding: 16,
            }}
          >
            {winnerTeam ? (
              <>
                <motion.div
                  initial={{ scale: 0, rotate: -10, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                  style={{
                    fontFamily: "Press Start 2P, monospace",
                    fontSize: Math.min(width, height) * 0.075,
                    color: "var(--ink)",
                    textShadow: "4px 4px 0 var(--amber)",
                    letterSpacing: 4,
                  }}
                >
                  WINNER
                </motion.div>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.4 }}
                  style={{
                    fontFamily: "Press Start 2P, monospace",
                    fontSize: Math.min(width, height) * 0.13,
                    color: winnerColor,
                    textShadow: "6px 6px 0 var(--ink)",
                    letterSpacing: 4,
                    textAlign: "center",
                    lineHeight: 1.1,
                  }}
                >
                  {winnerTeam.name}
                </motion.div>
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.9 }}
                  style={{
                    fontFamily: "Press Start 2P, monospace",
                    fontSize: Math.min(width, height) * 0.09,
                    color: "var(--avocado)",
                    textShadow: "5px 5px 0 var(--ink)",
                    letterSpacing: 3,
                  }}
                >
                  100,000 POINTS!
                </motion.div>
              </>
            ) : (
              <div style={{ fontFamily: "Press Start 2P, monospace", fontSize: Math.min(width, height) * 0.07 }}>
                NO SURVIVORS
              </div>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
              {ranked.slice(1).map((b, i) => {
                const team = teams.find((t) => t.id === b.teamId);
                if (!team) return null;
                return (
                  <div
                    key={b.teamId}
                    style={{
                      fontFamily: "VT323, monospace",
                      fontSize: Math.min(width, height) * 0.04,
                      color: TEAM_COLORS[b.teamId],
                      letterSpacing: 2,
                    }}
                  >
                    #{i + 2} {team.name} +{awards[i + 1] ?? 0}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
