import { useEffect } from "react";
import { useStore, type PanelId } from "../state/useStore";
import { Collapsible } from "./Collapsible";
import { TagPills } from "./TagPills";
import { EDUCATION, EXPERIENCE, PROJECTS, EXTRACURRICULARS, INTERESTS } from "../data/content";

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

/** The slide-in content panel that covers ~3/4 of the screen over the 3D scene. */
export function PanelOverlay() {
  const activePanel = useStore((s) => s.activePanel);
  const closePanel = useStore((s) => s.closePanel);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePanel]);

  if (!activePanel) return null;

  return (
    <div className="panel-backdrop" onClick={closePanel}>
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="panel-header">
          <h2>{SECTION_TITLES[activePanel]}</h2>
          <button className="panel-close" onClick={closePanel} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="panel-body">{renderContent(activePanel)}</div>
      </div>
    </div>
  );
}

function renderContent(id: PanelId) {
  switch (id) {
    case "rundown":
      return <RundownContent />;
    case "connect":
      return <ConnectContent />;
    case "education":
      return <EducationContent />;
    case "experience":
      return <ExperienceContent />;
    case "projects":
      return <ProjectsContent />;
    case "techstack":
      return <TechStackContent />;
    case "extracurriculars":
      return <ExtracurricularsContent />;
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
      <p className="connect-phone">+1 (415) 887-8215</p>
      {/* TODO(sam): swap these # placeholders for real profile URLs. */}
      <div className="connect-links">
        <a className="connect-btn" href="#" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="connect-btn" href="#" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a className="connect-btn" href="#" target="_blank" rel="noreferrer">
          Gmail
        </a>
      </div>
    </div>
  );
}

function EducationContent() {
  return (
    <div className="entry-list">
      {EDUCATION.map((e) => (
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

function ExperienceContent() {
  return (
    <div className="entry-list">
      {EXPERIENCE.map((e) => (
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
      ))}
    </div>
  );
}

function ProjectsContent() {
  return (
    <div className="entry-list">
      {PROJECTS.map((p) => (
        <div className="entry-card" key={p.name}>
          <h3>{p.name}</h3>
          <p className="entry-meta">{p.meta}</p>
          <ul>
            {p.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <TagPills tags={p.tags} />
        </div>
      ))}
    </div>
  );
}

function TechStackContent() {
  // TODO(sam): replace with the real tech stack content.
  return (
    <div className="placeholder-note">
      <p>This section is a work in progress — check back soon.</p>
    </div>
  );
}

function ExtracurricularsContent() {
  return (
    <div className="entry-list">
      {EXTRACURRICULARS.map((e) => (
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
      ))}
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
