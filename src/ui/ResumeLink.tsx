import { useStore } from "../state/useStore";
import { CONTACT } from "../data/contacts";

/**
 * The résumé, one seat to the left of Connect.
 *
 * The third pill in that corner and the plainest: the controls key explains
 * the world, Connect explains how to reach the person, and this is the paper
 * version of everything the panels say at length. Nothing about it is a
 * flourish — a visitor who wants the document wants it in one click, in the
 * form they can forward or print, not as another room to walk through.
 *
 * An anchor rather than a button, and it opens in its own tab rather than
 * downloading. Most people want to read it and decide; the browser's own
 * viewer offers the download to the ones who want the file, which is one
 * fewer decision made on their behalf.
 *
 * It steps aside under a panel exactly as its two neighbours do — the panel
 * comes in over this corner, and a link left floating on top of it would be
 * the only piece of chrome that did not know to move.
 */
export function ResumeLink() {
  const activePanel = useStore((s) => s.activePanel);
  if (activePanel) return null;

  return (
    <a className="resume-toggle" href={CONTACT.resume} target="_blank" rel="noreferrer">
      Resume
    </a>
  );
}
