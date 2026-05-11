"use client";
import { useEffect, useRef, useState } from "react";
import type { ClientMsg, GameState, ServerMsg } from "./types";

const TOKEN_KEY = "spanish-buzzer-token";

export function useGame(role: "board" | "player" = "player") {
  const [state, setState] = useState<GameState | null>(null);
  const [youAreTeamId, setYouAreTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws?role=${role}`;
    let cancelled = false;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        // If we have a saved token (player only), try to resume our team.
        if (role === "player") {
          try {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) ws.send(JSON.stringify({ type: "resume", token }));
          } catch {}
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as ServerMsg;
          if (msg.type === "state") {
            setState(msg.state);
            setYouAreTeamId(msg.youAreTeamId);
          } else if (msg.type === "token") {
            try { localStorage.setItem(TOKEN_KEY, msg.token); } catch {}
          } else if (msg.type === "error") {
            setError(msg.message);
          }
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();
    }
    connect();

    // Browser confirm prompt before refresh/close
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onBeforeUnload);
      wsRef.current?.close();
    };
  }, [role]);

  function send(msg: ClientMsg) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  return { state, youAreTeamId, error, connected, send };
}

export function clearStoredToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}
