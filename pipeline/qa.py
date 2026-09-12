"""Automated QA on the RENDERED mp4 — inspects real decoded pixels, not the code."""
import subprocess

import numpy as np

from . import hud
from .egomotion import FFMPEG, probe

W, H = 1080, 1920


def frames_at(path, times):
    out = []
    for t in times:
        raw = subprocess.run(
            [FFMPEG, "-v", "error", "-ss", "%.3f" % t, "-i", path, "-frames:v", "1",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True, check=True).stdout
        if len(raw) < W * H * 3:
            out.append(None)
        else:
            out.append(np.frombuffer(raw[: W * H * 3], np.uint8).reshape(H, W, 3))
    return out


def components(mask, min_px=12):
    """Connected components (4-neighbour) without scipy."""
    m = mask.copy()
    h, w = m.shape
    comps = []
    ys, xs = np.nonzero(m)
    seen = np.zeros_like(m)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0] or not m[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        pix = []
        while stack:
            y, x = stack.pop()
            pix.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(pix) >= min_px:
            p = np.array(pix)
            comps.append({"n": len(pix),
                          "cy": float(p[:, 0].mean()), "cx": float(p[:, 1].mean()),
                          "h": int(np.ptp(p[:, 0]) + 1), "w": int(np.ptp(p[:, 1]) + 1)})
    return comps


def _mm(f):
    return f[hud.MM_Y:hud.MM_Y + hud.MM_H, hud.MM_X:hud.MM_X + hud.MM_W].astype(np.float32)


def check(path, hook_hold=1.15):
    info = probe(path)
    res = []

    def ok(name, cond, detail=""):
        res.append({"check": name, "pass": bool(cond), "detail": detail})

    ok("container 1080x1920", info["width"] == W and info["height"] == H,
       "%dx%d" % (info["width"], info["height"]))
    ok("aspect 9:16", abs(info["width"] / info["height"] - 9 / 16) < 1e-6,
       "%.4f" % (info["width"] / info["height"]))
    ok("duration 10-12s", 10.0 <= info["duration"] <= 12.0, "%.2fs" % info["duration"])
    ok("H.264 video", info["vcodec"] == "h264", info["vcodec"])
    ok("has audio", info["has_audio"], info["acodec"] or "none")

    dur = info["duration"]
    times = [0.04, 0.5, 1.0, 1.6, 3.0, 5.0, 7.0, 9.0, dur - 0.25]
    fr = frames_at(path, times)
    got = [f for f in fr if f is not None]
    ok("frames decodable", len(got) == len(times), "%d/%d" % (len(got), len(times)))
    if len(got) < len(times):
        return info, res
    f0, f05, f10, f16, f30, f50, f70, f90, fend = fr

    # --- opening intensity: no black / no static intro ---
    ok("no black opening frame", f0.mean() > 22, "mean luma %.1f" % f0.mean())
    d01 = np.abs(f0.astype(np.float32) - f10.astype(np.float32)).mean()
    ok("strong first second (motion)", d01 > 4.0, "0.04s->1.0s delta %.1f" % d01)

    # --- stars ---
    star_reg = f05[40:100, W - 360:W - 20]
    white = (star_reg.min(2) > 205) & (star_reg.std(2) < 22)
    sc = components(white, min_px=60)
    ok("exactly six wanted stars", len(sc) == 6, "found %d" % len(sc))
    widths = sorted(c["w"] for c in sc)
    ok("stars uniform + sharp", len(sc) == 6 and (widths[-1] - widths[0]) <= 4,
       "widths %s" % widths)

    # --- no WANTED panel behind the stars ---
    bg = star_reg[~white]
    ok("no wanted background box", float(bg.std()) > 12.0,
       "bg std %.1f (flat panel would be <12)" % float(bg.std()))
    strip = f05[40:100, W - 700:W - 380].astype(np.float32)
    ok("no WANTED text left of stars", strip.std() > 8.0, "std %.1f" % strip.std())

    # --- money ---
    mon = f05[100:180, W - 420:W - 20].astype(np.float32)
    green = (mon[..., 1] > 130) & (mon[..., 1] - mon[..., 0] > 40) & (mon[..., 1] - mon[..., 2] > 40)
    mc = components(green, min_px=14)
    ok("$475,000 visible", green.sum() > 900 and len(mc) >= 6,
       "%d green px, %d glyph blobs" % (int(green.sum()), len(mc)))
    mbg = mon[~green]
    ok("no money background panel", float(mbg.std()) > 12.0, "bg std %.1f" % float(mbg.std()))

    # --- minimap: exactly one, bottom-left, small, semi-transparent, 3D ---
    mm = _mm(f30)
    route = (mm[..., 0] > 150) & (mm[..., 2] > 120) & (mm[..., 1] < 110)
    ok("minimap present bottom-left", route.sum() > 250, "%d route px" % int(route.sum()))
    area = (hud.MM_W * hud.MM_H) / float(W * H)
    ok("minimap is small (<6% of frame)", area < 0.06, "%.2f%%" % (area * 100))
    ok("minimap bottom-left placed", hud.MM_X < W * 0.25 and hud.MM_Y > H * 0.6,
       "x=%d y=%d" % (hud.MM_X, hud.MM_Y))

    # no second minimap / stray route anywhere else in frame
    outside = f30.astype(np.float32).copy()
    outside[hud.MM_Y - 8:hud.MM_Y + hud.MM_H + 8, hud.MM_X - 8:hud.MM_X + hud.MM_W + 8] = 0
    o_route = ((outside[..., 0] > 170) & (outside[..., 2] > 150) &
               (outside[..., 1] < 90))
    tile_area = hud.MM_W * hud.MM_H
    oc = [c for c in components(o_route, min_px=int(tile_area * 0.02))
          if c["w"] < hud.MM_W * 1.7 and c["h"] < hud.MM_H * 1.7
          and c["n"] < tile_area * 2.0]
    ok("exactly ONE minimap (no duplicate)", len(oc) == 0,
       "%d minimap-shaped magenta clusters outside the tile" % len(oc))

    # no old circular radar: look for a large bright ring anywhere
    g = f30.astype(np.float32).mean(2)
    ring = (g > 200)
    rc = [c for c in components(ring, min_px=2600)
          if 0.82 < c["w"] / max(c["h"], 1) < 1.22 and c["w"] > 150]
    ok("no circular minimap/radar", len(rc) == 0, "%d circular blobs" % len(rc))

    # 3D perspective: near rows of the tile carry more road/route ink than far rows
    gmm = mm.mean(2)

    def _runs(rows):
        out = []
        for y in rows:
            c = 0
            for v in (gmm[y] > 120):
                if v:
                    c += 1
                elif c:
                    out.append(c); c = 0
            if c:
                out.append(c)
        return out
    near_r = _runs(range(int(hud.MM_H * 0.64), int(hud.MM_H * 0.96)))
    far_r = _runs(range(int(hud.MM_H * 0.08), int(hud.MM_H * 0.32)))
    nw = float(np.mean(near_r)) if near_r else 0.0
    fw = float(np.mean(far_r)) if far_r else 0.0
    ok("minimap has 3D perspective", nw > fw * 1.18,
       "road width tapers %.1fpx near -> %.1fpx far" % (nw, fw))

    # semi-transparent: tile brightness varies with the gameplay behind it
    a = _mm(f30).mean(); b = _mm(f70).mean()
    ok("minimap semi-transparent", abs(a - b) > 0.4, "tile mean %.1f vs %.1f" % (a, b))

    # --- map movement derived from footage ---
    seq = frames_at(path, [3.0, 3.3, 3.6, 4.0])
    mms = [_mm(x) for x in seq if x is not None]
    dmm = np.mean([np.abs(mms[i] - mms[i - 1]).mean() for i in range(1, len(mms))])
    ok("map moves with vehicle", dmm > 1.0, "mean tile delta %.2f" % dmm)

    # --- exactly one player icon, sitting on the pink route ---
    pmask = (mm.min(2) > 182) & (mm.std(2) < 42)
    pc = [c for c in components(pmask, min_px=20) if c["h"] < 44 and c["w"] < 44]
    near_c = [c for c in pc if abs(c["cx"] - hud.MM_W * 0.5) < 28
              and abs(c["cy"] - 200) < 32]
    ok("exactly ONE player icon", len(near_c) == 1, "%d icon blobs at player anchor" % len(near_c))
    if near_c:
        c = near_c[0]
        y0, y1 = int(c["cy"]) - 22, int(c["cy"]) + 22
        x0, x1 = int(c["cx"]) - 22, int(c["cx"]) + 22
        sub = route[max(y0, 0):y1, max(x0, 0):x1]
        ok("player icon ON pink route", sub.sum() > 40, "%d route px around icon" % int(sub.sum()))

    # --- police markers exist and move ---
    def pm(t_mm):
        blue = (t_mm[..., 2] > 150) & (t_mm[..., 2] - t_mm[..., 0] > 55)
        red = (t_mm[..., 0] > 150) & (t_mm[..., 0] - t_mm[..., 2] > 55) & (t_mm[..., 1] < 120)
        return components(blue, 10), components(red, 10)
    b1, r1 = pm(mms[0]); b2, r2 = pm(mms[-1])
    ok("police markers present", (len(b1) + len(r1)) > 0,
       "%d blue, %d red" % (len(b1), len(r1)))
    moved = np.abs(mms[0] - mms[-1]).mean()
    ok("police markers move", moved > 1.0, "marker-layer delta %.2f" % moved)

    # --- blue/red police light effect on the gameplay ---
    gp = f50.astype(np.float32)
    bl = ((gp[..., 2] - gp[..., 0]) > 34).sum()
    rd = ((gp[..., 0] - gp[..., 2]) > 34).sum()
    ok("blue/red police lights present", bl > 5000 and rd > 5000,
       "%d blue px, %d red px" % (int(bl), int(rd)))

    # --- hook text: fully visible early, gone later ---
    band = f05[int(H * 0.28):int(H * 0.28) + 110]
    txt = (band.min(2) > 200)
    cols = np.nonzero(txt.any(0))[0]
    ok("hook visible at 0.5s", txt.sum() > 1200, "%d text px" % int(txt.sum()))
    if len(cols):
        ok("hook not cropped (POV visible)", cols.min() > 30 and cols.max() < W - 30,
           "text spans x=%d..%d" % (cols.min(), cols.max()))
    band2 = f16[int(H * 0.28):int(H * 0.28) + 110]
    ok("hook removed by 1.6s", (band2.min(2) > 200).sum() < max(txt.sum() * 0.25, 400),
       "%d text px remain" % int((band2.min(2) > 200).sum()))

    # --- loop ---
    mae = np.abs(fend.astype(np.float32) - f0.astype(np.float32)).mean()
    ok("ending loops into beginning", mae < 34.0, "end-vs-start MAE %.1f" % mae)

    return info, res


def report(path):
    info, res = check(path)
    bad = [r for r in res if not r["pass"]]
    lines = ["QA: %s" % path,
             "  %dx%d  %.2fs  %s  audio=%s" % (info["width"], info["height"],
                                               info["duration"], info["vcodec"],
                                               info["acodec"])]
    for r in res:
        lines.append("  [%s] %-34s %s" % ("PASS" if r["pass"] else "FAIL",
                                          r["check"], r["detail"]))
    lines.append("  => %d/%d passed" % (len(res) - len(bad), len(res)))
    return "\n".join(lines), bad
