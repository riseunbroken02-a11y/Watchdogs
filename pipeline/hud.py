"""GTA VI-style HUD: perspective minimap, six wanted stars, money, hook text.

The minimap is a real ground-plane projection (pinhole camera pitched down over
the road network), not a skewed bitmap, so road widths taper with depth and the
whole thing is drawn as sharp vectors at 3x supersample.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---- layout (1080 x 1920 canvas) -------------------------------------------
CW, CH = 1080, 1920
MM_W, MM_H = 320, 250          # minimap tile: small, ~30% of frame width
MM_X, MM_Y = 46, CH - 250 - 118  # bottom-left, not flush to the edge
SS = 3                          # minimap supersample

# ---- ground-plane camera ----------------------------------------------------
PITCH = math.radians(58.0)
CAM_H = 150.0
CAM_D = 90.0
FOC = 175.0
V_BASE = 196.8                  # puts the player at ~0.79 * MM_H
Y_MIN = -60.0
Y_MAX = 820.0

# ---- palette ----------------------------------------------------------------
C_LAND = (44, 51, 60)
C_BLOCK = (63, 72, 83)
C_WATER = (26, 84, 112)
C_ROAD_MINOR = (146, 155, 164)
C_ROAD_MAJOR = (196, 205, 214)
C_ROUTE = (255, 42, 190)
C_ROUTE_GLOW = (255, 120, 214)
C_BLUE = (70, 140, 255)
C_RED = (255, 66, 66)
C_MONEY = (78, 224, 100)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _font(size):
    return ImageFont.truetype(FONT_BOLD, size)


# ---------------------------------------------------------------- projection --
def project(x, y, ss=SS):
    """Vehicle-frame ground point -> (tile_x, tile_y, depth_scale) or None."""
    f = y + CAM_D
    zc = f * math.cos(PITCH) + CAM_H * math.sin(PITCH)
    if zc < 6.0:
        return None
    yup = f * math.sin(PITCH) - CAM_H * math.cos(PITCH)
    k = FOC / zc
    u = k * x
    v = -k * yup
    return ((MM_W * 0.5 + u) * ss, (V_BASE + v) * ss, k)


def _clip_y(p0, p1, ymin=Y_MIN):
    """Clip a vehicle-frame segment to y >= ymin."""
    (x0, y0), (x1, y1) = p0, p1
    if y0 < ymin and y1 < ymin:
        return None
    if y0 < ymin:
        t = (ymin - y0) / (y1 - y0)
        x0, y0 = x0 + (x1 - x0) * t, ymin
    elif y1 < ymin:
        t = (ymin - y1) / (y0 - y1)
        x1, y1 = x1 + (x0 - x1) * t, ymin
    return (x0, y0), (x1, y1)


def _tapered(draw, p0, p1, world_w, color, ss=SS):
    """Draw a segment whose width shrinks with depth -> reads as 3D ground plane."""
    c = _clip_y(p0, p1)
    if c is None:
        return
    a = project(*c[0], ss=ss)
    b = project(*c[1], ss=ss)
    if a is None or b is None:
        return
    ax, ay, ka = a
    bx, by, kb = b
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    if L < 0.4:
        return
    nx, ny = -dy / L, dx / L
    wa = max(world_w * 0.5 * ka * ss, 0.55)
    wb = max(world_w * 0.5 * kb * ss, 0.55)
    draw.polygon([(ax + nx * wa, ay + ny * wa), (bx + nx * wb, by + ny * wb),
                  (bx - nx * wb, by - ny * wb), (ax - nx * wa, ay - ny * wa)],
                 fill=color)


def _to_vehicle(p, pos, hdg):
    """World -> vehicle frame (x right, y forward)."""
    dx, dy = p[0] - pos[0], p[1] - pos[1]
    c, s = math.cos(-hdg + math.pi / 2), math.sin(-hdg + math.pi / 2)
    return (dx * c - dy * s, dx * s + dy * c)


# ------------------------------------------------------------------ minimap ---
def render_minimap(city, pos, hdg, t, alpha=0.78):
    """One minimap frame as a small sharp RGBA tile (MM_W x MM_H)."""
    ss = SS
    W, H = MM_W * ss, MM_H * ss
    tile = Image.new("RGBA", (W, H), C_LAND + (255,))
    d = ImageDraw.Draw(tile, "RGBA")

    # water
    from .citymap import BAY
    poly = []
    for p in BAY:
        v = _to_vehicle(p, pos, hdg)
        if v[1] < Y_MIN:
            v = (v[0], Y_MIN)
        pr = project(*v, ss=ss)
        if pr:
            poly.append((pr[0], pr[1]))
    if len(poly) >= 3:
        d.polygon(poly, fill=C_WATER + (255,))

    # city blocks (under the roads) -> depth + texture
    for (b0, b1, shade) in city.blocks:
        corners = [(b0[0], b0[1]), (b1[0], b0[1]), (b1[0], b1[1]), (b0[0], b1[1])]
        vs = [_to_vehicle(c, pos, hdg) for c in corners]
        if max(v[1] for v in vs) < Y_MIN or min(v[1] for v in vs) > Y_MAX:
            continue
        prs = [project(*v, ss=ss) for v in vs]
        if any(pr is None for pr in prs):
            continue
        col = tuple(min(int(c * shade), 255) for c in C_BLOCK)
        d.polygon([(pr[0], pr[1]) for pr in prs], fill=col + (255,))

    # roads (far first so near overlaps cleanly)
    segs = []
    for (p1, p2, cls) in city.segments:
        v1 = _to_vehicle(p1, pos, hdg)
        v2 = _to_vehicle(p2, pos, hdg)
        if max(v1[1], v2[1]) < Y_MIN or min(v1[1], v2[1]) > Y_MAX:
            continue
        if min(abs(v1[0]), abs(v2[0])) > 900:
            continue
        segs.append((max(v1[1], v2[1]), v1, v2, cls))
    segs.sort(key=lambda s: -s[0])
    for _, v1, v2, cls in segs:
        w = 15.0 if cls else 9.5
        col = C_ROAD_MAJOR if cls else C_ROAD_MINOR
        _tapered(d, v1, v2, w, col + (255,), ss)

    # pink route: glow pass then core, along real road centrelines
    rp = city.route_poly
    for (world_w, col) in ((17.0, C_ROUTE_GLOW + (110,)), (9.0, C_ROUTE + (255,))):
        for k in range(1, len(rp)):
            v1 = _to_vehicle(rp[k - 1], pos, hdg)
            v2 = _to_vehicle(rp[k], pos, hdg)
            if max(v1[1], v2[1]) < Y_MIN or min(v1[1], v2[1]) > Y_MAX:
                continue
            _tapered(d, v1, v2, world_w, col, ss)

    # waypoint
    wv = _to_vehicle(city.waypoint, pos, hdg)
    if Y_MIN < wv[1] < Y_MAX:
        pr = project(*wv, ss=ss)
        if pr:
            _waypoint(d, pr[0], pr[1], max(pr[2], 0.35) * ss)

    # POIs
    for poi in city.pois:
        pv = _to_vehicle(poi["pos"], pos, hdg)
        if not (Y_MIN < pv[1] < Y_MAX * 0.8):
            continue
        pr = project(*pv, ss=ss)
        if pr:
            _poi(d, poi["kind"], pr[0], pr[1], pr[2], ss)

    # police markers, blue/red alternating flash
    for i, ag in enumerate(city.police):
        av = _to_vehicle(ag.pos(), pos, hdg)
        if not (Y_MIN < av[1] < Y_MAX * 0.85):
            continue
        pr = project(*av, ss=ss)
        if pr is None:
            continue
        ph = (t * 3.4 + ag.phase * 6.283)
        col = C_BLUE if math.sin(ph) >= 0 else C_RED
        r = min(max(4.0 * math.sqrt(max(pr[2], 0.05)), 2.9), 5.2) * ss
        d.ellipse([pr[0] - r * 2.1, pr[1] - r * 2.1, pr[0] + r * 2.1, pr[1] + r * 2.1],
                  fill=col + (85,))
        d.ellipse([pr[0] - r, pr[1] - r, pr[0] + r, pr[1] + r],
                  fill=col + (255,), outline=(12, 14, 18, 210), width=max(int(ss * 0.4), 1))

    # exactly one player icon, at the projected vehicle origin => on the route
    pv = project(0.0, 0.0, ss=ss)
    if pv:
        _player(d, pv[0], pv[1], ss)

    _compass(d, hdg, ss)

    # horizon fade so the far edge dissolves instead of cutting off
    fade = Image.new("L", (1, H))
    for yy in range(H):
        u = yy / float(H)
        fade.putpixel((0, yy), int(255 * min(1.0, max(0.0, (u - 0.02) / 0.22)) ** 0.85))
    fade = fade.resize((W, H))
    a = tile.getchannel("A")
    tile.putalpha(Image.fromarray(
        (np.asarray(a, np.float32) * (np.asarray(fade, np.float32) / 255.0)).astype(np.uint8)))

    tile = tile.resize((MM_W, MM_H), Image.LANCZOS)
    return _frame_tile(tile, alpha)


def _player(d, x, y, ss):
    s = 9.2 * ss
    pts = [(x, y - s * 1.18), (x + s * 0.80, y + s * 0.86),
           (x, y + s * 0.40), (x - s * 0.80, y + s * 0.86)]
    d.polygon(pts, fill=(18, 20, 26, 235))
    k = 0.74
    pts2 = [(x, y - s * 1.18 * k), (x + s * 0.80 * k, y + s * 0.86 * k),
            (x, y + s * 0.40 * k), (x - s * 0.80 * k, y + s * 0.86 * k)]
    d.polygon(pts2, fill=(255, 255, 255, 255))


def _waypoint(d, x, y, k):
    r = max(4.6 * k, 3.0)
    d.ellipse([x - r * 1.9, y - r * 1.9, x + r * 1.9, y + r * 1.9], fill=C_ROUTE + (80,))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255),
              outline=C_ROUTE + (255,), width=max(int(r * 0.5), 1))
    d.ellipse([x - r * 0.40, y - r * 0.40, x + r * 0.40, y + r * 0.40], fill=C_ROUTE + (255,))


def _poi(d, kind, x, y, kp, ss):
    r = min(max(8.6 * math.sqrt(max(kp, 0.05)), 6.2), 11.0) * ss
    bg = {"burger": (250, 176, 54), "gym": (232, 238, 246), "gun": (232, 238, 246),
          "gas": (86, 170, 250), "police": (70, 140, 255)}[kind]
    d.rounded_rectangle([x - r, y - r, x + r, y + r], radius=r * 0.34,
                        fill=bg + (238,), outline=(14, 16, 22, 220),
                        width=max(int(r * 0.16), 1))
    ink = (22, 24, 30, 255)
    u = r * 0.60
    if kind == "burger":
        d.rounded_rectangle([x - u, y - u * 0.72, x + u, y - u * 0.16], radius=u * 0.5, fill=ink)
        d.rectangle([x - u, y - u * 0.06, x + u, y + u * 0.26], fill=(206, 92, 40, 255))
        d.rounded_rectangle([x - u, y + u * 0.34, x + u, y + u * 0.80], radius=u * 0.4, fill=ink)
    elif kind == "gym":
        d.rectangle([x - u * 0.86, y - u * 0.20, x + u * 0.86, y + u * 0.20], fill=ink)
        for sx in (-1, 1):
            d.rounded_rectangle([x + sx * u * 0.86 - u * 0.30, y - u * 0.68,
                                 x + sx * u * 0.86 + u * 0.30, y + u * 0.68],
                                radius=u * 0.2, fill=ink)
    elif kind == "gun":
        d.rectangle([x - u * 0.92, y - u * 0.46, x + u * 0.62, y - u * 0.02], fill=ink)
        d.rectangle([x - u * 0.52, y - u * 0.02, x - u * 0.06, y + u * 0.74], fill=ink)
    elif kind == "gas":
        d.rounded_rectangle([x - u * 0.56, y - u * 0.74, x + u * 0.34, y + u * 0.74],
                            radius=u * 0.22, fill=ink)
        d.rectangle([x + u * 0.40, y - u * 0.30, x + u * 0.82, y - u * 0.06], fill=ink)
    else:  # police shield
        d.polygon([(x, y - u * 0.86), (x + u * 0.74, y - u * 0.34),
                   (x + u * 0.44, y + u * 0.80), (x - u * 0.44, y + u * 0.80),
                   (x - u * 0.74, y - u * 0.34)], fill=(252, 254, 255, 255))
        d.ellipse([x - u * 0.26, y - u * 0.30, x + u * 0.26, y + u * 0.22], fill=(40, 92, 200, 255))


def _compass(d, hdg, ss):
    """Small N marker showing where north went as the map rotates."""
    cx, cy = 20.0 * ss, 222.0 * ss
    r = 9.0 * ss
    ang = -hdg + math.pi / 2
    a = ang - math.pi / 2
    tipx, tipy = cx + math.cos(a) * r, cy + math.sin(a) * r
    d.line([cx - math.cos(a) * r * 0.5, cy - math.sin(a) * r * 0.5, tipx, tipy],
           fill=(236, 242, 250, 200), width=max(int(ss * 0.7), 1))
    d.ellipse([tipx - ss * 1.2, tipy - ss * 1.2, tipx + ss * 1.2, tipy + ss * 1.2],
              fill=(255, 255, 255, 235))
    f = _font(int(8.2 * ss))
    d.text((cx - r * 1.75, cy - r * 0.62), "N", font=f, fill=(255, 255, 255, 210),
           stroke_width=1, stroke_fill=(0, 0, 0, 150))


def _frame_tile(tile, alpha):
    """Rounded-rect mask + subtle border + overall transparency."""
    W, H = tile.size
    m = Image.new("L", (W * 4, H * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, W * 4 - 1, H * 4 - 1], radius=int(W * 4 * 0.052), fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    a = tile.getchannel("A").point(lambda v: int(v * alpha))
    out = tile.copy()
    out.putalpha(Image.composite(a, Image.new("L", (W, H), 0), m))
    bd = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    db = ImageDraw.Draw(bd)
    db.rounded_rectangle([0, 0, W - 1, H - 1], radius=int(W * 0.052),
                         outline=(226, 232, 240, 120), width=2)
    db.rounded_rectangle([1, 1, W - 2, H - 2], radius=int(W * 0.052),
                         outline=(10, 12, 16, 90), width=1)
    return Image.alpha_composite(out, bd)


# --------------------------------------------------- stars / money / hook ----
def _star(d, cx, cy, r, fill, outline=None, w=0):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.407
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=fill)
    if outline and w:
        d.line(pts + [pts[0]], fill=outline, width=w, joint="curve")


def render_stars_money(n_stars=6, money="$475,000"):
    """Six sharp white stars + green money, no panel / box / blur behind either."""
    ss = 2
    W, H = 420 * ss, 190 * ss
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    r = 23.0 * ss
    gap = 2.2 * ss
    step = r * 2 + gap
    total = step * n_stars - gap
    x0 = W - total - 6 * ss
    cy = 6 * ss + r
    for i in range(n_stars):
        cx = x0 + r + i * step
        _star(d, cx, cy, r, (255, 255, 255, 255), (26, 30, 38, 170), max(int(ss * 1.1), 1))
    f = _font(int(54 * ss))
    bb = d.textbbox((0, 0), money, font=f)
    tw = bb[2] - bb[0]
    tx = W - tw - 8 * ss - bb[0]
    ty = cy + r + 12 * ss
    d.text((tx, ty), money, font=f, fill=C_MONEY + (255,),
           stroke_width=max(int(ss * 1.6), 1), stroke_fill=(8, 30, 14, 205))
    return img.resize((W // ss, H // ss), Image.LANCZOS)


def _skull(d, x, y, s, col=(255, 255, 255, 255), ink=(20, 22, 28, 255)):
    """Vector 💀 — no colour-emoji font in this image, so draw it."""
    d.rounded_rectangle([x, y, x + s, y + s * 0.80], radius=s * 0.34, fill=col)
    d.rounded_rectangle([x + s * 0.24, y + s * 0.70, x + s * 0.76, y + s * 1.02],
                        radius=s * 0.14, fill=col)
    er = s * 0.175
    for ex in (x + s * 0.30, x + s * 0.70):
        d.ellipse([ex - er, y + s * 0.30 - er, ex + er, y + s * 0.30 + er], fill=ink)
    d.polygon([(x + s * 0.50, y + s * 0.46), (x + s * 0.585, y + s * 0.60),
               (x + s * 0.415, y + s * 0.60)], fill=ink)
    for i in range(3):
        tx = x + s * (0.36 + i * 0.14)
        d.line([tx, y + s * 0.74, tx, y + s * 0.98], fill=ink, width=max(int(s * 0.05), 1))


def render_hook(text="POV: 6 STARS IN GTA 6", skull=True, max_w=960):
    """Hook tile, auto-fitted so the WHOLE sentence fits — 'POV' never clipped."""
    ss = 2
    size = 76
    while size > 30:
        f = _font(size * ss)
        probe = Image.new("RGBA", (10, 10))
        bb = ImageDraw.Draw(probe).textbbox((0, 0), text, font=f)
        tw = (bb[2] - bb[0]) / ss
        sw = size * 0.92 if skull else 0.0
        if tw + (sw + size * 0.26 if skull else 0) + 28 <= max_w:
            break
        size -= 2
    f = _font(size * ss)
    probe = Image.new("RGBA", (10, 10))
    bb = ImageDraw.Draw(probe).textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    sk = size * 0.92 * ss if skull else 0.0
    pad = int(14 * ss)
    W = int(tw + sk + (size * 0.26 * ss if skull else 0)) + pad * 2
    H = int(max(th, sk * 1.05)) + pad * 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    ty = pad - bb[1] + (H - pad * 2 - th) / 2
    d.text((pad - bb[0], ty), text, font=f, fill=(255, 255, 255, 255),
           stroke_width=max(int(ss * 3.0), 2), stroke_fill=(6, 8, 12, 225))
    if skull:
        sx = pad - bb[0] + tw + size * 0.26 * ss
        sy = pad + (H - pad * 2 - sk * 1.02) / 2
        _skull(d, sx, sy, sk)
    return img.resize((W // ss, H // ss), Image.LANCZOS)
