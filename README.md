# Personal Website V2

A walkable 3D portfolio. It opens in a mansion entry hall, where a glowing
book on a table holds the overview and a portal between the staircases
leads outside. Through it is a painterly grass meadow, and the meadow is a
hub: six more portals ring the spawn point, each opening into a whole
separate world built around one resume section — a library, an office, a
bay of islands, a solar system, a shelf.

Built with **React Three Fiber**, **@react-three/drei** and **Zustand**,
with hand-written toon and flat-shaded materials rather than a physics
engine or an asset pipeline — see [Notes](#notes) for why.

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

There is also `preview.html` → `src/preview.tsx`, a dev-only entry that
boots straight into one world (currently the entry hall), skipping the
loading screen and the walk to its portal. Point it at a different world by
swapping the import.

## Opening the site

The first thing on screen is a loading overlay: the name, a tagline, three
lines on how to move, click and travel, and a progress bar. Clicking
**Enter** fades it out into the entry hall.

The bar is wired to real work, not a timer — the hall is mounted and
rendering behind the overlay the whole time it is up, and each step reports
itself as it lands (`src/state/useLoading.ts`): webfonts ready, hall
geometry committed, shaders compiled via `gl.compile`, first frame drawn.
Forcing the compile there is what moves that cost in front of the button
instead of into the first second of walking around. If those steps somehow
never finish — WebGL blocked, say — the button unlocks anyway after 12
seconds rather than stranding anyone.

Only the hall is measured. Every world past it is a lazy chunk that fetches
during the portal transition, so the entry never waits on rooms the visitor
may not open.

The Enter click also creates the `AudioContext`. That is not incidental:
browsers keep audio suspended until a user gesture, so the button that
opens the door is also the one that is allowed to make a sound.

## The worlds

`src/state/useStore.ts` holds one `world` id at a time and `App.tsx`
switches on it. Worlds are mutually exclusive and fully unmount each
other — each owns its own `<Canvas>`, camera, lighting and (where it has
any) postprocessing, so nothing from the meadow's toon setup leaks into
the office's flat-shaded one.

| Portal | World | You are | Interaction |
| --- | --- | --- | --- |
| *(landing)* | Mansion entry hall | Walking in third person | Click the glowing book on the table |
| Education | Library hall | Walking the aisle in third person | Click a floating book (Tamalpais, UCLA, UC3M) |
| Experience | Open-plan office | Seated first-person at a desk | Click one of five figurines, one per employer |
| Projects | Island bay | Rowing a boat in third person | Click one of six islands |
| Tech Stack | Open space | Floating in a suit | Click one of the chips orbiting the planet |
| Interests | A bookshelf | Standing first-person | Hover only — nothing is clickable |
| Extracurriculars | *(none)* | — | Walking in opens its panel in the meadow |

Every portal is also directly clickable from the meadow, which opens its
panel without travelling — the behaviour every portal had before the
worlds existed, and still the fallback for any portal with no world
behind it (`WORLD_BY_PORTAL` in `useStore.ts`).

### Mansion entry hall (landing)

Where the site opens. A grand hall in checkerboard marble and dark
panelling, lit by a candle chandelier and wall sconces — the warmest and
darkest room on the site, deliberately, so stepping out into the meadow
reads as stepping outdoors. Two quarter-turn staircases sweep up and inward
onto balconies against the back wall, and the gap they leave between them
is where the portal to the meadow stands, square to the door.

At the centre, a circular table with an open book on a rest, glowing and
clickable: it opens the overview panel. "Samuel Reade" floats above it in
extruded 3D on the same bob as the labels over the meadow's portals, warmed
to the hall's candlelight rather than the portals' violet.

It has no back button — there is nothing behind it — so that corner carries
the ambience toggle instead.

### Meadow (hub)

Grass all the way out — no clearing, plaza or paths. The player spawns in
the tall grass (which parts around them, same as anywhere else) with the
six section portals on a ring 10 units out, all equidistant, each facing
back toward spawn with a bobbing extruded label above it. Distant ground
dissolves into fog and painterly clouds drift overhead. The walk area is
bounded by an invisible radius.

### Education — the library

A long hall of reading tables under stained glass, six windows a side
throwing light shafts across the floor. Most books on the tables are
scenery; the three that lift off their pedestals are the ones you can
read. A return portal stands behind spawn, so turning around is the
in-world way home.

### Experience — the office

A seated, first-person view of a desk on an open-plan floor: monitor,
desk props, coworkers in the middle distance. Five figurines stand on the
desk, one per employer, each opening that single role rather than the
whole Experience list (`openEntry`). Hovering one names it in an overlay
label. Being seated, it has no return portal — Esc or the back button.

### Projects — the archipelago

Six islands in a bay, one per project, each with a built centrepiece
standing for what the project was (a factory, a bar chart, a phone, a
gym bench, a film set, a ballot box). You row between them on animated
water with a wake trailing the boat. Return portal behind spawn.

### Tech Stack — the space world

The tools orbit a planet in four inclined shells (Languages, Web & 3D,
AI & ML, Infra & Product), each ring on its own tilt, radius and speed so
they never read as one flat target. Each chip extrudes its brand mark and
opens the tech group it belongs to. Thrust follows your aim, so pointing
up climbs. A black hole and distant planets fill out the system; a return
portal sits behind spawn, and the persistent back button covers players
who have drifted to the far side.

### Interests — the shelf

A stationary first-person view of a bookshelf with ten objects on three
tiers, one per interest. Unlike the office desk it borrows its shape
from, nothing here is clickable — hovering a piece lights it and names
it, and that is the whole interaction.

## Controls

Common to every world: **Esc** closes an open panel, and once nothing is
open, **Esc** leaves the world. Every world also has a persistent
`← Back to the meadow` button.

| | Hall | Meadow | Library | Archipelago | Space | Office / Shelf |
| --- | --- | --- | --- | --- | --- | --- |
| Up / Down | Walk | Walk | Walk | Row | Thrust | Look |
| Left / Right | Turn | Turn | Turn | Steer | Turn | Look |
| W / S | Look up/down | Look up/down | Look up/down | Look up/down | Aim | — |
| Space | — | Jump | Jump | — | — | — |
| Scroll | — | Zoom | — | — | — | — |
| Drag | — | — | — | — | — | Look |

In space, thrust follows your aim rather than the horizon, so W and S are
how you climb and dive. In the archipelago you're in a boat, so there's
nothing to jump with.

The meadow remembers where you were standing and which way you faced when
you stepped through a portal (`meadowReturn`), so you come back out at the
portal rather than at spawn.

## Environmental syncing

- **Time of day**: sun/moon position, sky color and lighting follow the
  visitor's real local clock (`src/utils/time.ts` → `getSunState`, with
  `src/three/celestial.ts` placing the bodies and fading them at the
  horizon). The meadow and the archipelago share it outright; the
  library's window shafts and the office's window sky read the same clock
  from indoors. Moonlight is deliberately bright — a strong moon
  directional light, a glow halo and a raised night-time ambient floor —
  so the world stays legible after dark instead of going near-black.
- **Wind**: the meadow is dense, tall grass (30,000 instanced clumps)
  leaning in a consistent direction at rest — baked into the geometry
  itself, not just animated — plus a continuous animated sway on top via a
  small vertex shader injected into `MeshToonMaterial`
  (`src/utils/toon.ts`); the grass additionally bends away from the
  player's position as they walk through it.

## 3D assets

There are none. Every object in every world (the character, the grass, the
portals, the office, the library, the islands, the shelf) is built at
runtime from primitive geometry, and every texture is generated on a canvas
or as a `DataTexture`. Nothing is loaded from disk, and the two things that
do come from packages are bundled rather than fetched: the tech-stack chips
extrude their marks from `simple-icons` SVG paths, and the extruded labels
use the typeface JSON described under [Typography](#typography). The
webfonts are the only network request the site makes.

The sound follows the same rule. The entry hall's room tone is synthesised
in `src/audio/ambience.ts` — a low fifth, a band of brown noise rolled off
hard, and a slow LFO wandering the filter — rather than loaded from a clip.
A few lines of Web Audio keeps the no-assets rule intact, and a generated
bed can run indefinitely where a looped file would need to be long enough
to hide its seam. There is a mute toggle in the hall, and it remembers.

An imported oak model (Kenney's CC0 [Nature Kit](https://kenney.nl/assets/nature-kit))
used to stand in the meadow, re-shaded through the toon pipeline. It went
when the trees were replaced by portals.

## Typography

Two faces, declared once as custom properties on `:root` in `styles.css`
and loaded from Google Fonts in `index.html`. No component names a family
itself.

- `--font-display` — **Space Grotesk** 500–700. Headings, world titles,
  section labels, buttons, tag pills, the clock badge, and the label that
  names whatever is under the cursor.
- `--font-body` — **Inter** 400–600. Panel prose: subtitles, entry meta,
  bullets, coursework, control hints.

Both stacks fall back to the system faces the site used before, and the
stylesheet is loaded with `display=swap`, so a slow or blocked Google Fonts
leaves the site typeset as it was rather than hiding text over the scene.
Nothing is set above 700 or below 400 — the weights that exist.

Two places can't read a custom property and are kept in step by hand:

- **Extruded in-world text** (portal labels, the return portal, the
  library's floating book titles) needs glyph outlines rather than a CSS
  family. `three/fonts/space-grotesk-700.typeface.json` is Space Grotesk
  700 converted to the format three's `FontLoader` parses, imported
  through `three/displayFont.ts` — so it is bundled, and in-world text
  never swaps mid-scene the way the HTML can. `three/fonts/to-typeface.py`
  regenerates it from the TTF and documents where the TTF comes from; it is
  a one-off tool, not part of the build.

  Sizes there are written as **cap height**, not em size, and converted by
  `displaySize()`. Space Grotesk's caps fill 700 of its 1000 em units where
  the previous face's filled 1013, so passing the old numbers straight
  through would have shrunk every label by a third.

- **The office monitor** (`worlds/experience/screenTexture.ts`) draws to a
  canvas, which takes a CSS font shorthand but can't see `:root`. It also
  redraws itself once `document.fonts` reports both faces ready — a texture
  is drawn once and cached, so without that the first draw would be frozen
  in the fallback face.

## Two looks

The meadow is cel-shaded and the worlds behind the portals are not. That
is deliberate: stepping through a portal should look like arriving
somewhere else, so their geometry is flat-shaded low-poly in soft pastels
— no toon ramp, no gradient map, no postprocessing (the `EffectComposer`
lives in `MeadowWorld.tsx` and nowhere else) — and each world defines its
own palette and material helpers (`worlds/*/palette.ts`,
`worlds/*/materials.ts`). The space world is the awkward one, being lit
against pure black; it needs a deliberate ambient lift, documented in
`SpaceLighting`.

The character is the exception that ties it together. The library reuses
the meadow's `Player` and `CameraRig` outright, so the same rim-lit,
outlined figure walks the aisle; the space world's `Astronaut` is a
suited rebuild of it and keeps the same outline treatment. Everything
they walk past is flat.

### Cel-shading, outlines & lighting (the meadow)

- **Stepped lighting ramp**: `getSharedGradient()` in `src/utils/toon.ts`
  is a deliberately non-uniform 3-band ramp (shadow / midtone /
  highlight, with hard cutoffs) rather than an evenly-spaced gradient —
  this is what gives every `MeshToonMaterial` in the scene its flat,
  "stepped" cel-shaded look instead of smooth lighting falloff.
- **Outline**: drei's `<Outlines>` on the player's major body parts — a
  constant screen-space-width dark stroke per mesh (not tied to object
  scale), in a warm dark brown rather than near-black so it reads as a
  drawn edge instead of a hard cut, with a crease `angle` tuned to the
  rounded geometry so it mostly traces silhouette.
- **Rim light**: `createRimToonMaterial` / the `rim` option on
  `createSwayToonMaterial` and `createGrassMaterial` inject a Fresnel-style
  warm rim term into the fragment shader — applied to the player and the
  grass, so edges catch a warm glow where they face away from the camera
  (evoking sunlight skimming an edge) without any extra geometry. The
  falloff is tuned steep (`power: 4.5`) on purpose: on rounded/faceted
  shapes or thin double-sided cards (grass), a gentler falloff gets
  non-negligible rim across a wide range of angles at once, which adds up
  across most of the visible surface and washes the base color toward the
  rim's warm tint instead of just glowing true edges — a steep falloff
  confines it to genuine grazing angles.
- **Golden-hour lighting**: the sun is tinted a soft warm gold (`#fff0d9`)
  rather than neutral white, paired with a cool blue fill light for
  shadow areas and soft PCF shadows (`shadow-radius` on the sun light).
  A more saturated amber was tried first and reverted — it suppresses
  blue much more than red relative to green, which pushes muted natural
  greens (grass, foliage) toward olive/khaki once multiplied through.
- **Postprocessing** (`@react-three/postprocessing`, wired in
  `MeadowWorld.tsx`): a `Bloom` pass glows genuinely bright highlights
  (sun, moon), and a small `HueSaturation` desaturation mutes the palette
  toward the "painterly, not photoreal" side. The bloom threshold sits
  above the toon gradient's highlight band (~0.93) on purpose — set much
  lower, as it originally was, nearly every sunlit surface in the scene
  blooms instead of just true highlights.

These are all static/stylistic choices rather than physically tied to the
sun's real position — e.g. the rim color doesn't shift with time of day —
which keeps the shader work simple at the cost of some realism.

## Content & panels

All resume copy lives in `src/data/content.ts`; nothing is fetched. One
`PanelOverlay` serves every world, rendering a section per `PanelId`.

Objects inside a world call `openEntry(panel, key)` rather than
`openPanel(panel)`, which narrows the panel to the single matching entry —
a figurine opens one role, an island opens one project, a book opens one
school, a chip opens one tech group. The key is the content string itself
(`org`, `name`, `school`, group `label`), so the worlds and
`content.ts` stay in one key space with no slug table in between. A focus
that matches nothing falls through to the work-in-progress note, which is
what the unfinished entries currently do.

## Project structure

```
src/
  App.tsx                 Switches on the active world id; lazy-loads all but the hall
  MeadowWorld.tsx         The hub: Canvas + postprocessing + HUD
  preview.tsx             Dev-only entry that boots one world directly
  audio/ambience.ts       Synthesised room tone + the mute preference
  data/content.ts         Resume content (education, experience, projects, …)
  state/useStore.ts       Zustand store — active world, open panel, focused entry
  state/useLoading.ts     The entry hall's real readiness, step by step
  hooks/useKeyboard.ts    Arrow-key input tracked in a ref
  utils/time.ts           Sun/moon position, driven by the real clock
  utils/toon.ts           Shared toon gradient + wind/bend/rim shader helpers
  three/                  The meadow, plus pieces shared with other worlds
    Scene.tsx               Meadow scene composition
    SkyLighting.tsx         Sky dome, sun/moon lights, fog
    celestial.ts            Body placement, horizon fade, glow sprite (shared)
    Clouds.tsx              Drifting painterly cloud puffs
    Ground.tsx              The grass-colored ground plane
    Grass.tsx               Tall field grass — wind sway + player bending
    grassGeometry.ts        Shared instanced-blade geometry builder
    Portals.tsx             The six section portals + extruded labels
    portalMaterial.ts       The swirling portal surface shader
    ReturnPortal.tsx        The way home, used by the walkable worlds
    displayFont.ts          The display face as outlines, for extruded text
    fonts/                  That face's typeface JSON + the script that makes it
    Player.tsx              Third-person character + movement/collision/jump
    CameraRig.tsx           Orbit camera following the player
    world.ts                Meadow layout (portal ring, radii, collision)
  worlds/
    mansion/              Entry hall — staircases, windows, chandelier, centrepiece
    education/            Library hall — shelves, tables, floating books, glass
    experience/           Office desk — figurines, props, coworkers, look controls
    projects/             Island bay — water, wake, boat, six island scenes
    techstack/            Space — orbital shells, chips, planets, black hole
    interests/            Shelf — three tiers of hover-only objects
  ui/
    LoadingScreen.tsx     The front door: primer, progress bar, Enter
    PanelOverlay.tsx      Slide-in content panel + per-section rendering
    Collapsible.tsx       Coursework dropdown
    TagPills.tsx          Skill tag pills
    HUD.tsx               Meadow control hints + live clock badge
  styles.css              Font/color custom properties, panel and HUD styling,
                          plus a per-world overlay block
```

Each world folder follows the same shape: a `*World.tsx` (Canvas, overlay
UI, Esc handling), a `*Scene.tsx` (contents), a `layout.ts` of positions
and constants, and `palette.ts` / `materials.ts` for its own flat-shaded
look.

## TODOs

Placeholders are intentional and marked `TODO(sam)`:

- **Rundown** panel copy (`src/ui/PanelOverlay.tsx`)
- **Connect** panel's GitHub / LinkedIn / Gmail links, currently `#`
- **Turner & Townsend** experience entry — role, dates, bullets
- **Voting Project** — meta and bullets (its island is already built)
- **Tamalpais High School** has a book in the library but no `EDUCATION`
  entry yet

Until an entry's `bullets` is non-empty the panel renders the
work-in-progress note rather than an empty card, so an unfinished entry is
safe to leave in place.

## Notes

Movement and collision are plain geometry rather than
`@react-three/rapier` or `cannon-es`. The meadow's default pass is a
circular walk boundary plus a list of circular obstacles; a world whose
geometry doesn't suit that passes `Player` a `resolveMove` override
instead, which mutates the candidate position in place — the library's
clamps to a rectangular hall and pushes out of each table along whichever
axis the player is least deep into, because solving the shallowest axis is
what makes sliding along a table edge feel right. There's no need for a
full physics engine for grass parting, a boat in a bay and a character
that hops, and skipping it keeps the bundle smaller.

The one place real physics does show up is the jump: takeoff speed is
derived from a stated apex and real gravity (`v² = 2gh`) rather than
dialled in, so the stated height and the actual height can't drift apart.
The world is metric — the character stands 1.97 units sole to crown — so
that's simply `9.81`, not a number tuned until the arc looked nice.

The painterly look of the hub comes from `MeshToonMaterial` with a shared
stepped gradient map, warm directional "sun" + cool fill light, scene fog
for depth, and a subtle SVG-noise grain overlay (`.grain-overlay` in
`src/styles.css`) blended over the whole viewport — see
[Two looks](#two-looks) for the rest of the stylized-rendering pass.
