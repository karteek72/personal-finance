#!/usr/bin/env python3
"""Generate SpendFlow iOS app icon (1024x1024). Requires Pillow."""

from __future__ import annotations

import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: python3 -m pip install --user pillow", file=sys.stderr)
    sys.exit(1)

OUT = Path(__file__).resolve().parents[1] / "SpendFlow/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"

# Brand gradient stops (matches ui/src/styles/tokens.css)
PURPLE = (124, 58, 237)
VIOLET = (168, 85, 247)
PINK = (236, 72, 153)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_pixel(x: int, y: int, size: int) -> tuple[int, int, int]:
    t = (x / size * 0.55 + y / size * 0.45)
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        return lerp(PURPLE, VIOLET, t * 2)
    return lerp(VIOLET, PINK, (t - 0.5) * 2)


def draw_icon(size: int = 1024) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            px[x, y] = gradient_pixel(x, y, size)

    draw = ImageDraw.Draw(img)

    # Soft inner glow circle
    margin = int(size * 0.08)
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=None,
        outline=(255, 255, 255, 40),
        width=int(size * 0.012),
    )

    # Flow wave / "S" mark — three curved strokes
    cx, cy = size // 2, size // 2
    stroke = int(size * 0.055)
    white = (255, 255, 255)

    def wave_points(amplitude: float, phase: float, y_offset: float) -> list[tuple[int, int]]:
        points = []
        for i in range(101):
            t = i / 100
            x = cx + (t - 0.5) * size * 0.52
            y = cy + y_offset + math.sin(t * math.pi * 2 + phase) * amplitude
            points.append((int(x), int(y)))
        return points

    for amp, phase, yo in [(size * 0.11, 0.0, -size * 0.08), (size * 0.14, 1.2, 0), (size * 0.11, 2.4, size * 0.08)]:
        draw.line(wave_points(amp, phase, yo), fill=white, width=stroke, joint="curve")

    # Highlight dot (trendy accent)
    dot_r = int(size * 0.035)
    draw.ellipse(
        [cx + size * 0.18 - dot_r, cy - size * 0.22 - dot_r, cx + size * 0.18 + dot_r, cy - size * 0.22 + dot_r],
        fill=(255, 255, 255),
    )

    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    icon = draw_icon(1024)
    icon.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
