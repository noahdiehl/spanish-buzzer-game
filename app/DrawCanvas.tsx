"use client";
import { useEffect, useRef } from "react";

interface Props {
  size: number;
  strokeColor?: string;
  onSubmit: (dataUrl: string) => void;
  submitTrigger: number; // change this number to force a submit
}

/**
 * Smooth vector pen canvas. Uses quadratic-bezier midpoint smoothing.
 * Parent controls submission by incrementing submitTrigger.
 */
export function DrawCanvas({ size, strokeColor = "#2e2418", onSubmit, submitTrigger }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  // Initial setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fbf6e4";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [size, strokeColor]);

  // Handle submit on trigger change
  useEffect(() => {
    if (submitTrigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL("image/png");
      onSubmit(url);
    } catch {}
  }, [submitTrigger, onSubmit]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * size) / rect.width,
      y: ((e.clientY - rect.top) * size) / rect.height,
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getPoint(e);
    lastRef.current = p;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastRef.current) return;
    const p = getPoint(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    const last = lastRef.current;
    const midX = (last.x + p.x) / 2;
    const midY = (last.y + p.y) / 2;
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    lastRef.current = p;
  }

  function onUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fbf6e4";
    ctx.fillRect(0, 0, size, size);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          border: "3px solid var(--ink)",
          borderRadius: 14,
          boxShadow: "0 5px 0 0 var(--ink)",
          touchAction: "none",
          cursor: "crosshair",
          background: "#fbf6e4",
        }}
      />
      <button onClick={clear} style={{ fontSize: "0.85rem", padding: "8px 16px" }}>
        CLEAR
      </button>
    </div>
  );
}
