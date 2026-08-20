import { siGithub } from "simple-icons";

/**
 * The GitHub mark in the corner of a project card, linking to that project's
 * repo.
 *
 * The path comes from `simple-icons` rather than from a bitmap in the assets
 * folder, for the same reason the tech stack world's chips take their marks
 * from there (`worlds/techstack/logos.ts`): it is the official geometry on a
 * 24x24 viewBox from a source that updates when the brand does, it stays crisp
 * at any size and on any display, and it costs nothing to ship since the
 * package is already a dependency.
 *
 * Filled with `currentColor` so the mark takes the button's own colour and can
 * darken on hover with it, rather than staying a fixed black over a background
 * that moves.
 */
export function RepoLink({ href, project }: { href: string; project: string }) {
  return (
    <a
      className="entry-repo"
      href={href}
      target="_blank"
      rel="noreferrer"
      // Named for the project rather than "GitHub": on the unfocused panel
      // there are six of these down the page, and six links all announcing
      // themselves as "GitHub" tells a screen reader nothing about which is
      // which.
      aria-label={`${project} on GitHub`}
      title="View the repo on GitHub"
      // The card sits inside a dialog that closes on a backdrop click; without
      // this the click would open the tab and shut the panel behind it.
      onClick={(e) => e.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={siGithub.path} fill="currentColor" />
      </svg>
    </a>
  );
}
