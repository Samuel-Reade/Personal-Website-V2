import { useStore, type WorldId } from "./state/useStore";
import { ControlsHint } from "./ui/ControlsHint";
import { MeadowWorld } from "./MeadowWorld";
import { OfficeWorld } from "./worlds/experience/OfficeWorld";
import { EducationWorld } from "./worlds/education/EducationWorld";
import { ProjectsWorld } from "./worlds/projects/ProjectsWorld";
import { TechStackWorld } from "./worlds/techstack/TechStackWorld";
import { InterestsWorld } from "./worlds/interests/InterestsWorld";

/**
 * Worlds are mutually exclusive and fully unmount each other — each owns its
 * own Canvas, lighting, and post-processing, so nothing from the meadow's toon
 * setup leaks into the office's flat-shaded one.
 */
function World({ world }: { world: WorldId }) {
  switch (world) {
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
    default:
      return <MeadowWorld />;
  }
}

export default function App() {
  const world = useStore((s) => s.world);

  return (
    <>
      <World world={world} />
      {/* Deliberately outside the switch: the controls key is the one piece of
          chrome that has to survive a world change. Kept here it keeps its
          open/closed state through a portal transit, where a copy living inside
          each world would pop open again on every arrival. */}
      <ControlsHint />
    </>
  );
}
