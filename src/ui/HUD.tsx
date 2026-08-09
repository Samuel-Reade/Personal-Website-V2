import { useEffect, useState } from "react";
import { useStore } from "../state/useStore";

/** A small live clock badge, hidden while a panel is open. */
export function HUD() {
  const activePanel = useStore((s) => s.activePanel);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  if (activePanel) return null;

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // The keys live in the global controls key (ControlsHint), which shows
  // itself on arrival — all that is left of the HUD is the clock.
  return <div className="hud-badge">{timeStr}</div>;
}
