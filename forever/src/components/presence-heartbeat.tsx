"use client";

import { useEffect, useState } from "react";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/presence";

export function PresenceHeartbeat() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    async function heartbeat() {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/presence", { method: "POST", signal: controller.signal });
        if (!response.ok) throw new Error(`Presence update failed (${response.status})`);
        if (active) setFailed(false);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Unable to update website activity", error);
          if (active) setFailed(true);
        }
      } finally {
        inFlight = false;
      }
    }
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => void heartbeat();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  return failed ? <p role="status" className="text-sm text-destructive">Nie udało się zaktualizować aktywności na stronie. Spróbujemy ponownie automatycznie.</p> : null;
}
