# Personal Website V2

A walkable, painterly 3D portfolio. You control a third-person character
around a circular grass field, and walk up to trees and signs to read
resume content in slide-in panels.

Built with **React Three Fiber**, **@react-three/drei**, and **Zustand**,
styled with custom toon-shaded materials rather than a physics engine —
see [Notes](#notes) below for why.

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

```bash
npm run build    # production build (tsc -b && vite build)
npm run preview  # preview the production build locally
```

## Controls

- **Arrow keys** — walk (camera-relative)
- **Drag** — orbit the camera around the character
- **Scroll** — zoom in/out
- **Click a sign** — open its content panel
- **Esc** or click outside the panel — close it

## World layout

- A small, worn dirt clearing (an irregular, lumpy circle — not a paved
  plaza) is the spawn point, with old, poorly-kept dirt trails radiating
  out to six gnarled Japanese maple trees arranged in a ring. Short,
  patchy, trampled-down grass (5/8 the height of the surrounding field)
  grows over the clearing and trails; tall field grass is kept off them.
- Distant low-poly mountains ring the horizon, faded by fog for
  atmospheric depth, with soft painterly clouds drifting overhead.
- Each tree has a wooden sign for one resume section: **Education**,
  **Experience**, **Projects**, **Tech Stack**, **Extracurriculars**,
  **Interests**.
- Two standalone signs — **Rundown** and **Connect** — stand directly
  in front of spawn.
- The walk area is bounded by an invisible radius; trees and sign posts
  are solid.

## Environmental syncing

- **Time of day**: the sun/moon position, sky color, and lighting follow
  the visitor's real local clock (`src/utils/time.ts` → `getSunState`).
  Moonlight is deliberately bright — a strong moon directional light,
  a glow halo, and a raised night-time ambient floor — so the world
  stays legible after dark instead of going near-black.
- **Season**: each tree's canopy is built from small leaf clusters, each
  sampling a random color from the current season's 4-color palette
  (`getSeasonInfo` → `leafPalette`) rather than one flat tone — summer is
  a mix of greens, fall mixes red/maroon/orange, and winter density
  drops to 0 for fully bare, gnarled branches. Colors and density
  interpolate smoothly month-to-month rather than cutting on the 1st.
- **Wind**: grass and tree canopies sway continuously via a small vertex
  shader injected into `MeshToonMaterial` (`src/utils/toon.ts`); tall
  field grass additionally bends away from the player's position as
  they walk through it.

## Project structure

```
src/
  data/content.ts       Resume content (education, experience, projects, …)
  state/useStore.ts      Zustand store — which panel is open
  hooks/useKeyboard.ts    Arrow-key input tracked in a ref
  utils/time.ts           Sun/moon position + season, driven by the real clock
  utils/toon.ts           Shared toon gradient map + wind/bend shader helpers
  three/
    Scene.tsx             Top-level scene composition
    SkyLighting.tsx        Sky dome, sun/moon lights, fog
    Mountains.tsx           Low-poly horizon backdrop
    Clouds.tsx              Drifting painterly cloud puffs
    Ground.tsx             Field, worn clearing, dirt trails
    Grass.tsx              Tall field grass — wind sway + player bending
    PathGrass.tsx           Short, patchy grass over the clearing/trails
    grassGeometry.ts        Shared instanced-blade geometry builder
    Flowers.tsx             Sparse wildflower detail in the field
    Trees.tsx / Sign.tsx    Gnarled maple trees (procedural branches) + clickable signs
    Player.tsx              Third-person character + movement/collision
    CameraRig.tsx           Orbit camera following the player
    world.ts                Layout constants (positions, radii, collision)
  ui/
    PanelOverlay.tsx        Slide-in content panel + per-section rendering
    Collapsible.tsx         Coursework dropdown
    TagPills.tsx            Skill tag pills
    HUD.tsx                 Control hints + live time/season badge
```

## TODOs

A few sections are intentionally left as placeholders — search for
`TODO(sam)` in `src/ui/PanelOverlay.tsx`:

- **Rundown** panel content
- **Tech Stack** panel content
- **Connect** panel's GitHub / LinkedIn / Gmail links (currently `#`)

## Notes

Movement/collision uses simple distance checks (walk boundary + tree
trunks) rather than `@react-three/rapier` or `cannon-es` — there's no
need for a full physics engine for grass parting and character-vs-tree
collision, and skipping it keeps the bundle smaller.

The painterly cel-shaded look comes from `MeshToonMaterial` with a
shared 4-step gradient map, warm directional "sun" + cool fill light,
scene fog for atmospheric depth, and a subtle SVG-noise grain overlay
(`.grain-overlay` in `src/styles.css`) blended over the whole viewport.
