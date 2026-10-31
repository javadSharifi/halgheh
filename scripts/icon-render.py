#!/usr/bin/env python3
"""Renders every icon the app ships from assets/logo-source.jpeg.

The source artwork is a deep-blue knot on light paper. A launcher slot is 48 px, so the
knot is lifted out of the JPEG (alpha from how blue each pixel is, soft-thresholded) and
re-composed on flat fills instead of shipping the grey-ish photo square.

Styles
  gradient (default)      white knot on the app's primary blue gradient: maximum contrast at
                          small sizes and it matches --primary, the splash and the About tile
  paper  (--style paper)  the knot in its own colours on the app's lavender paper

Writes: public/*, android/app/src/main/res/**, src/assets/app-icon.png and
assets/icon-preview.png (contact sheet for review).

Run: python3 scripts/icon-render.py [--style gradient|paper]
"""
from __future__ import annotations

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/logo-source.jpeg')
PUB = os.path.join(ROOT, 'public')
RES = os.path.join(ROOT, 'android/app/src/main/res')
SRC_ASSETS = os.path.join(ROOT, 'src/assets')
ASSETS = os.path.join(ROOT, 'assets')

SS = 4  # supersampling for every composite

# brand colours, straight from src/style.css --primary / --bg
BLUE_HI, BLUE, BLUE_LO = (0x75, 0x91, 0xFF), (0x44, 0x66, 0xE6), (0x36, 0x51, 0xC9)
PAPER_HI, PAPER_LO = (0xF9, 0xF8, 0xFD), (0xE8, 0xE6, 0xF5)
PAPER = np.array([0.94, 0.94, 0.93], np.float32)  # the JPEG's own background, for edge un-mixing

MARK_SCALE = 0.58            # mark width as a share of the icon tile, for every non-adaptive icon
ADAPTIVE_SCALE = MARK_SCALE * 72 / 108  # adaptive foregrounds only show 72 dp of their 108 dp canvas


def smoothstep(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def load_mark() -> np.ndarray:
    """RGBA float32 (0..1) of the knot, squared and tightly cropped."""
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
    blueness = a[..., 2] - (a[..., 0] + a[..., 1]) / 2
    alpha = smoothstep(blueness, 12.0, 34.0)

    ys, xs = np.nonzero(alpha > 0.04)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(max(x1 - x0, y1 - y0) * 1.03)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    x0, y0 = cx - side // 2, cy - side // 2

    rgb = np.clip(a[y0:y0 + side, x0:x0 + side] / 255.0, 0, 1)
    al = np.clip(alpha[y0:y0 + side, x0:x0 + side], 0, 1)

    # un-mix the paper out of the feathered edge: seen = al*C + (1-al)*paper
    with np.errstate(divide='ignore', invalid='ignore'):
        pure = (rgb - (1 - al)[..., None] * PAPER) / np.maximum(al[..., None], 1e-3)
    rgb = np.where((al > 0.02)[..., None], np.clip(pure, 0, 1), rgb)
    return np.dstack([rgb, al]).astype(np.float32)


def gradient_bg(n: int) -> np.ndarray:
    """Diagonal three-stop brand gradient with a soft top-left highlight."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    t = np.clip((xx + yy) / (2 * (n - 1)), 0, 1)[..., None]
    c1 = np.array(BLUE_HI, np.float32) / 255.0
    c2 = np.array(BLUE, np.float32) / 255.0
    c3 = np.array(BLUE_LO, np.float32) / 255.0
    t2 = t * 2
    out = np.where(t2 <= 1, c1 + (c2 - c1) * t2, c2 + (c3 - c2) * np.clip(t2 - 1, 0, 1))
    d = np.hypot(xx - n * 0.28, yy - n * 0.22) / (n * 0.85)
    out = out + (0.09 * np.clip(1 - d, 0, 1) ** 2)[..., None]
    return np.clip(out, 0, 1).astype(np.float32)


def paper_bg(n: int) -> np.ndarray:
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    t = np.clip(np.hypot(xx - n * 0.35, yy - n * 0.3) / (n * 0.95), 0, 1)[..., None]
    c1 = np.array(PAPER_HI, np.float32) / 255.0
    c2 = np.array(PAPER_LO, np.float32) / 255.0
    return np.clip(c1 * (1 - t) + c2 * t, 0, 1).astype(np.float32)


def resample(mark: np.ndarray, px: int) -> np.ndarray:
    im = Image.fromarray(np.clip(mark * 255, 0, 255).astype('uint8'), 'RGBA')
    return np.asarray(im.resize((px, px), Image.LANCZOS)).astype(np.float32) / 255.0


def placed_alpha(mark: np.ndarray, n: int, scale: float) -> np.ndarray:
    """Alpha of the mark scaled to `scale` of an n×n tile and centred in it."""
    side = max(1, int(round(n * scale)))
    a = resample(mark, side)[..., 3]
    out = np.zeros((n, n), np.float32)
    off = (n - side) // 2
    out[off:off + side, off:off + side] = a
    return out


def shape_mask(n: int, kind: str, radius: float = 0.222) -> np.ndarray:
    """Anti-aliased alpha for 'full', 'rounded' (radius as a fraction of n) or 'circle'."""
    m = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(m)
    if kind == 'full':
        d.rectangle([0, 0, n, n], fill=255)
    elif kind == 'circle':
        d.ellipse([0, 0, n - 1, n - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * radius), fill=255)
    return np.asarray(m).astype(np.float32) / 255.0


def compose(n: int, mark: np.ndarray, style: str, shape: str = 'rounded', scale: float = MARK_SCALE) -> Image.Image:
    """Icon at n×n: background + centred mark, masked to `shape`."""
    big = n * SS
    bg = gradient_bg(big) if style == 'gradient' else paper_bg(big)
    side = max(1, int(round(big * scale)))
    mk = resample(mark, side)
    alpha = np.clip(mk[..., 3] ** (0.90 if style == 'gradient' else 0.96), 0, 1)[..., None]

    if style == 'gradient':
        # white knot with a slight top-to-bottom shade so it does not read as a flat stencil
        shade = np.linspace(1.0, 0.93, side, dtype=np.float32)[:, None, None]
        ink = np.ones((side, side, 3), np.float32) * shade
    else:
        ink = mk[..., :3]

    off = (big - side) // 2
    dst = bg[off:off + side, off:off + side]
    dst[:] = dst * (1 - alpha) + ink * alpha

    rgba = np.dstack([bg, shape_mask(big, shape)])
    img = Image.fromarray(np.clip(rgba * 255, 0, 255).astype('uint8'), 'RGBA')
    return img.resize((n, n), Image.LANCZOS)


def mark_layer(n: int, mark: np.ndarray, scale: float, colour=(1.0, 1.0, 1.0)) -> Image.Image:
    """Transparent layer holding only the mark, for Android adaptive foregrounds."""
    a = placed_alpha(mark, n, scale)
    rgb = np.zeros((n, n, 3), np.float32)
    rgb[:] = np.array(colour, np.float32)
    arr = np.dstack([rgb, a])
    return Image.fromarray(np.clip(arr * 255, 0, 255).astype('uint8'), 'RGBA')


def save(img: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def preview(mark: np.ndarray) -> None:
    """Contact sheet: both styles at three sizes, light and dark strip, plus mask geometry."""
    sizes = (192, 96, 48)
    pad, gap = 22, 18
    cell = pad * 2 + 192 + 96 + gap * 2
    sheet = Image.new('RGB', (cell * 2 + pad, 640), (0xF4, 0xF3, 0xF9))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=15)
        small = ImageFont.load_default(size=12)
    except TypeError:
        font = small = ImageFont.load_default()

    for i, style in enumerate(('gradient (default)', 'paper')):
        d.text((i * cell + pad, 12), style, fill=(29, 31, 51), font=font)

    y = 42
    for strip, bg in (('light', (0xF4, 0xF3, 0xF9)), ('dark', (0x12, 0x14, 0x20))):
        d.rectangle([0, y, sheet.width, y + 272], fill=bg)
        d.text((pad, y + 8), strip, fill=(0x8D, 0x92, 0xB0) if strip == 'light' else (0x9A, 0x9F, 0xBB), font=small)
        for i, style in enumerate(('gradient', 'paper')):
            x = i * cell + pad
            for n in sizes:
                tile = compose(n, mark, style, 'rounded', 0.58 if n > 60 else 0.62)
                sheet.paste(tile, (x, y + 64 - n // 4), tile)
                d.text((x, y + 236), f'{n}px', fill=(0x8D, 0x92, 0xB0) if strip == 'light' else (0x9A, 0x9F, 0xBB), font=small)
                x += n + gap
        y += 272

    d.text((pad, y + 14), 'maskable / adaptive: mark kept inside the 80% safe circle', fill=(29, 31, 51), font=font)
    c1 = compose(200, mark, 'gradient', 'circle', 0.46)
    sheet.paste(c1, (pad, y + 44), c1)
    c2 = mark_layer(200, mark, 0.58)
    sheet.paste(c2, (pad + 230, y + 44), c2)
    d.text((pad + 230, y + 250), 'adaptive foreground (mark only)', fill=(0x5A, 0x5E, 0x78), font=small)
    save(sheet, os.path.join(ASSETS, 'icon-preview.png'))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--style', choices=['gradient', 'paper'], default='gradient')
    args = ap.parse_args()
    style = args.style

    mark = load_mark()
    Image.fromarray(np.clip(mark * 255, 0, 255).astype('uint8'), 'RGBA').save(
        os.path.join(ASSETS, 'logo-mark.png'), optimize=True)

    # ---- web / PWA ----
    save(compose(192, mark, style, 'rounded'), os.path.join(PUB, 'icon-192.png'))
    save(compose(512, mark, style, 'rounded'), os.path.join(PUB, 'icon-512.png'))
    save(compose(512, mark, style, 'full', MARK_SCALE), os.path.join(PUB, 'icon-maskable-512.png'))
    save(compose(180, mark, style, 'full', MARK_SCALE), os.path.join(PUB, 'apple-touch-icon.png'))
    save(compose(64, mark, style, 'rounded'), os.path.join(PUB, 'favicon.png'))
    # in-app logo for the About card, imported by the bundler
    save(compose(256, mark, style, 'rounded', MARK_SCALE), os.path.join(SRC_ASSETS, 'app-icon.png'))

    # ---- android: legacy launcher icons ----
    for bucket, n in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        save(compose(n, mark, style, 'rounded', MARK_SCALE), os.path.join(RES, f'mipmap-{bucket}/ic_launcher.png'))
        save(compose(n, mark, style, 'circle', MARK_SCALE), os.path.join(RES, f'mipmap-{bucket}/ic_launcher_round.png'))
        # adaptive foreground canvas is 108 dp (2.25x the 48 dp icon) but only 72 dp shows,
        # so the mark is scaled by 72/108 to look the same size as the legacy icon
        save(mark_layer(round(n * 2.25), mark, ADAPTIVE_SCALE), os.path.join(RES, f'mipmap-{bucket}/ic_launcher_foreground.png'))

    # ---- android: adaptive layers, 108 dp at the usual densities ----
    nodpi = os.path.join(RES, 'drawable-nodpi')
    save(mark_layer(648, mark, ADAPTIVE_SCALE), os.path.join(nodpi, 'ic_launcher_fg.png'))
    save(mark_layer(648, mark, ADAPTIVE_SCALE, (0, 0, 0)), os.path.join(nodpi, 'ic_launcher_mono.png'))
    save(Image.fromarray(np.clip(gradient_bg(648) * 255, 0, 255).astype('uint8'), 'RGB'),
         os.path.join(nodpi, 'ic_launcher_bg.png'))
    # Android 12+ splash icon: 960 canvas, mark inside the 2/3 circle the system masks to
    save(compose(960, mark, 'gradient', 'circle', 0.40), os.path.join(nodpi, 'splash_icon.png'))

    preview(mark)
    cov = float((np.asarray(resample(mark, 48))[..., 3] > 0.5).mean())
    print(f'icons written (style={style}); mark ink at 48 px = {cov * 100:.1f}% of the tile')
    return 0


if __name__ == '__main__':
    sys.exit(main())
