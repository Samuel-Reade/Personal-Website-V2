import { lazy, Suspense, useEffect } from "react";
import { useStore, type WorldId } from "./state/useStore";
import { ControlsHint } from "./ui/ControlsHint";
import { SpeedControl } from "./ui/SpeedControl";
import { MuteControl } from "./ui/MuteControl";
import { TopBar } from "./ui/TopBar";
import { LoadingScreen } from "./ui/LoadingScreen";
import { MansionWorld } from "./worlds/mansion/MansionWorld";
import { startMusic } from "./audio/music";

/**
 * Everything past the entry hall is a lazy chunk.
 *
 * The hall is what the loading screen waits for, so it is imported eagerly and
 * shares the main bundle. The meadow and the five worlds behind its portals are
 * split out: they are most of the site's weight, and a visitor who reads the
 * book on the table and leaves should never have paid to download the office.
 * Each fetches while its portal transition is on screen.
 */
const MeadowWorld = lazy(() => import("./MeadowWorld").then((m) => ({ default: m.MeadowWorld })));
const OfficeWorld = lazy(() =>
  import("./worlds/experience/OfficeWorld").then((m) => ({ default: m.OfficeWorld }))
);
const EducationWorld = lazy(() =>
  import("./worlds/education/EducationWorld").then((m) => ({ default: m.EducationWorld }))
);
const ProjectsWorld = lazy(() =>
  import("./worlds/projects/ProjectsWorld").then((m) => ({ default: m.ProjectsWorld }))
);
const TechStackWorld = lazy(() =>
  import("./worlds/techstack/TechStackWorld").then((m) => ({ default: m.TechStackWorld }))
);
const InterestsWorld = lazy(() =>
  import("./worlds/interests/InterestsWorld").then((m) => ({ default: m.InterestsWorld }))
);
const AssociationsWorld = lazy(() =>
  import("./worlds/associations/AssociationsWorld").then((m) => ({ default: m.AssociationsWorld }))
);

/**
 * Worlds are mutually exclusive and fully unmount each other — each owns its
 * own Canvas, lighting, and post-processing, so nothing from the meadow's toon
 * setup leaks into the office's flat-shaded one.
 */
function World({ world }: { world: WorldId }) {
  switch (world) {
    case "meadow":
      return <MeadowWorld />;
    case "experience":
      return <OfficeWorld />;
    case "education":
      return <EducationWorld />;
    case "projects":
      return <ProjectsWorld />;
    case "techstack":
      return <TechStackWorld />;
    case "interests":
      return <InterestsWorld />;
    case "associations":
      return <AssociationsWorld />;
    default:
      return <MansionWorld />;
  }
}

export default function App() {
  const world = useStore((s) => s.world);
  const entered = useStore((s) => s.entered);

  // The music plays through every world, so it starts here, above the switch,
  // rather than in any one of them. The context behind it was created by the
  // Enter click, which is the user gesture browsers require before any of it
  // is allowed to make a sound.
  useEffect(() => {
    if (!entered) return;
    return startMusic();
  }, [entered]);

  return (
    <>
      {/* Black rather than a spinner while a world chunk arrives: every world
          fades up from its own background anyway, and a spinner between two 3D
          rooms reads as a stall rather than as travel. */}
      <Suspense fallback={<div className="world-loading" />}>
        <World world={world} />
      </Suspense>

      {/* Deliberately outside the switch: the controls key is the one piece of
          chrome that has to survive a world change. Kept here it keeps its
          open/closed state through a portal transit, where a copy living inside
          each world would pop open again on every arrival.

          Held back until the visitor is in, so its one auto-dismissal isn't
          spent behind the loading screen where nobody can read it. */}
      {entered && <ControlsHint />}
      {/* Beside it for the same reason: the speed setting has to survive a
          world change, so it can't live inside any world — and the music
          toggle sits with it, since the music does too. */}
      {entered && (
        <div className="input-chrome">
          <SpeedControl />
          <MuteControl />
        </div>
      )}
      {/* The clock and, past the meadow, the way back: the top-right corner
          of every world, kept out here so it never blinks on a transit. */}
      {entered && <TopBar />}

      {!entered && <LoadingScreen />}
    </>
  );
}
