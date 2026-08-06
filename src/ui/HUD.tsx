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
      <div className="hud-hint">
        <span>Up / Down to walk</span>
        <span>Left / Right to turn · scroll to zoom</span>
        <span>W / S to look up and down</span>
        <span>Walk into a portal to enter it</span>
      </div>
      <div className="hud-badge">{timeStr}</div>
    </>
  );
}
