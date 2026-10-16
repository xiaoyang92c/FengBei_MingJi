"""Build a photo-guided, interpretive 14 m monument GLB.

The supplied course PDF page 16 supplies silhouette and color breaks. The
Neijiang report supplies height, four receding stages and inscription wording.
This is an exhibition reconstruction, not a measured conservation model.
Exact profiles, cuts, weathering and glyph strokes await field data.
"""

from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "model"
OUT.mkdir(parents=True, exist_ok=True)
SCENE = trimesh.Scene()

SOURCE_STONE = Image.open(OUT / "limestone-v3.jpg").convert("RGB").resize((512, 512))
GRAIN = np.asarray(SOURCE_STONE, dtype=np.float32).mean(axis=2)
GRAIN = np.clip(1 + (GRAIN - GRAIN.mean()) / 460, .86, 1.14)


def tinted_stone(rgb):
    pixels = np.stack([np.clip(GRAIN * channel, 0, 255) for channel in rgb], axis=2)
    return Image.fromarray(pixels.astype("uint8"), "RGB")


PALETTE = {
    "steps": (78, 80, 72),
    "base": (129, 119, 96),
    "warm": (175, 132, 84),
    "shaft": (151, 132, 95),
    "panel": (192, 144, 88),
    "trim": (67, 72, 58),
    "joint": (91, 78, 57),
}
TEXTURES = {name: tinted_stone(rgb) for name, rgb in PALETTE.items()}
MATERIALS = {
    name: PBRMaterial(
        name=f"{name} sandstone - interpretive",
        baseColorTexture=image, baseColorFactor=[255, 255, 255, 255],
        metallicFactor=0, roughnessFactor=.94)
    for name, image in TEXTURES.items()
}


def add_mesh(name, mesh, material_name, uv_scale=.65):
    mesh.unmerge_vertices()
    mesh.vertex_normals = np.repeat(mesh.face_normals, 3, axis=0)
    normals = np.abs(mesh.vertex_normals)
    u = np.where(normals[:, 0] > .5, mesh.vertices[:, 2], mesh.vertices[:, 0])
    v = np.where(normals[:, 1] > .5, mesh.vertices[:, 2], mesh.vertices[:, 1])
    mesh.visual = TextureVisuals(
        uv=np.column_stack((u * uv_scale, v * uv_scale)),
        image=TEXTURES[material_name], material=MATERIALS[material_name])
    SCENE.add_geometry(mesh, node_name=name, geom_name=name)


def box(name, extents, center, material_name, uv_scale=.65):
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(center)
    add_mesh(name, mesh, material_name, uv_scale)


def frustum(name, lower, upper, y0, y1, material_name):
    a, b = lower / 2, upper / 2
    vertices = np.array([
        [-a, y0, -a], [a, y0, -a], [a, y0, a], [-a, y0, a],
        [-b, y1, -b], [b, y1, -b], [b, y1, b], [-b, y1, b],
    ])
    faces = np.array([
        [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
        [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    ])
    add_mesh(name, trimesh.Trimesh(vertices=vertices, faces=faces, process=False), material_name)


def font(size):
    paths = [
        Path("C:/Windows/Fonts/SIMLI.TTF"),
        Path("C:/Windows/Fonts/simsun.ttc"),
        Path("/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc"),
    ]
    path = next((item for item in paths if item.exists()), None)
    if path is None:
        raise FileNotFoundError("Install a Chinese font to render the inscription")
    return ImageFont.truetype(str(path), size)


def title_texture():
    """High resolution legible reading, not a claim of exact historic strokes."""
    tile = TEXTURES["panel"].resize((768, 768))
    image = Image.new("RGB", (768, 3072))
    for row in range(4):
        image.paste(tile, (0, row * 768))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((33, 30, 735, 3037), outline=(74, 68, 48, 115), width=6)
    draw.rectangle((47, 44, 721, 3023), outline=(237, 186, 121, 105), width=3)
    chars = "成渝铁路筑路民工纪念碑"
    face = font(164)
    cell = 245
    start = (3072 - len(chars) * cell) / 2
    for index, char in enumerate(chars):
        y = start + (index + .5) * cell
        draw.text((387, y + 4), char, font=face, anchor="mm", fill=(236, 184, 113, 155))
        draw.text((384, y), char, font=face, anchor="mm", fill=(50, 44, 31, 245),
                  stroke_width=2, stroke_fill=(82, 62, 35, 200))
    image.save(OUT / "inscription-panel-v4.png", optimize=True)
    return image


TITLE = title_texture()
TITLE_MATERIAL = PBRMaterial(
    name="title reading - strokes and orientation pending survey",
    baseColorTexture=TITLE, baseColorFactor=[255, 255, 255, 255],
    metallicFactor=0, roughnessFactor=.98, doubleSided=False)


def foundation_texture():
    """Readable layout for the verified south-face foundation wording."""
    image = TEXTURES["warm"].resize((768, 512))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((28, 25, 740, 487), outline=(74, 58, 38, 120), width=5)
    chars = "一九五四年七月一日奠基"
    face = font(78)
    for index, char in enumerate(chars):
        column, row = divmod(index, 4)
        x = 596 - column * 212
        y = 78 + row * 108
        draw.text((x + 2, y + 3), char, font=face, anchor="mm", fill=(233, 188, 125, 150))
        draw.text((x, y), char, font=face, anchor="mm", fill=(71, 51, 32, 228))
    image.save(OUT / "foundation-reading-v4.png", optimize=True)
    return image


FOUNDATION = foundation_texture()
FOUNDATION_MATERIAL = PBRMaterial(
    name="1954 foundation reading - layout pending survey",
    baseColorTexture=FOUNDATION, baseColorFactor=[255, 255, 255, 255],
    metallicFactor=0, roughnessFactor=.96, doubleSided=False)


def foundation_panel():
    vertices = np.array([
        [-1.14, 2.40, 1.387], [1.14, 2.40, 1.387],
        [1.14, 3.42, 1.387], [-1.14, 3.42, 1.387],
    ])
    mesh = trimesh.Trimesh(vertices=vertices, faces=[[0, 1, 2], [0, 2, 3]], process=False)
    mesh.visual = TextureVisuals(uv=np.array([[0, 0], [1, 0], [1, 1], [0, 1]]),
                                 image=FOUNDATION, material=FOUNDATION_MATERIAL)
    SCENE.add_geometry(mesh, node_name="south foundation reading", geom_name="south foundation reading")


def inscription_panel(name, front=True):
    # Taper follows the shaft face; the title does not float on a flat plane.
    y0, y1 = 4.28, 12.96
    low_width, high_width = 1.10, .87
    low_z, high_z = .778, .625
    if front:
        vertices = np.array([
            [-low_width / 2, y0, low_z], [low_width / 2, y0, low_z],
            [high_width / 2, y1, high_z], [-high_width / 2, y1, high_z],
        ])
    else:
        vertices = np.array([
            [low_width / 2, y0, -low_z], [-low_width / 2, y0, -low_z],
            [-high_width / 2, y1, -high_z], [high_width / 2, y1, -high_z],
        ])
    mesh = trimesh.Trimesh(vertices=vertices, faces=[[0, 1, 2], [0, 2, 3]], process=False)
    mesh.visual = TextureVisuals(uv=np.array([[0, 0], [1, 0], [1, 1], [0, 1]]),
                                 image=TITLE, material=TITLE_MATERIAL)
    SCENE.add_geometry(mesh, node_name=name, geom_name=name)


# Approach steps are part of the illustrated silhouette, not a survey of the park.
box("stair landing", [7.2, .18, 4.5], [0, -.11, -.9], "steps")
for step in range(6):
    box(f"approach stair {step + 1}", [6.6 - step * .13, .17, .47],
        [0, -.15 + step * .12, 3.35 - step * .48], "steps", .9)

# Four visually distinct receding stages described in the local report.
box("lower plinth foot", [3.55, .25, 3.55], [0, .25, 0], "trim")
box("lower plinth chamfer", [3.4, .15, 3.4], [0, .45, 0], "base")
box("lower plinth body", [3.16, 1.34, 3.16], [0, 1.19, 0], "base")
box("lower front inset", [2.52, .98, .055], [0, 1.2, 1.61], "base", .38)
for side in (-1, 1):
    box(f"lower pier {side}", [.18, 1.37, 3.24], [side * 1.48, 1.18, 0], "warm")
box("lower cornice", [3.42, .2, 3.42], [0, 1.96, 0], "trim")
box("second stage foot", [2.94, .2, 2.94], [0, 2.17, 0], "joint")
box("ochre second stage", [2.72, 1.28, 2.72], [0, 2.91, 0], "warm")
foundation_panel()
for side in (-1, 1):
    box(f"second stage pier {side}", [.13, 1.22, 2.75], [side * 1.3, 2.91, 0], "base")
box("second stage top", [2.96, .16, 2.96], [0, 3.64, 0], "trim")
box("shaft step", [2.05, .22, 2.05], [0, 3.84, 0], "joint")
box("shaft lower collar", [1.72, .18, 1.72], [0, 4.03, 0], "trim")
frustum("slender sandstone shaft", 1.59, 1.25, 4.12, 13.20, "shaft")
inscription_panel("south title reading", True)
inscription_panel("north title reading", False)
box("upper shaft collar", [1.65, .18, 1.65], [0, 13.30, 0], "trim")
box("top cornice", [1.78, .18, 1.78], [0, 13.49, 0], "joint")
frustum("small hipped crown", 1.13, .42, 13.58, 13.95, "trim")
box("crown finial", [.43, .07, .43], [0, 13.965, 0], "trim")

OUTPUT = OUT / "chengyu-monument.glb"
OUTPUT.write_bytes(SCENE.export(file_type="glb"))
print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KiB)")
