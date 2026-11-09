"""Render icons from the folded-map SVG used by the header.

Requires Pillow. Run: python scripts/generate-icons.py
Favicons use wider fold gaps on a rounded paper tile, so the mark keeps its
contrast on dark and light browser tabs alike (a transparent icon with dark ink
vanished on dark tabs). Installed-app icons use a full paper canvas with padding.
"""

from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public"
SOURCE = ROOT / "src" / "assets" / "atlas-mark.svg"
SCALE = 4
PAPER = "#fdfaf2"
TILE_RADIUS = 14  # of 64

svg = ET.parse(SOURCE).getroot()
_, _, mark_width, mark_height = map(float, svg.attrib["viewBox"].split())
panels = [
    ([tuple(map(float, point.split(","))) for point in element.attrib["points"].split()], element.attrib["fill"])
    for element in svg.findall("{http://www.w3.org/2000/svg}polygon")
]


def fitted_panels(size: int, favicon: bool):
    width = size * 52 / 64 if favicon else size * 0.75
    scale = width / mark_width
    left, top = (size - width) / 2, (size - mark_height * scale) / 2
    for index, (points, color) in enumerate(panels):
        x_min = min(x for x, _ in points)
        x_max = max(x for x, _ in points)
        fitted = []
        for x, y in points:
            # Widen fold gaps at tab size without changing the silhouette.
            inset = 0
            if favicon:
                if x == x_min and index > 0:
                    inset = size / 64
                elif x == x_max and index < len(panels) - 1:
                    inset = -size / 64
            fitted.append((left + x * scale + inset, top + y * scale))
        yield fitted, color


def make_icon(size: int, favicon: bool = False) -> Image.Image:
    image = Image.new("RGBA", (size * SCALE, size * SCALE), (0, 0, 0, 0) if favicon else PAPER)
    draw = ImageDraw.Draw(image)
    if favicon:
        draw.rounded_rectangle((0, 0, size * SCALE - 1, size * SCALE - 1), radius=size * SCALE * TILE_RADIUS / 64, fill=PAPER)
    for points, color in fitted_panels(size, favicon):
        draw.polygon([(round(x * SCALE), round(y * SCALE)) for x, y in points], fill=color)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def write_svg_favicon():
    polygons = []
    for points, color in fitted_panels(64, favicon=True):
        coordinates = " ".join(f"{x:g},{y:g}" for x, y in points)
        polygons.append(f'  <polygon points="{coordinates}" fill="{color}" />')
    OUT.joinpath("favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        f'  <rect width="64" height="64" rx="{TILE_RADIUS}" fill="{PAPER}" />\n'
        + "\n".join(polygons) + "\n</svg>\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    write_svg_favicon()
    for size, filename in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        make_icon(size, favicon=size <= 32).save(OUT / filename, optimize=True)
    make_icon(32, favicon=True).save(
        OUT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)],
        append_images=[make_icon(16, favicon=True)],
    )
    print("Generated SVG/PNG/ICO favicons and 180/192/512px app icons from atlas-mark.svg.")
