import { useEffect, useState } from "react";
import { useStore } from "../state/useStore";

/** Control hints + a small live clock badge, hidden while a panel is open. */
export function HUD() {
  const activePanel = useStore((s) => s.activePanel);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  if (activePanel) return null;

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {/* The keys themselves live in the global controls key (ControlsHint), so
          what is left here is only what that card doesn't cover. */}
      <div className="hud-hint">
        <span>Scroll to zoom</span>
        <span>Walk into a portal to enter it</span>
      </div>
      <div className="hud-badge">{timeStr}</div>
    </>
  );
}
