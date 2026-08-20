/**
 * Pins the clock while the dev server is running. Imported for its side effect,
 * and it has to land before anything reads the time.
 *
 * Every world here asks the visitor's own clock what hour it is — see
 * `getSunState` — which is the right answer on the live site and an unhelpful
 * one in development: half of every day the sunlit half of the site cannot be
 * looked at. The balcony telescope is the sharpest case, since after sunset it
 * shows a starfield and there is no way to reach its four balloons at all.
 *
 * So the dev server runs at midday, and `?at=<hour>` picks another — `?at=1`
 * for the small hours, `?at=19` for dusk, which is how the night side of the
 * site still gets worked on. The whole file is behind `import.meta.env.DEV`, so
 * a production build strips it and the live site is always on real time.
 *
 * The hour is only half of it now. Since the sky runs on the visitor's real
 * sunrise and sunset, what it does depends as much on *where* they are as on
 * when — a December afternoon is a different sky in London and in Singapore,
 * and neither is the one outside this window.
 *
 * `utils/location.ts` takes `?lat=` / `?lon=` / `?tz=`, and they come with a
 * caveat worth stating plainly: they move the *coordinates* and nothing else.
 * The solar maths still reads its UTC offset off the browser, so a coordinate
 * from one side of the world paired with a clock from the other describes a
 * place that does not exist, and draws a sky to match — Sydney's longitude on
 * a Californian offset renders as midday at seven in the evening. Use them for
 * latitude alone, holding roughly to your own meridian.
 *
 * To actually stand somewhere else, move the browser rather than the URL:
 * devtools' sensors panel overrides the timezone, and Playwright takes
 * `timezoneId` on a context. Both change `Intl` and `Date` together, which is
 * the only combination that is ever true of a real visitor.
 *
 * The date is not settable at all yet, which is the real gap: the low-sun path
 * and MIN_SUN_PEAK only do anything in a northern midwinter, and there is
 * currently no way to look at one.
 */

/** The hour the dev server sits at unless the URL asks for another. */
const DEFAULT_HOUR = 13;

if (import.meta.env.DEV) {
  const hour = Number(new URLSearchParams(location.search).get("at") ?? DEFAULT_HOUR);

  if (Number.isFinite(hour)) {
    const RealDate = Date;

    /**
     * An offset rather than a fixed instant, which matters more than it looks:
     * pinning `Date.now()` to a constant stops time, and anything measuring an
     * elapsed span off it — a throttle, a fade, a frame delta — sees zero
     * forever. Shifting it leaves time running and moves only the wall clock.
     */
    const now = RealDate.now();
    const target = new RealDate(now);
    target.setHours(hour, 0, 0, 0);
    const offset = target.getTime() - now;

    const Pinned = function (...args: unknown[]) {
      return args.length === 0
        ? new RealDate(RealDate.now() + offset)
        : new (RealDate as unknown as new (...a: unknown[]) => Date)(...args);
    } as unknown as DateConstructor;

    Pinned.now = () => RealDate.now() + offset;
    Pinned.parse = RealDate.parse;
    Pinned.UTC = RealDate.UTC;
    // Cast because `prototype` is readonly on the type, and reassigning it is
    // the point: `instanceof Date` has to keep holding for what this hands back.
    (Pinned as { prototype: unknown }).prototype = RealDate.prototype;

    window.Date = Pinned;
  }
}
