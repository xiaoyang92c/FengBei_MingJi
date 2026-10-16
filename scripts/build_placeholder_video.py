"""Create an honest, silent media placeholder for player and subtitle QA."""

from pathlib import Path
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "video"
OUT.mkdir(parents=True, exist_ok=True)
font_path = "C:/Windows/Fonts/simsun.ttc"
sans_path = "C:/Windows/Fonts/msyh.ttc"
title_font = ImageFont.truetype(font_path, 78)
body_font = ImageFont.truetype(sans_path, 25)
small_font = ImageFont.truetype(sans_path, 19)
micro_font = ImageFont.truetype(sans_path, 15)
img = Image.new("RGB", (720, 960), "#24231f")
d = ImageDraw.Draw(img)
for i in range(960):
    color = (39 + int(i / 960 * 8), 43 + int(i / 960 * 4), 39 + int(i / 960 * 2))
    d.line((0, i, 720, i), fill=color)
# A diagrammatic railway perspective, never presented as archive imagery.
vanish = (430, 260)
for bottom_x in (-360, -160, 30, 215, 510, 690, 885, 1080):
    d.line((vanish[0], vanish[1], bottom_x, 980), fill="#888477", width=2)
for y in (348, 383, 428, 486, 564, 670, 816, 1010):
    ratio = (y - vanish[1]) / (960 - vanish[1])
    x_left = vanish[0] + (-80 - vanish[0]) * ratio
    x_right = vanish[0] + (930 - vanish[0]) * ratio
    d.line((x_left, y, x_right, y), fill="#77766c", width=max(1, int(ratio * 6)))
d.line((vanish[0], vanish[1], 95, 960), fill="#d4b691", width=7)
d.line((vanish[0], vanish[1], 820, 960), fill="#d4b691", width=7)
d.rectangle((0, 0, 720, 182), fill="#1a1d1b")
d.rectangle((0, 668, 720, 960), fill="#1a1d1b")
d.rectangle((42, 41, 50, 50), fill="#b84334")
d.text((67, 35), "成渝铁路 · 数字记忆馆", font=small_font, fill="#d5cbb8")
d.text((42, 105), "04  /  THE PEOPLE", font=micro_font, fill="#9e9b8d")
d.rectangle((42, 202, 224, 242), fill="#a63b2f")
d.text((55, 209), "演示占位 / DEMO", font=micro_font, fill="#f3eee3")
d.text((42, 701), "碑后的人", font=title_font, fill="#f3eee3")
d.line((42, 815, 678, 815), fill="#8b897e", width=2)
d.text((42, 841), "影像待核实史料与授权后替换", font=body_font, fill="#d5cbb8")
d.text((42, 893), "非历史影像 · 非真实口述", font=small_font, fill="#c6bbae")
poster = OUT / "narrator-poster.jpg"
img.save(poster, quality=88)
subprocess.run([
    "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-loop", "1", "-i", str(poster), "-t", "16",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27",
    "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart",
    str(OUT / "narrator-placeholder.mp4"),
], check=True, capture_output=True)
print("Wrote silent demonstration video and poster")
