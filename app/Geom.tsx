"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { MinigameState, Team } from "@/lib/types";

const TEAM_COLORS = ["#e07a5f", "#4a9b8e", "#d4a13a", "#9b5c8f"];
const TEAM_HUE_ROTATE = [-40, 110, 0, 260];

const CUBE_W = 0.06;
const CUBE_H = 0.10;
const CUBE_X = 0.22;

interface Props {
  mg: MinigameState;
  teams: Team[];
  highlightTeamId?: number | null;
  width: number;
  height: number;
}

const GROUND_PX = 18; // ground strip thickness

export function Geom({ mg, teams, highlightTeamId, width, height }: Props) {
  const playH = height - GROUND_PX;

  // World -> screen
  const worldY = (y: number) => playH * (1 - y);

  const cubeWPx = CUBE_W * width;
  const cubeHPx = CUBE_H * playH;
  const cubeLeft = CUBE_X * width - cubeWPx / 2;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        borderRadius: 18,
        border: "4px solid var(--ink)",
        boxShadow: "0 8px 0 0 var(--ink)",
        background:
          "linear-gradient(180deg, #ffd166 0%, #fca678 35%, #f072a0 70%, #c14cc7 100%)",
      }}
    >
      {/* Fluffy clouds backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.55,
          backgroundImage:
            "radial-gradient(ellipse 80px 30px at 10% 25%, #fff 0%, transparent 60%)," +
            "radial-gradient(ellipse 120px 40px at 70% 18%, #fff 0%, transparent 60%)," +
            "radial-gradient(ellipse 90px 30px at 40% 60%, #fff 0%, transparent 60%)," +
            "radial-gradient(ellipse 140px 36px at 85% 65%, #fff 0%, transparent 60%)",
          animation: "geomCloudScroll 18s linear infinite",
        }}
      />
      <style>{`@keyframes geomCloudScroll { from { background-position: 0 0; } to { background-position: -${width}px 0; } }`}</style>

      {/* Distant mountains silhouette */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: GROUND_PX,
          height: 60,
          background:
            "linear-gradient(180deg, transparent 0%, rgba(70, 30, 100, 0.35) 100%)",
          clipPath:
            "polygon(0 100%, 0 60%, 10% 30%, 18% 55%, 28% 25%, 38% 50%, 48% 20%, 58% 55%, 70% 35%, 80% 60%, 90% 30%, 100% 55%, 100% 100%)",
        }}
      />

      {/* Ground */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: GROUND_PX,
          background:
            "linear-gradient(180deg, #7ec850 0%, #4a9b3e 70%, #2e6427 100%)",
          borderTop: "3px solid #2e2418",
          boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.18)",
        }}
      />
      {/* Ground checker pattern */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: GROUND_PX,
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 28px, rgba(0,0,0,0.12) 28px 56px)",
          animation: "geomGroundScroll 0.6s linear infinite",
        }}
      />
      <style>{`@keyframes geomGroundScroll { from { background-position: 0 0; } to { background-position: -56px 0; } }`}</style>

      {/* Faint grid overlay (vertical cells) for that classic GD look */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: GROUND_PX,
          backgroundImage:
            `repeating-linear-gradient(180deg, rgba(255,255,255,0.10) 0 1px, transparent 1px ${CUBE_H * playH}px)`,
          pointerEvents: "none",
        }}
      />

      {/* Sharp ground line at the top of the ground strip — visual anchor for cube/spike base */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: GROUND_PX,
          height: 2,
          background: "#2e2418",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      {/* Obstacles */}
      {mg.obstacles.map((o) => {
        const xPx = o.x * width;
        if (o.type === "spike") {
          // Spike size matches the cube exactly so visual = collision = grid cell.
          const triH = CUBE_H * playH;
          const triW = CUBE_W * width;
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
                borderBottom: `${triH}px solid #e35a3c`,
                filter: "drop-shadow(2px 4px 0 #2e2418)",
              }}
            />
          );
        }
        if (o.type === "ceiling_spike") {
          const triH = CUBE_H * playH;
          const triW = CUBE_W * width;
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
                borderTop: `${triH}px solid #e35a3c`,
                filter: "drop-shadow(2px -4px 0 #2e2418)",
              }}
            />
          );
        }
        if (o.type === "block") {
          const blockH = o.y * playH;
          const blockW = CUBE_W * width;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - blockW / 2,
                bottom: GROUND_PX,
                width: blockW,
                height: blockH,
                background: "linear-gradient(180deg, #fde68a 0%, #d4a13a 100%)",
                border: "3px solid #2e2418",
                borderRadius: 6,
                boxShadow: "inset 0 -5px 0 0 rgba(0,0,0,0.18), 3px 4px 0 #2e2418",
              }}
            >
              {/* brick lines */}
              <div
                style={{
                  position: "absolute",
                  inset: 4,
                  backgroundImage:
                    "linear-gradient(0deg, transparent 49%, rgba(0,0,0,0.18) 49%, rgba(0,0,0,0.18) 51%, transparent 51%)",
                  backgroundSize: `100% ${Math.max(8, blockH / 2)}px`,
                  pointerEvents: "none",
                }}
              />
            </div>
          );
        }
        if (o.type === "bounce_pad") {
          const padW = CUBE_W * width;
          return (
            <div
              key={o.id}
              style={{
                position: "absolute",
                left: xPx - padW / 2,
                bottom: GROUND_PX,
                width: padW,
                height: 18,
                background: "linear-gradient(180deg, #ff5e7e 0%, #c12c50 100%)",
                border: "3px solid #2e2418",
                borderRadius: 5,
                boxShadow: "0 0 14px rgba(255, 94, 126, 0.7), 3px 4px 0 #2e2418",
                color: "#fff",
                fontFamily: "VT323, monospace",
                fontSize: 20,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textShadow: "1px 1px 0 #2e2418",
              }}
            >
              ▲▲
            </div>
          );
        }
        if (o.type === "bounce_orb") {
          const cy = worldY(o.y);
          const r = 0.055 * Math.min(width, playH);
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
                  ? "radial-gradient(circle at 35% 30%, #999 0%, #555 70%)"
                  : "radial-gradient(circle at 35% 30%, #fff7a8 0%, #fff700 40%, #d4a13a 90%)",
                border: `3px solid ${consumed ? "#666" : "#2e2418"}`,
                boxShadow: consumed
                  ? "none"
                  : "0 0 28px #fff700, 0 0 12px #fffacc, inset 0 -6px 0 rgba(0,0,0,0.2)",
                animation: consumed ? "none" : "geomOrbPulse 0.9s ease-in-out infinite",
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
        // c.y is BOTTOM of the cube in world coords (0 = ground)
        const cubeBottomScreen = worldY(c.y);
        const cubeTop = cubeBottomScreen - cubeHPx;
        const highlight = highlightTeamId === c.teamId;
        return (
          <div key={c.teamId}>
            {/* Trail */}
            {c.alive && (
              <div
                style={{
                  position: "absolute",
                  left: cubeLeft - cubeWPx * 1.4,
                  top: cubeTop + cubeHPx * 0.2,
                  width: cubeWPx * 1.4,
                  height: cubeHPx * 0.6,
                  background: `linear-gradient(90deg, transparent, ${color}aa)`,
                  filter: "blur(4px)",
                  borderRadius: "50%",
                  pointerEvents: "none",
                }}
              />
            )}

            {c.alive && (
              <div
                style={{
                  position: "absolute",
                  left: cubeLeft,
                  top: cubeTop,
                  width: cubeWPx,
                  height: cubeHPx,
                  transform: `rotate(${c.rotation}deg)`,
                  transformOrigin: "center",
                  filter: `hue-rotate(${hue}deg)${highlight ? " drop-shadow(0 0 12px rgba(255,255,255,0.9))" : ""}`,
                  border: highlight
                    ? "4px solid rgba(255,255,255,0.85)"
                    : "3px solid #2e2418",
                  borderRadius: 6,
                  overflow: "hidden",
                  background: color,
                  boxShadow: highlight
                    ? `0 0 22px ${color}`
                    : `3px 4px 0 #2e2418`,
                  willChange: "transform",
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
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}

            <AnimatePresence>
              {!c.alive && (
                <motion.img
                  key={`boom-${c.teamId}`}
                  src="/marco/marco3.png"
                  alt=""
                  style={{
                    position: "absolute",
                    left: cubeLeft - cubeWPx * 0.6,
                    top: cubeTop - cubeHPx * 0.5,
                    width: cubeWPx * 2.2,
                    height: cubeHPx * 2.2,
                    objectFit: "contain",
                    pointerEvents: "none",
                    filter: `drop-shadow(0 0 14px ${color})`,
                  }}
                  initial={{ scale: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    scale: [0, 2.2, 1.6, 1.8, 1.5],
                    rotate: [0, 60, -30, 15, 0],
                    opacity: [0, 1, 1, 0.95, 0.85],
                  }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut", times: [0, 0.2, 0.4, 0.7, 1] }}
                />
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
            background: "rgba(255, 255, 255, 0.35)",
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
              color: "#2e2418",
              textShadow: "6px 6px 0 #fff700, 0 0 40px rgba(255, 247, 0, 0.6)",
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
              background: "rgba(255, 250, 234, 0.93)",
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
                    color: "#2e2418",
                    textShadow: "4px 4px 0 #fff700",
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
                    textShadow: "6px 6px 0 #2e2418",
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
                    color: "#4a9b3e",
                    textShadow: "5px 5px 0 #2e2418",
                    letterSpacing: 3,
                  }}
                >
                  +10,000 POINTS!
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
