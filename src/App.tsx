import { useStore } from "./state/useStore";
import { MeadowWorld } from "./MeadowWorld";
import { OfficeWorld } from "./worlds/experience/OfficeWorld";
import { EducationWorld } from "./worlds/education/EducationWorld";
import { ProjectsWorld } from "./worlds/projects/ProjectsWorld";
import { TechStackWorld } from "./worlds/techstack/TechStackWorld";

/**
 * Worlds are mutually exclusive and fully unmount each other — each owns its
 * own Canvas, lighting, and post-processing, so nothing from the meadow's toon
 * setup leaks into the office's flat-shaded one.
 */
export default function App() {
  const world = useStore((s) => s.world);

  switch (world) {
    case "experience":
      return <OfficeWorld />;
    case "education":
      return <EducationWorld />;
    case "projects":
      return <ProjectsWorld />;
    case "techstack":
      return <TechStackWorld />;
    default:
      return <MeadowWorld />;
  }
}
