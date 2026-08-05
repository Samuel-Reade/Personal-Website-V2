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

- The entire field is grass — no clearing, plaza, or paths. The player
  spawns right in the tall grass (which parts around them, same as
  anywhere else in the field), and six gnarled Japanese maple trees ring
  the spawn point close by, reached by walking straight through the
  grass.
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
- **Wind**: the field is dense, tall grass (30,000 instanced clumps) that
  leans in a consistent direction at rest — baked into the geometry
  itself, not just animated — plus a continuous animated sway on top via
  a small vertex shader injected into `MeshToonMaterial`
  (`src/utils/toon.ts`); tall field grass additionally bends away from
  the player's position as they walk through it. Tree canopies sway the
  same way.

## Surface texture

Bark and leaves use small procedurally-drawn canvas textures
(`src/utils/textures.ts` — no external image fetches) multiplied against
each material's flat palette color: bark gets a streaky wood-grain
pattern, leaf clusters get a mottled blotchy pattern, so both read as
hand-painted surfaces instead of solid flat-colored shapes.

## Cel-shading, outlines & lighting

- **Stepped lighting ramp**: `getSharedGradient()` in `src/utils/toon.ts`
  is a deliberately non-uniform 3-band ramp (shadow / midtone /
  highlight, with hard cutoffs) rather than an evenly-spaced gradient —
  this is what gives every `MeshToonMaterial` in the scene its flat,
  "stepped" cel-shaded look instead of smooth lighting falloff.
- **Outline**: drei's `<Outlines>` component on the player's major body
  parts, the tree canopy's leaf clusters, and the signs — a constant
  screen-space-width dark stroke per mesh (not tied to object scale),
  with a crease `angle` tuned per shape (box-corner-sharp on the
  character/signs, fully smooth on the rounded leaf clusters).
- **Rim light**: `createRimToonMaterial` / the `rim` option on
  `createSwayToonMaterial` and `createGrassMaterial` inject a Fresnel-style
  warm rim term into the fragment shader — applied to the player, tree
  bark/leaves, and grass, so edges catch a warm glow where they face away
  from the camera (evoking sunlight skimming an edge) without any extra
  geometry.
- **Golden-hour lighting**: the sun is tinted amber (`#ffd9a3`) rather
  than neutral white, paired with a cool blue fill light for shadow
  areas and soft PCF shadows (`shadow-radius` on the sun light).
- **Postprocessing** (`@react-three/postprocessing`, wired in `App.tsx`):
  a `Bloom` pass glows bright highlights (sun, moon, sunlit rims), and a
  small `HueSaturation` desaturation mutes the palette toward the
  "painterly, not photoreal" side.

These are all static/stylistic choices rather than physically tied to
the sun's real position — e.g. the rim color doesn't shift with time of
day — which keeps the shader work simple at the cost of some realism
(a faint warm rim is still visible on trees at night).

## Project structure

```
src/
  data/content.ts       Resume content (education, experience, projects, …)
  state/useStore.ts      Zustand store — which panel is open
  hooks/useKeyboard.ts    Arrow-key input tracked in a ref
  utils/time.ts           Sun/moon position + season, driven by the real clock
  utils/toon.ts           Shared toon gradient map + wind/bend shader helpers
  utils/textures.ts       Procedural bark/leaf canvas textures
  three/
    Scene.tsx             Top-level scene composition
    SkyLighting.tsx        Sky dome, sun/moon lights, fog
    Mountains.tsx           Low-poly horizon backdrop
    Clouds.tsx              Drifting painterly cloud puffs
    Ground.tsx             The grass-colored ground plane
    Grass.tsx              Tall field grass — wind sway + player bending
    grassGeometry.ts        Shared instanced-blade geometry builder
    Flowers.tsx             Sparse wildflower detail in the field
    Trees.tsx / Sign.tsx    Gnarled maple trees (procedural branches) + clickable signs
    Outline.tsx             Shared inverted-hull outline material
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
shared stepped gradient map, warm directional "sun" + cool fill light,
scene fog for atmospheric depth, and a subtle SVG-noise grain overlay
(`.grain-overlay` in `src/styles.css`) blended over the whole viewport —
see [Cel-shading, outlines & lighting](#cel-shading-outlines--lighting)
for the rest of the stylized-rendering pass.
