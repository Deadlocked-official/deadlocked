"""Draw the site's sharing image (og.png, 1200x630) and phone icon (apple-touch-icon.png, 180x180).

Usage: python tools/make_images.py <site_dir>   (needs Pillow; uses Windows fonts if present, else Pillow's default)
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

INK, PANEL, RULE, BRASS, TEXT, MUTED = "#0e1513", "#151e1b", "#2b3934", "#c9a45c", "#e8e3d3", "#95a39b"
TIERS = ["#c2473a", "#cf7a38", "#c9a45c", "#7f9a65", "#4f8a84", "#64748b"]


def font(names, size):
    for n in names:
        for d in ("C:/Windows/Fonts", "/usr/share/fonts/truetype/dejavu"):
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def og(site):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 300], fill=PANEL)
    d.line([0, 300, W, 300], fill=RULE, width=2)
    big = font(["impact.ttf", "DejaVuSans-Bold.ttf"], 168)
    mid = font(["bahnschrift.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"], 44)
    small = font(["consola.ttf", "DejaVuSansMono.ttf"], 26)
    d.text((72, 64), "DEADLOCK FAN SITE  ·  UPDATED EVERY WEEK", font=small, fill=BRASS)
    d.text((66, 100), "DEADLOCKED", font=big, fill=TEXT)
    d.line([72, 340, 1128, 340], fill=BRASS, width=3)
    lines = ["Builds for every hero, with the reason for each item",
             "Hero guides · Live meta · Counters · Lane duos",
             "Draft helper · Player lookup · Aim drills"]
    for i, t in enumerate(lines):
        d.text((72, 372 + i * 62), t, font=mid, fill=TEXT if i == 0 else MUTED)
    x = 72
    for i, (letter, c) in enumerate(zip("SABCDF", TIERS)):
        d.rectangle([x, 566, x + 44, 604], fill=c)
        d.text((x + 13, 568), letter, font=font(["impact.ttf", "DejaVuSans-Bold.ttf"], 32), fill="#ffffff")
        x += 52
    d.text((x + 20, 574), "deadlocked-official.github.io", font=small, fill=MUTED)
    im.save(os.path.join(site, "og.png"), optimize=True)


def touch(site):
    S = 180
    im = Image.new("RGB", (S, S), INK)
    d = ImageDraw.Draw(im)
    d.rectangle([10, 10, S - 11, S - 11], outline=BRASS, width=6)
    f = font(["impact.ttf", "DejaVuSans-Bold.ttf"], 128)
    box = d.textbbox((0, 0), "D", font=f)
    d.text(((S - (box[2] - box[0])) / 2 - box[0], (S - (box[3] - box[1])) / 2 - box[1]), "D", font=f, fill=BRASS)
    im.save(os.path.join(site, "apple-touch-icon.png"), optimize=True)


if __name__ == "__main__":
    og(sys.argv[1]); touch(sys.argv[1])
    print("og.png and apple-touch-icon.png written")
