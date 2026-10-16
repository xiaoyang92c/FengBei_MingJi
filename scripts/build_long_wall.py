"""Build one continuous limestone and tree-shadow strip for all portals.

Mirrored tiles share their edge pixels. The entire strip is rendered as one
image, so there are no chapter boundaries in either the masonry or shadow.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public/assets/scenes"
OUTPUT_SIZE = (4556, 941)


def mirrored_strip(source: Image.Image, tile_width: int, tile_height: int) -> Image.Image:
    width, height = OUTPUT_SIZE
    tile = source.resize((tile_width, tile_height), Image.Resampling.LANCZOS)
    output = Image.new(source.mode, OUTPUT_SIZE)
    for row, top in enumerate(range(0, height, tile_height)):
        for col, left in enumerate(range(0, width, tile_width)):
            fragment = tile
            if col % 2:
                fragment = ImageOps.mirror(fragment)
            if row % 2:
                fragment = ImageOps.flip(fragment)
            output.paste(fragment, (left, top))
    return output


def make_wall(source: Image.Image, name: str) -> None:
    # The master wall is already a single woven panorama. Reprocess it as a
    # whole; mirroring entire wall panels creates a visible symmetry line.
    wall = np.asarray(source, dtype=np.float32).copy()
    x = np.linspace(0, 1, OUTPUT_SIZE[0], dtype=np.float32)
    # One slow exposure field spans the whole panorama, without restarting at portals.
    exposure = 1.095 + .025 * np.sin(x * np.pi * 2.3)
    wall *= exposure[None, :, None]
    wall += np.array([8, 8, 5], dtype=np.float32)
    target = ASSETS / name
    Image.fromarray(np.clip(wall, 0, 255).astype(np.uint8), "RGB").save(
        target, "WEBP", quality=91, method=5
    )
    print(target)


def make_shadow(source: Image.Image, name: str, tile_width: int, tile_height: int) -> None:
    shadow = mirrored_strip(source, tile_width, tile_height)
    alpha = shadow.getchannel("A").filter(ImageFilter.GaussianBlur(5))
    alpha = alpha.point(lambda value: round(value * .73))
    shadow.putalpha(alpha)
    target = ASSETS / name
    shadow.save(target, "WEBP", quality=85, method=5)
    print(target)


def main() -> None:
    wall = Image.open(ASSETS / "portal-wall-long-v9.webp").convert("RGB")
    shadow = Image.open(ASSETS / "tree-shadow-v5.webp").convert("RGBA")
    make_wall(wall, "portal-wall-long-v10.webp")
    make_shadow(shadow, "tree-shadow-long-v10.webp", 1519, 855)
    make_shadow(shadow, "tree-shadow-long-mobile-v10.webp", 1139, 641)


if __name__ == "__main__":
    main()
