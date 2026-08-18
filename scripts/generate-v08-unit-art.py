from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math

OUT = Path("public/units")
OUT.mkdir(parents=True, exist_ok=True)


def glow_layer(size, circles, blur=20):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for bounds, fill in circles:
        draw.ellipse(bounds, fill=fill)
    return layer.filter(ImageFilter.GaussianBlur(blur))


def draw_frog(unit, palette, motif):
    size = 640
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    image = Image.alpha_composite(image, glow_layer((size, size), [((90, 100, 550, 560), palette["aura"]), ((180, 180, 460, 500), palette["aura2"])], 45))
    draw = ImageDraw.Draw(image)
    cx, cy = 320, 280
    draw.ellipse((135, 95, 505, 465), outline=palette["ring"], width=10)
    draw.ellipse((175, 135, 465, 425), outline=palette["ring2"], width=5)

    if motif == "runes":
        for angle in range(0, 360, 45):
            radius = 190
            x = cx + math.cos(math.radians(angle)) * radius
            y = cy + math.sin(math.radians(angle)) * radius
            draw.regular_polygon((x, y, 12), n_sides=4, rotation=angle / 2, outline=palette["ring"])
    elif motif == "clock":
        for angle in range(0, 360, 30):
            x1 = cx + math.cos(math.radians(angle)) * 165
            y1 = cy + math.sin(math.radians(angle)) * 165
            x2 = cx + math.cos(math.radians(angle)) * 185
            y2 = cy + math.sin(math.radians(angle)) * 185
            draw.line((x1, y1, x2, y2), fill=palette["ring"], width=6)
        draw.line((cx, cy, cx, 170), fill=palette["ring2"], width=8)
        draw.line((cx, cy, 405, 310), fill=palette["ring2"], width=8)
        draw.ellipse((305, 265, 335, 295), fill=palette["ring2"])
    else:
        for angle in (35, 145, 225, 315):
            radius = 180
            x = cx + math.cos(math.radians(angle)) * radius
            y = cy + math.sin(math.radians(angle)) * radius
            draw.ellipse((x - 12, y - 12, x + 12, y + 12), fill=palette["ring"])

    draw.polygon([(150, 565), (200, 375), (440, 375), (495, 565)], fill=palette["cloak"], outline=palette["cloak_edge"])
    draw.ellipse((190, 225, 450, 455), fill=palette["skin"], outline=palette["skin_edge"], width=8)
    draw.pieslice((160, 160, 480, 500), 190, 350, fill=palette["hood"], outline=palette["hood_edge"], width=12)
    draw.ellipse((190, 185, 285, 285), fill=palette["skin"], outline=palette["skin_edge"], width=7)
    draw.ellipse((355, 185, 450, 285), fill=palette["skin"], outline=palette["skin_edge"], width=7)
    for eye_x in (240, 400):
        draw.ellipse((eye_x - 28, 220, eye_x + 28, 278), fill=(244, 250, 230, 255))
        draw.ellipse((eye_x - 10, 237, eye_x + 10, 265), fill=palette["eye"])
        draw.ellipse((eye_x - 4, 242, eye_x + 4, 252), fill=(255, 255, 255, 230))
    draw.arc((245, 295, 395, 365), 15, 165, fill=palette["mouth"], width=8)
    draw.arc((210, 275, 270, 330), 90, 240, fill=palette["mark"], width=6)
    draw.arc((370, 275, 430, 330), -60, 90, fill=palette["mark"], width=6)
    draw.ellipse((180, 430, 260, 510), fill=palette["skin"], outline=palette["skin_edge"], width=6)
    draw.ellipse((380, 430, 460, 510), fill=palette["skin"], outline=palette["skin_edge"], width=6)

    if unit == "arcane-apprentice":
        draw.rounded_rectangle((245, 405, 395, 500), radius=12, fill=(68, 50, 90, 255), outline=palette["ring"], width=7)
        draw.line((320, 410, 320, 495), fill=palette["ring2"], width=5)
        draw.ellipse((278, 330, 362, 414), fill=(255, 255, 255, 80), outline=palette["ring"], width=8)
        draw.ellipse((295, 347, 345, 397), fill=palette["orb"])
    elif unit == "rune-blaster":
        draw.rounded_rectangle((392, 400, 560, 480), radius=22, fill=(45, 48, 60, 255), outline=palette["ring"], width=8)
        draw.ellipse((505, 407, 590, 493), fill=(20, 25, 32, 255), outline=palette["ring2"], width=8)
        draw.regular_polygon((548, 450, 31), n_sides=6, rotation=30, outline=palette["ring"], fill=palette["orb"])
        draw.line((430, 440, 520, 450), fill=palette["ring2"], width=8)
    else:
        draw.line((170, 500, 115, 170), fill=(106, 79, 42, 255), width=20)
        draw.ellipse((70, 110, 160, 200), fill=(20, 25, 40, 255), outline=palette["ring"], width=8)
        draw.ellipse((88, 128, 142, 182), outline=palette["ring2"], width=5)
        draw.line((115, 155, 115, 135), fill=palette["ring2"], width=5)
        draw.line((115, 155, 132, 165), fill=palette["ring2"], width=5)
        for x, y in ((480, 180), (520, 260), (485, 350)):
            draw.polygon([(x, y - 18), (x + 13, y), (x, y + 18), (x - 13, y)], fill=palette["ring"])

    image = Image.alpha_composite(image, glow_layer((size, size), [((150, 500, 500, 610), palette["aura"])], 28))
    draw = ImageDraw.Draw(image)
    draw.arc((145, 530, 500, 620), 200, 340, fill=palette["ring"], width=7)
    return image.resize((320, 320), Image.Resampling.LANCZOS)


PALETTES = {
    "arcane-apprentice": dict(aura=(80, 235, 194, 105), aura2=(164, 98, 255, 90), ring=(119, 245, 218, 220), ring2=(235, 205, 102, 235), cloak=(72, 47, 100, 255), cloak_edge=(162, 110, 220, 255), skin=(102, 206, 113, 255), skin_edge=(48, 122, 65, 255), hood=(83, 55, 120, 255), hood_edge=(194, 137, 255, 255), eye=(29, 73, 44, 255), mouth=(37, 95, 49, 255), mark=(224, 193, 89, 220), orb=(112, 247, 220, 240)),
    "rune-blaster": dict(aura=(61, 195, 255, 100), aura2=(241, 180, 57, 85), ring=(77, 215, 255, 230), ring2=(255, 205, 90, 240), cloak=(38, 66, 87, 255), cloak_edge=(75, 177, 224, 255), skin=(99, 203, 108, 255), skin_edge=(48, 122, 65, 255), hood=(39, 74, 99, 255), hood_edge=(89, 208, 255, 255), eye=(20, 65, 47, 255), mouth=(36, 88, 46, 255), mark=(255, 199, 70, 230), orb=(64, 208, 255, 220)),
    "chrono-mage": dict(aura=(133, 88, 240, 105), aura2=(71, 187, 255, 80), ring=(173, 133, 255, 230), ring2=(101, 220, 255, 240), cloak=(36, 33, 72, 255), cloak_edge=(126, 96, 210, 255), skin=(95, 191, 106, 255), skin_edge=(45, 111, 61, 255), hood=(42, 36, 88, 255), hood_edge=(158, 117, 242, 255), eye=(25, 57, 49, 255), mouth=(35, 80, 45, 255), mark=(105, 220, 255, 220), orb=(128, 97, 234, 220)),
}

MOTIFS = {"arcane-apprentice": "orb", "rune-blaster": "runes", "chrono-mage": "clock"}

for unit, palette in PALETTES.items():
    draw_frog(unit, palette, MOTIFS[unit]).save(OUT / f"{unit}.webp", "WEBP", quality=88, method=6)
