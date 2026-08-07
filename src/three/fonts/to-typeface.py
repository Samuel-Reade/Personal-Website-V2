"""Convert a static TTF into the three.js `typeface.json` format.

`TextGeometry` can't read a woff2 or a CSS font-family — it needs glyph outlines
as JSON — so the in-world extruded text can't just pick up the Space Grotesk that
the stylesheet loads. This regenerates `space-grotesk-700.typeface.json` from the
same face. It is a one-off tool, not part of the build; nothing in `src` imports
it and it needs only fontTools (`pip install fonttools`).

    # The old-Android UA is what makes Google Fonts serve static .ttf instead of
    # the woff2 a modern browser gets.
    UA='Mozilla/5.0 (Linux; U; Android 2.2; en-us; DROID2 GLOBAL Build/S273)'
    curl -A "$UA" 'https://fonts.googleapis.com/css?family=Space+Grotesk:700'
    curl -o SpaceGrotesk-Bold.ttf '<the .ttf url from that CSS>'
    python3 to-typeface.py SpaceGrotesk-Bold.ttf \\
        space-grotesk-700.typeface.json "Space Grotesk" 700

Emits the same shape facetype.js does, which is what three's FontLoader parses:
  m x y                          moveTo
  l x y                          lineTo
  q endX endY cpX cpY            quadratic (END POINT FIRST)
  b endX endY cp1X cp1Y cp2X cp2Y   cubic  (END POINT FIRST)
"""

import json
import sys

from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont


def fmt(n: float) -> str:
    r = round(n)
    return str(int(r))


class TypefacePen(BasePen):
    """Records an outline as the space-separated command string three expects."""

    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.parts: list[str] = []

    def _moveTo(self, pt):
        self.parts += ["m", fmt(pt[0]), fmt(pt[1])]

    def _lineTo(self, pt):
        self.parts += ["l", fmt(pt[0]), fmt(pt[1])]

    def _qCurveToOne(self, cp, pt):
        self.parts += ["q", fmt(pt[0]), fmt(pt[1]), fmt(cp[0]), fmt(cp[1])]

    def _curveToOne(self, cp1, cp2, pt):
        self.parts += [
            "b", fmt(pt[0]), fmt(pt[1]),
            fmt(cp1[0]), fmt(cp1[1]),
            fmt(cp2[0]), fmt(cp2[1]),
        ]

    def _closePath(self):
        # three's ShapePath closes each subpath implicitly at the next `m`, so
        # facetype.js emits nothing here and so do we.
        pass


# Printable ASCII, the Latin-1 letters, and the punctuation that actually turns
# up in labels. Anything outside this falls back to three's '?' glyph, so the
# subset is a size/coverage trade rather than a correctness one.
CHARS = (
    [chr(c) for c in range(0x20, 0x7F)]
    + [chr(c) for c in range(0xA0, 0x100)]
    + list("–—‘’“”…•×")
)


def convert(ttf_path: str, out_path: str, family: str, weight: str) -> None:
    font = TTFont(ttf_path)
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]
    head = font["head"]
    post = font["post"]

    glyphs = {}
    missing = []
    for char in CHARS:
        name = cmap.get(ord(char))
        if name is None:
            missing.append(char)
            continue

        pen = TypefacePen(glyph_set)
        glyph_set[name].draw(pen)

        advance, _ = hmtx[name]

        bounds_pen = BoundsPen(glyph_set)
        glyph_set[name].draw(bounds_pen)
        # Blank glyphs (space) have no bounds at all; facetype.js writes zeros.
        x_min, x_max = (0, 0) if bounds_pen.bounds is None else (
            round(bounds_pen.bounds[0]),
            round(bounds_pen.bounds[2]),
        )

        entry = {"ha": advance, "x_min": x_min, "x_max": x_max}
        if pen.parts:
            entry["o"] = " ".join(pen.parts)
        glyphs[char] = entry

    data = {
        "glyphs": glyphs,
        "familyName": family,
        "ascender": font["hhea"].ascent,
        "descender": font["hhea"].descent,
        "underlinePosition": post.underlinePosition,
        "underlineThickness": post.underlineThickness,
        "boundingBox": {
            "yMin": head.yMin,
            "xMin": head.xMin,
            "yMax": head.yMax,
            "xMax": head.xMax,
        },
        "resolution": head.unitsPerEm,
        "original_font_information": {
            "format": 0,
            "copyright": font["name"].getDebugName(0) or "",
            "fontFamily": family,
            "fontSubfamily": font["name"].getDebugName(2) or "",
            "fullName": f"{family} {weight}",
            "license": font["name"].getDebugName(13) or "",
        },
        "cssFontWeight": weight,
        "cssFontStyle": "normal",
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"), ensure_ascii=False)

    print(f"wrote {out_path}: {len(glyphs)} glyphs, missing {missing!r}")


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
