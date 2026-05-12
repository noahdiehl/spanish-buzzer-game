"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MODIFIERS, type ModifierKey } from "@/lib/types";
import styles from "./wheel.module.css";

interface Props {
  result: ModifierKey | null;        // null until server has picked
  onSpinRequest: () => void;          // ask server to pick
  onSpinComplete: () => void;         // tell server we're done landing
  canSpinHere?: boolean;              // show local SPIN button (fallback when no winner)
  waitingForName?: string | null;     // name of remote spinner, if any
}

const SEG_COUNT = MODIFIERS.length;
const SEG_DEG = 360 / SEG_COUNT;

export function Wheel({ result, onSpinRequest, onSpinComplete, canSpinHere = false, waitingForName = null }: Props) {
  // The rotation we're animating *to*.
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landed">("idle");
  const [showResult, setShowResult] = useState(false);
  const requested = useRef(false);

  // When user clicks SPIN, ask server for result.
  function handleSpinClick() {
    if (phase !== "idle" || requested.current) return;
    requested.current = true;
    onSpinRequest();
  }

  // When result arrives from server, animate rotation to land on it.
  useEffect(() => {
    if (!result || phase !== "idle") return;
    const idx = MODIFIERS.findIndex((m) => m.key === result);
    if (idx < 0) return;
    // Pointer is at the top (12 o'clock). Segment i is centered at angle i * SEG_DEG.
    // We want segment center under the pointer => rotate by (-idx*SEG_DEG) + many full turns.
    const fullSpins = 6;
    const target = fullSpins * 360 - idx * SEG_DEG;
    setRotation(target);
    setPhase("spinning");
  }, [result, phase]);

  // After animation duration, show result modal + notify server.
  function handleAnimationComplete() {
    if (phase !== "spinning") return;
    setPhase("landed");
    setShowResult(true);
    // give the user 2s to read the modifier, then continue
    setTimeout(() => {
      setShowResult(false);
      onSpinComplete();
    }, 2000);
  }

  return (
    <div className={styles.wrap}>
      {!showResult && <div className={styles.title}>WHEEL OF MARCO</div>}

      {/* Hide the wheel entirely while the result is showing — the 7 segments
         and spinning motion are expensive to keep alive behind the overlay. */}
      <div className={styles.wheelStage} style={{ display: showResult ? "none" : undefined }}>
        <div className={styles.pointer}>▼</div>
        <motion.div
          className={styles.wheel}
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.17, 0.67, 0.13, 1.0] }}
          onAnimationComplete={handleAnimationComplete}
        >
          {MODIFIERS.map((m, i) => {
            const angle = i * SEG_DEG;
            return (
              <div
                key={m.key}
                className={styles.segment}
                style={{
                  transform: `rotate(${angle}deg)`,
                  // alternate background tints
                  background: i % 2 === 0 ? "var(--panel)" : "var(--paper-2)",
                  // SVG-like clip via clip-path triangle
                  clipPath: `polygon(50% 50%, ${50 + 50 * Math.tan((SEG_DEG / 2) * Math.PI / 180)}% 0, ${50 - 50 * Math.tan((SEG_DEG / 2) * Math.PI / 180)}% 0)`,
                }}
              >
                <div
                  className={styles.segmentInner}
                  style={{ transform: `translate(-50%, -50%) rotate(${SEG_DEG / 2}deg)` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt="" className={styles.segImg} />
                  <div className={styles.segLabel} style={{ color: m.color }}>
                    {m.label}
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
        <div className={styles.hub}>★</div>
      </div>

      {phase === "idle" && canSpinHere && (
        <button className={`primary ${styles.spinBtn}`} onClick={handleSpinClick}>
          SPIN
        </button>
      )}
      {phase === "idle" && !canSpinHere && waitingForName && (
        <div className={styles.waitingFor}>
          Waiting for <span className={styles.waitingName}>{waitingForName}</span> to spin...
        </div>
      )}
      {phase === "spinning" && (
        <div className={styles.spinningText}>SPINNING...</div>
      )}

      <AnimatePresence>
        {showResult && result && (
          <motion.div
            className={styles.resultOverlay}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.05, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
          >
            {(() => {
              const m = MODIFIERS.find((x) => x.key === result)!;
              return (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt="" className={styles.resultImg} />
                  <div className={styles.resultLabel} style={{ color: m.color }}>
                    {m.label}
                  </div>
                  <div className={styles.resultDesc}>{m.description}</div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
