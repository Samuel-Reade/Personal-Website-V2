import { useEffect } from "react";
import { useStore, type PanelId } from "../state/useStore";
import { useKeyboardState } from "../hooks/useKeyboard";
import { Collapsible } from "./Collapsible";
import { TagPills } from "./TagPills";
import { RepoLink } from "./RepoLink";
import {
  EDUCATION,
  EXPERIENCE,
  PROJECTS,
  TECH_STACK,
  EXTRACURRICULARS,
  INTERESTS,
} from "../data/content";
import { CONTACT } from "../data/contacts";

const SECTION_TITLES: Record<PanelId, string> = {
  rundown: "Rundown",
  connect: "Connect",
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  techstack: "Tech Stack",
  extracurriculars: "Extracurriculars",
  interests: "Interests",
};

/** The content card that opens over the 3D scene, centred on it. */
export function PanelOverlay() {
  const activePanel = useStore((s) => s.activePanel);
  const focusedEntry = useStore((s) => s.focusedEntry);
  const closePanel = useStore((s) => s.closePanel);
  const keys = useKeyboardState();

  useEffect(() => {
    if (!activePanel) return;

    /**
     * Space closes as well as Escape: it is the key that opened most of these
     * — a book in the library, an island in the bay, a balloon over the range
     * — so it is the key the hand is already on, and it should let go of what
     * it took hold of.
     *
     * The press that opened the card is usually still down when this runs, and
     * closing on it would shut the card in the same breath it opened. So a
     * card opened with Space held waits for that key to come up before the
     * next press counts; one opened by a click is armed from the start. The
     * scenes' own interact refuses to re-arm while a panel is open (see e.g.
     * `LibraryScene`), which is the other half of this — without it the press
     * that closes the card would be read as a fresh open on the next frame.
     */
    let armed = !keys.current.jump;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
      else if (e.key === " " && armed) {
        e.preventDefault();
        closePanel();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") armed = true;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [activePanel, closePanel, keys]);

  if (!activePanel) return null;

  return (
    <div className="panel-backdrop" onClick={closePanel}>
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="panel-header">
          {/* A focused panel is about one entry, so it takes that entry's name
              — "Experience" over a single role reads like a mislabelled list. */}
          <h2>{focusedEntry ?? SECTION_TITLES[activePanel]}</h2>
          <button className="panel-close" onClick={closePanel} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body">{renderContent(activePanel, focusedEntry)}</div>
        <p className="panel-hint">Space or Esc to close</p>
      </div>
    </div>
  );
}

function renderContent(id: PanelId, focusedEntry: string | null) {
  switch (id) {
    case "rundown":
      return <RundownContent />;
    case "connect":
      return <ConnectContent />;
    case "education":
      return <EducationContent focus={focusedEntry} />;
    case "experience":
      return <ExperienceContent focus={focusedEntry} />;
    case "projects":
      return <ProjectsContent focus={focusedEntry} />;
    case "techstack":
      return <TechStackContent focus={focusedEntry} />;
    case "extracurriculars":
      return <ExtracurricularsContent focus={focusedEntry} />;
    case "interests":
      return <InterestsContent />;
    default:
      return null;
  }
}

function RundownContent() {
  // TODO(sam): replace with the real rundown copy.
  return (
    <div className="placeholder-note">
      <p>This section is a work in progress — check back soon.</p>
    </div>
  );
}

function ConnectContent() {
  return (
    <div className="connect-content">
      <p className="connect-phone">{CONTACT.phoneDisplay}</p>
      <div className="connect-links">
        <a className="connect-btn" href={CONTACT.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="connect-btn" href={CONTACT.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        {/* No target: a mailto opened in a new tab leaves a blank page behind. */}
        <a className="connect-btn" href={CONTACT.gmail}>
          Gmail
        </a>
      </div>
    </div>
  );
}

/**
 * `focus` narrows the list to a single school, mirroring `ExperienceContent` —
 * the library world's books pass the `school` string itself rather than their
 * internal slug, so this stays one key space with `data/content.ts`. A focus
 * matching nothing falls through to the placeholder — every book on the table
 * now has an entry behind it, so that path is the safety net for a future one
 * rather than something a visitor can currently reach.
 */
function EducationContent({ focus }: { focus?: string | null }) {
  const entries = focus ? EDUCATION.filter((e) => e.school === focus) : EDUCATION;

  if (entries.length === 0) return <PlaceholderNote />;

  return (
    <div className="entry-list">
      {entries.map((e) => (
        <div className="entry-card" key={e.school}>
          <h3>{e.school}</h3>
          <p className="entry-meta">
            {e.program} — {e.dates}
          </p>
          <ul>
            {e.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <TagPills tags={e.tags} />
          {e.coursework.length > 0 && (
            <Collapsible title="Relevant Coursework">
              <ul className="coursework-list">
                {e.coursework.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Collapsible>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * `focus` narrows the list to a single org — that's how the desk objects in the
 * office world open one role each. Unset (a meadow portal) shows all of them.
 */
function ExperienceContent({ focus }: { focus?: string | null }) {
  const entries = focus ? EXPERIENCE.filter((e) => e.org === focus) : EXPERIENCE;

  if (entries.length === 0) return <PlaceholderNote />;

  return (
    <div className="entry-list">
      {entries.map((e) =>
        // An entry with no bullets is a stub awaiting real copy; rendering the
        // card would show an org name over empty space.
        e.bullets.length === 0 ? (
          <PlaceholderNote key={e.org + e.role} />
        ) : (
          <div className="entry-card" key={e.org + e.role}>
            <h3>{e.org}</h3>
            <p className="entry-meta">
              {e.role} — {e.dates}
            </p>
            <ul>
              {e.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <TagPills tags={e.tags} />
          </div>
        )
      )}
    </div>
  );
}

function PlaceholderNote() {
  return (
    <div className="placeholder-note">
      <p>This section is a work in progress — check back soon.</p>
    </div>
  );
}

/**
 * `focus` narrows the list to a single project — that's how the islands in the
 * archipelago open one project each. Unset (the meadow portal) shows all of them.
 */
function ProjectsContent({ focus }: { focus?: string | null }) {
  const entries = focus ? PROJECTS.filter((p) => p.name === focus) : PROJECTS;

  if (entries.length === 0) return <PlaceholderNote />;

  return (
    <div className="entry-list">
      {entries.map((p) =>
        // An entry with no bullets is a stub awaiting real copy; rendering the
        // card would show a project name over empty space.
        p.bullets.length === 0 ? (
          <PlaceholderNote key={p.name} />
        ) : (
          <div className="entry-card" key={p.name}>
            {/* Before the heading in the DOM so a keyboard reaches the repo
                from the top of the card, and so the mark is the first thing
                announced with the project rather than a stray link after the
                pills. It is positioned into the corner by CSS. */}
            {p.repo && <RepoLink href={p.repo} project={p.name} />}
            <h3>{p.name}</h3>
            <p className="entry-meta">{p.meta}</p>
            <ul>
              {p.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <TagPills tags={p.tags} />
          </div>
        )
      )}
    </div>
  );
}

/**
 * Reuses the entry-card shell rather than its own layout — a group is the same
 * shape as any other card, just with the pills carrying the content instead of
 * a bullet list.
 *
 * `focus` narrows to a single group by its `label`, mirroring `ProjectsContent`,
 * so this stays one key space with `data/content.ts`. Nothing narrows it at the
 * moment — the meadow portal shows all of them, and the space world's chips
 * are hover-only — but the shape is kept in step with the other panels.
 */
function TechStackContent({ focus }: { focus?: string | null }) {
  const groups = focus ? TECH_STACK.filter((g) => g.label === focus) : TECH_STACK;

  if (groups.length === 0) return <PlaceholderNote />;

  return (
    <div className="entry-list">
      {groups.map((g) => (
        <div className="entry-card" key={g.label}>
          <h3>{g.label}</h3>
          <p className="entry-meta">{g.blurb}</p>
          <TagPills tags={g.items} />
        </div>
      ))}
    </div>
  );
}

/**
 * `focus` narrows the list to a single association — that's how the balloons on
 * the Associations hill open one each. They pass the `org` string verbatim, so
 * this stays one key space with `data/content.ts`. Unset (the meadow portal)
 * shows all of them.
 */
function ExtracurricularsContent({ focus }: { focus?: string | null }) {
  const entries = focus ? EXTRACURRICULARS.filter((e) => e.org === focus) : EXTRACURRICULARS;

  if (entries.length === 0) return <PlaceholderNote />;

  return (
    <div className="entry-list">
      {entries.map((e) =>
        // An entry with no bullets is a stub awaiting real copy; rendering the
        // card would show an org name over empty space.
        e.bullets.length === 0 ? (
          <PlaceholderNote key={e.org + e.role} />
        ) : (
          <div className="entry-card" key={e.org + e.role}>
            <h3>{e.org}</h3>
            <p className="entry-meta">{e.role}</p>
            <ul>
              {e.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <TagPills tags={e.tags} />
          </div>
        )
      )}
    </div>
  );
}

function InterestsContent() {
  return (
    <div className="interests-grid">
      {INTERESTS.map((i) => (
        <div className="interest-item" key={i.label}>
          <span className="interest-icon">{i.icon}</span>
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}
