"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { MinigameState, Team } from "@/lib/types";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];
const TEAM_HUE_ROTATE = [-40, 110, 0, 260];

interface Props {
  mg: MinigameState;
  teams: Team[];
  highlightTeamId?: number | null;
  width: number;
  height: number;
}

// Coordinate helpers: world y is 0 = ground (bottom), 1 = ceiling (top).
// Screen y is 0 = top, increases downward.
const GROUND_PX = 14; // ground strip thickness in px
function worldToScreenY(worldY: number, playH: number) {
  // playable height = height - groundPx
  return (1 - worldY) * playH;
}

export function Geom({ mg, teams, highlightTeamId, width, height }: Props) {
  const playH = height - GROUND_PX;
  const cubeSize = 0.075 * Math.min(width, height);
  const cubeXpx = 0.22 * width;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        borderRadius: 18,
        border: "4px solid var(--ink)",
        boxShadow: "0 8px 0 0 var(--ink), 0 0 40px rgba(177, 74, 255, 0.45)",
        background:
          "radial-gradient(ellipse at 60% 40%, #3a2470 0%, #1a0d3a 60%, #0a0420 100%)",
      }}
    >
      {/* Scrolling neon grid backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,43,214,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.18) 1px, transparent 1px)",
          backgroundSize: `${width / 12}px ${height / 12}px`,
          animation: "geomGridScroll 1.4s linear infinite",
        }}
      />
      <style>{`@keyframes geomGridScroll { from { background-position: 0 0; } to { background-position: -${width / 12}px 0; } }`}</style>

      {/* Ground */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: GROUND_PX,
          background:
            "linear-gradient(180deg, #b14aff 0%, #6a1aa0 100%)",
          borderTop: "3px solid #ff2bd6",
          boxShadow: "0 -8px 24px rgba(255,43,214,0.5)",
        }}
      />

      {/* Obstacles */}
      {mg.obstacles.map((o) => {
        const xPx = o.x * width;
        if (o.type === "spike") {
          const triH = 0.08 * height;
          const triW = 0.08 * width;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - triW / 2,
                bottom: GROUND_PX,
                width: 0,
                height: 0,
                borderLeft: `${triW / 2}px solid transparent`,
                borderRight: `${triW / 2}px solid transparent`,
                borderBottom: `${triH}px solid #ff2a2a`,
                filter: "drop-shadow(0 0 6px #ff5050)",
              }}
            />
          );
        }
        if (o.type === "ceiling_spike") {
          const triH = 0.08 * height;
          const triW = 0.08 * width;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - triW / 2,
                top: 0,
                width: 0,
                height: 0,
                borderLeft: `${triW / 2}px solid transparent`,
                borderRight: `${triW / 2}px solid transparent`,
                borderTop: `${triH}px solid #ff2a2a`,
                filter: "drop-shadow(0 0 6px #ff5050)",
              }}
            />
          );
        }
        if (o.type === "block") {
          const blockH = o.y * playH;
          const blockW = 0.085 * width;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - blockW / 2,
                bottom: GROUND_PX,
                width: blockW,
                height: blockH,
                background: "linear-gradient(180deg, #4a9b8e 0%, #2a5e54 100%)",
                border: "3px solid #00f0ff",
                borderRadius: 4,
                boxShadow: "inset 0 -4px 0 0 rgba(0,0,0,0.25), 0 0 12px rgba(0,240,255,0.5)",
              }}
            />
          );
        }
        if (o.type === "bounce_pad") {
          const padW = 0.085 * width;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - padW / 2,
                bottom: GROUND_PX,
                width: padW,
                height: 14,
                background: "#fff700",
                border: "3px solid #ff9d00",
                borderRadius: 4,
                boxShadow: "0 0 16px #fff700, inset 0 -3px 0 0 #d4a13a",
                color: "#7a5a00",
                fontFamily: "VT323, monospace",
                fontSize: 18,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ▲▲
            </div>
          );
        }
        if (o.type === "bounce_orb") {
          const cy = worldToScreenY(o.y, playH);
          const r = 0.045 * Math.min(width, height);
          const consumed = o.consumed;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - r,
                top: cy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                background: consumed
                  ? "radial-gradient(circle at 35% 30%, #888 0%, #444 70%)"
                  : "radial-gradient(circle at 35% 30%, #b14aff 0%, #6a1aa0 70%, #391259 100%)",
                border: `3px solid ${consumed ? "#666" : "#ff2bd6"}`,
                boxShadow: consumed
                  ? "none"
                  : "0 0 24px #b14aff, inset 0 0 10px rgba(255,43,214,0.6)",
                animation: consumed ? "none" : "geomOrbPulse 1s ease-in-out infinite",
                opacity: consumed ? 0.4 : 1,
              }}
            />
          );
        }
        return null;
      })}
      <style>{`@keyframes geomOrbPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>

      {/* Cubes */}
      {mg.cubes.map((c) => {
        const team = teams.find((t) => t.id === c.teamId);
        if (!team) return null;
        const color = TEAM_COLORS[c.teamId];
        const hue = TEAM_HUE_ROTATE[c.teamId] ?? 0;
        const yPx = worldToScreenY(c.y + 0.075, playH) - cubeSize; // c.y is bottom, draw from top-left
        const highlight = highlightTeamId === c.teamId;
        return (
          <div key={c.teamId}>
            {/* Trail (only when alive) */}
            {c.alive && (
              <div
                style={{
                  position: "absolute",
                  left: cubeXpx - cubeSize * 1.8,
                  top: yPx + cubeSize * 0.15,
                  width: cubeSize * 1.6,
                  height: cubeSize * 0.7,
                  background: `linear-gradient(90deg, transparent, ${color}88)`,
                  filter: "blur(4px)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                }}
              />
            )}

            {c.alive && (
              <motion.div
                animate={{ rotate: c.rotation }}
                transition={{ type: "tween", duration: 0.05 }}
                style={{
                  position: "absolute",
                  left: cubeXpx - cubeSize / 2,
                  top: yPx,
                  width: cubeSize,
                  height: cubeSize,
                  filter: `hue-rotate(${hue}deg)${highlight ? " drop-shadow(0 0 12px rgba(255,255,255,0.9))" : ""}`,
                  border: highlight
                    ? "4px solid rgba(255,255,255,0.8)"
                    : "3px solid var(--ink)",
                  borderRadius: 6,
                  overflow: "hidden",
                  background: color,
                  boxShadow: highlight
                    ? `0 0 22px ${color}`
                    : `0 0 12px ${color}`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/marco/flappy.png"
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </motion.div>
            )}

            <AnimatePresence>
              {!c.alive && (
                <motion.div
                  key={`boom-${c.teamId}`}
                  style={{
                    position: "absolute",
                    left: cubeXpx - cubeSize,
                    top: yPx - cubeSize / 2,
                    width: cubeSize * 2,
                    height: cubeSize * 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: cubeSize * 1.6,
                    color,
                    pointerEvents: "none",
                  }}
                  initial={{ scale: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    scale: [0, 2, 1.4, 1.6, 1.3],
                    rotate: [0, 90, -60, 30, 0],
                    opacity: [0, 1, 1, 0.9, 0.7],
                  }}
                  exit={{ scale: 0.3, opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut", times: [0, 0.2, 0.4, 0.7, 1] }}
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
            background: "rgba(15, 5, 30, 0.55)",
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
              fontSize: Math.min(width, height) * 0.18,
              color: "#ff2bd6",
              textShadow: "6px 6px 0 var(--ink), 0 0 40px #ff2bd6",
              lineHeight: 1,
            }}
          >
            {mg.countdownMs > 0 ? Math.max(1, Math.ceil(mg.countdownMs / 1000)) : "GO!"}
          </motion.div>
        </div>
      )}

      {/* Game over overlay */}
      {mg.status === "over" && (() => {
        const ranked = [...mg.cubes].sort((a, b) => b.scoreMs - a.scoreMs);
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
              background: "rgba(15, 5, 30, 0.92)",
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
                    color: "#fff",
                    textShadow: "4px 4px 0 #ff2bd6",
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
                    color: "#39ff14",
                    textShadow: "5px 5px 0 var(--ink)",
                    letterSpacing: 3,
                  }}
                >
                  +10,000 POINTS!
                </motion.div>
              </>
            ) : (
              <div style={{ fontFamily: "Press Start 2P, monospace", fontSize: Math.min(width, height) * 0.07, color: "#fff" }}>
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
