"""Render the portrait sample's image parts and PSD text caches, without PSD IO."""
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
DESIGN = json.loads((ROOT / "design.json").read_text(encoding="utf-8"))
W, H = DESIGN["width"], DESIGN["height"]
FONT = "C:/Windows/Fonts/msyh.ttc"
SCALE = 3
nodes = {n["key"]: n for n in DESIGN["nodes"]}
assets = {}
composite = Image.new("RGBA", (W, H), DESIGN["background"])


def position(node):
    f = node["frame"]
    px, py = position(nodes[node["parent"]]) if "parent" in node else (0, 0)
    return px + f["x"], py + f["y"]


def draw_art(key, w, h):
    if key == "deep_space":
        image = Image.new("RGBA", (w, h))
        image.putdata([
            tuple(int(a + b * math.exp(-(((x - w / 2) / 340) ** 2 + ((y - 460) / 500) ** 2)))
                  for a, b in [(9, 12), (17, 27), (32, 44)]) + (255,)
            for y in range(h) for x in range(w)
        ])
        return image
    image = Image.new("RGBA", (w * SCALE, h * SCALE))
    d = ImageDraw.Draw(image)

    def box(values):
        return tuple(round(v * SCALE) for v in values)

    if key == "stars":
        rng = random.Random(20261116)
        for _ in range(170):
            x, y = rng.randrange(24, w - 24), rng.randrange(32, h - 32)
            if (170 < x < 580 and 250 < y < 600) or (120 < x < 630 and 830 < y < 1100):
                continue
            radius = rng.choice([0.6, 0.8, 0.8, 1.2])
            d.ellipse(box((x, y, x + radius, y + radius)), fill=(155, 191, 224, rng.randrange(65, 160)))
        d.arc(box((-2, 160, 752, 1040)), 190, 345, fill=(71, 100, 132, 120), width=SCALE)
        d.arc(box((34, 200, 716, 1000)), 195, 340, fill=(71, 100, 132, 80), width=SCALE)
    elif key == "emblem":
        d.ellipse(box((70, 1, 146, 77)), outline=(202, 172, 111, 210), width=SCALE)
        d.polygon([box(p) for p in [(108, 10), (127, 44), (108, 66), (89, 44)]], fill=(224, 192, 129, 255))
        d.polygon([box(p) for p in [(108, 24), (116, 44), (108, 53), (100, 44)]], fill=(24, 44, 65, 255))
        d.line(box((0, 39, 54, 39)), fill=(161, 138, 94, 180), width=SCALE)
        d.line(box((162, 39, 215, 39)), fill=(161, 138, 94, 180), width=SCALE)
    elif key == "server_bg":
        d.rounded_rectangle(box((0.5, 0.5, w - 0.5, h - 0.5)), radius=9 * SCALE,
                            fill=(20, 35, 52, 240), outline=(62, 83, 105, 255), width=SCALE)
    elif key == "status_dot":
        d.ellipse(box((0.5, 0.5, w - 0.5, h - 0.5)), fill=(106, 199, 161, 255))
    elif key == "button_bg":
        d.rounded_rectangle(box((1, 1, w - 1, h - 1)), radius=13 * SCALE,
                            fill=(223, 190, 126, 255), outline=(246, 221, 167, 255), width=2 * SCALE)
        d.line(box((22, 7, w - 22, 7)), fill=(247, 225, 181, 200), width=SCALE)
    else:
        raise ValueError(key)
    return image.resize((w, h), Image.Resampling.LANCZOS)


for node in DESIGN["nodes"]:
    kind, key, frame = node["type"], node["key"], node["frame"]
    if kind not in ("image", "text"):
        continue
    x, y = position(node)
    w, h = frame["width"], frame["height"]
    text = None
    if kind == "image":
        image = draw_art(key, w, h)
    else:
        image = Image.new("RGBA", (w * SCALE, h * SCALE))
        font = ImageFont.truetype(FONT, node["fontSize"] * SCALE)
        draw = ImageDraw.Draw(image)
        # CSS centers the line box including ascender/descender metrics, not just visible glyphs.
        ascent, descent = font.getmetrics()
        baseline = (h * SCALE - ascent - descent) / 2 + ascent
        tx = (w * SCALE - draw.textlength(node["text"], font=font)) / 2
        draw.text((tx, baseline), node["text"], font=font, anchor="ls", fill=node["color"])
        image = image.resize((w, h), Image.Resampling.LANCZOS)
        color = tuple(int(node["color"][i:i + 2], 16) for i in (1, 3, 5))
        text = dict(text=node["text"], transform=[1, 0, 0, 1, x + tx / SCALE, y + baseline / SCALE],
                    style=dict(font=dict(name="MicrosoftYaHei"), fontSize=node["fontSize"],
                               fillColor=dict(zip(("r", "g", "b"), color))))
    image.save(OUT / f"{key}.png")
    (OUT / f"{key}.rgba").write_bytes(image.tobytes())
    assets[key] = dict(left=x, top=y, width=w, height=h, **({"text": text} if text else {}))
    composite.alpha_composite(image, (x, y))

composite.save(OUT / "artwork-preview.png")
(OUT / "composite.rgba").write_bytes(composite.tobytes())
(OUT / "assets.json").write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(dict(width=W, height=H, imageParts=6, textCaches=5, output=str(OUT))))
