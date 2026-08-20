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
