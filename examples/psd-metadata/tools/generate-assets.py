"""Generate the sample's raster caches and composite using Pillow; no PSD IO here."""
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
W, H = 960, 640
FONT = Path("C:/Windows/Fonts/simhei.ttf")
layers = {}


def save_layer(key, image, text=None):
    box = image.getbbox()
    assert box
    crop = image.crop(box)
    (OUT / f"{key}.rgba").write_bytes(crop.tobytes())
    layers[key] = dict(left=box[0], top=box[1], width=crop.width, height=crop.height)
    if text:
        layers[key]["text"] = text
    return image


def blank():
    return Image.new("RGBA", (W, H))


def text_layer(key, value, cx, baseline, size, color):
    image = blank()
    font = ImageFont.truetype(str(FONT), size)
    draw = ImageDraw.Draw(image)
    x = round(cx - draw.textlength(value, font=font) / 2)
    draw.text((x, baseline), value, font=font, anchor="ls", fill=color)
    return save_layer(key, image, dict(
        text=value, transform=[1, 0, 0, 1, x, baseline],
        style=dict(font=dict(name="SimHei"), fontSize=size,
                   fillColor=dict(r=color[0], g=color[1], b=color[2])),
    ))


background = blank()
pixels = []
for y in range(H):
    for x in range(W):
        glow = math.exp(-(((x - 480) / 370) ** 2 + ((y - 240) / 280) ** 2))
        pixels.append((int(9 + 12 * glow), int(17 + 27 * glow), int(32 + 44 * glow), 255))
background.putdata(pixels)
save_layer("background", background)

stars = blank()
d = ImageDraw.Draw(stars)
rng = random.Random(20261113)
for _ in range(110):
    x, y = rng.randrange(35, 925), rng.randrange(30, 590)
    if 260 < x < 700 and 160 < y < 520:
        continue
    radius = rng.choice([1, 1, 1, 2])
    d.ellipse((x, y, x + radius, y + radius), fill=(155, 191, 224, rng.randrange(65, 160)))
d.arc((165, 25, 795, 655), 190, 345, fill=(71, 100, 132, 120), width=1)
d.arc((195, 55, 765, 625), 195, 340, fill=(71, 100, 132, 80), width=1)
save_layer("stars", stars)

emblem = blank()
d = ImageDraw.Draw(emblem)
d.ellipse((442, 110, 518, 186), outline=(202, 172, 111, 210), width=1)
d.polygon([(480, 119), (499, 153), (480, 175), (461, 153)], fill=(224, 192, 129, 255))
d.polygon([(480, 133), (488, 153), (480, 162), (472, 153)], fill=(24, 44, 65, 255))
d.line((372, 148, 426, 148), fill=(161, 138, 94, 180), width=1)
d.line((534, 148, 588, 148), fill=(161, 138, 94, 180), width=1)
save_layer("emblem", emblem)
title = text_layer("title", "星海远征", 480, 265, 64, (239, 225, 193, 255))
subtitle = text_layer("subtitle", "启航，探索未知星域", 480, 311, 20, (150, 174, 197, 255))

server_bg = blank()
d = ImageDraw.Draw(server_bg)
d.rounded_rectangle((340, 358, 620, 401), radius=7, fill=(20, 35, 52, 240), outline=(62, 83, 105, 255), width=1)
d.ellipse((366, 376, 373, 383), fill=(106, 199, 161, 255))
save_layer("server_bg", server_bg)
server_text = text_layer("server_text", "星港一区   ·   连接正常", 489, 386, 16, (178, 194, 208, 255))

button = blank()
d = ImageDraw.Draw(button)
d.rounded_rectangle((321, 429, 639, 495), radius=10, fill=(223, 190, 126, 255), outline=(246, 221, 167, 255), width=2)
d.line((340, 434, 620, 434), fill=(247, 225, 181, 200), width=1)
save_layer("button_bg", button)
button_text = text_layer("button_text", "开始远征", 480, 472, 25, (37, 38, 42, 255))
footer = text_layer("footer", "适度游戏，探索更多精彩", 480, 570, 14, (116, 137, 159, 255))

composite = blank()
for image in [background, stars, emblem, title, subtitle, server_bg, server_text, button, button_text, footer]:
    composite = Image.alpha_composite(composite, image)
composite.save(OUT / "preview.png")
(OUT / "composite.rgba").write_bytes(composite.tobytes())
(OUT / "assets.json").write_text(json.dumps(dict(width=W, height=H, layers=layers), ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(dict(width=W, height=H, rasterLayers=len(layers), output=str(OUT))))
