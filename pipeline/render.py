"""Build one finished GTA VI-style Short from one source clip.

Order of operations per frame matters: every blur/grade/shake happens on the
GAMEPLAY ONLY, and the HUD is composited last, so the minimap, route, player
icon, stars and money are never blurred or shaken.
"""
import math
import subprocess
import wave

import numpy as np
from PIL import Image

from . import hud
from .citymap import City
from .egomotion import FFMPEG, analyse, probe

OUT_W, OUT_H = 1080, 1920
FPS = 30
SR = 48000


# ----------------------------------------------------------------- planning --
def plan_edit(track, target=11.0, min_seg=2.6):
    """HOOK -> CHASE -> ESCALATION -> CLIMAX, strongest explosion near the end."""
    afps = track["afps"]
    dur = track["info"]["duration"]
    action = np.asarray(track["action"], np.float32)
    flash = np.asarray(track["flash"], np.float32)
    n = len(action)

    def win_mean(arr, c, w):
        a = max(0, int(c - w * afps / 2))
        b = min(n, int(c + w * afps / 2))
        return float(arr[a:b].mean()) if b > a else 0.0

    # climax: ends just after the strongest flash in the back half
    back = flash.copy()
    back[: int(n * 0.35)] *= 0.35
    fpk = int(np.argmax(back))
    c_len = 4.2
    c_end = min(dur, fpk / afps + 0.55)
    c_start = max(0.0, c_end - c_len)
    if c_start < 0.2:
        c_start, c_end = 0.2, 0.2 + c_len

    # opener: strongest action outside the climax
    best, bs = -1.0, 0.0
    o_len = 3.0
    t = 0.0
    while t + o_len <= dur:
        if not (t < c_end and t + o_len > c_start):
            v = win_mean(action, (t + o_len / 2) * afps, o_len)
            if v > best:
                best, bs = v, t
        t += 0.1
    o_start, o_end = bs, bs + o_len

    # escalation: fills the remainder from the best untouched region
    rem = max(target - o_len - c_len, min_seg)
    best, bs = -1.0, None
    t = 0.0
    while t + rem <= dur:
        clash = (t < c_end and t + rem > c_start) or (t < o_end and t + rem > o_start)
        if not clash:
            v = win_mean(action, (t + rem / 2) * afps, rem)
            if v > best:
                best, bs = v, t
        t += 0.1
    segs = [(o_start, o_end)]
    if bs is not None:
        segs.append((bs, bs + rem))
    else:                                  # source too short to avoid overlap
        segs.append((max(0.0, c_start - rem), c_start))
    segs.append((c_start, c_end))
    total = sum(b - a for a, b in segs)
    if total > target:                     # trim the middle to hit target
        over = total - target
        a, b = segs[1]
        segs[1] = (a, max(a + min_seg, b - over))
    return segs


# ------------------------------------------------------------ frame sources --
def iter_frames(path, segs):
    """Stream 1080x1920 RGB frames for the planned segments, in order."""
    for (a, b) in segs:
        vf = ("trim=start=%.3f:end=%.3f,setpts=PTS-STARTPTS,fps=%d,"
              "scale=%d:%d:force_original_aspect_ratio=increase,"
              "crop=%d:%d" % (a, b, FPS, OUT_W, OUT_H, OUT_W, OUT_H))
        p = subprocess.Popen(
            [FFMPEG, "-v", "error", "-i", path, "-vf", vf,
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE)
        fsz = OUT_W * OUT_H * 3
        while True:
            buf = p.stdout.read(fsz)
            if len(buf) < fsz:
                break
            yield np.frombuffer(buf, np.uint8).reshape(OUT_H, OUT_W, 3), a
        p.stdout.close()
        p.wait()


def src_times(segs, n_out):
    """Source timestamp of each output frame (for sampling the motion track)."""
    ts = []
    for (a, b) in segs:
        k = int(round((b - a) * FPS))
        for i in range(k):
            ts.append(a + i / FPS)
    return np.asarray(ts[:n_out], np.float32)


# --------------------------------------------------------------- ego motion --
def build_motion(track, city, ts, n):
    """Map movement derived from the ACTUAL footage, closed for a seamless loop."""
    afps = track["afps"]
    idx = np.clip(ts * afps, 0, track["n"] - 1)
    fwd = np.interp(idx, np.arange(track["n"]), np.abs(track["fwd"]))
    yaw = np.interp(idx, np.arange(track["n"]), track["yaw"])

    sp = fwd - fwd.min()
    sp = sp / (sp.max() + 1e-6)
    sp = 0.30 + 0.70 * sp                      # keep the car always moving
    dt = 1.0 / FPS
    s = np.concatenate([[0.0], np.cumsum(sp[:-1] * dt)])
    if s[-1] > 1e-6:                           # normalise so one video == one loop
        s = s * (city.route_len / s[-1])

    yz = yaw - yaw.mean()
    yi = np.cumsum(yz) * dt * 0.9
    win = np.sin(np.linspace(0, math.pi, n)) ** 0.6   # zero at both ends -> loops
    yaw_off = np.clip(yi - yi.mean(), -0.45, 0.45) * win
    return s, yaw_off, sp


# ------------------------------------------------------------------ effects --
_Y, _X = np.mgrid[0:OUT_H // 4, 0:OUT_W // 4]
_Y = _Y.astype(np.float32)
_X = _X.astype(np.float32)


def _glow(cx, cy, rad, strength):
    """Soft radial falloff at quarter res (smooth, so upscaling is invisible)."""
    d2 = (_X - cx * OUT_W / 4.0) ** 2 + (_Y - cy * OUT_H / 4.0) ** 2
    return np.exp(-d2 / (2.0 * (rad * OUT_W / 4.0) ** 2)).astype(np.float32) * strength


def _up(a):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
                      .resize((OUT_W, OUT_H), Image.BILINEAR), np.float32) / 255.0


def grade(f):
    """Contrast + neon-night colour, gameplay only."""
    x = f / 255.0
    x = np.clip((x - 0.5) * 1.13 + 0.5, 0, 1)              # contrast
    x = x ** np.array([0.985, 1.0, 0.965], np.float32)      # slight warm/cool split
    g = x.mean(2, keepdims=True)
    x = np.clip(g + (x - g) * 1.20, 0, 1)                   # saturation
    x[..., 2] += (1.0 - x.mean(2)) * 0.030                  # cool the shadows
    return np.clip(x, 0, 1) * 255.0


def police_lights(x, bx, by, bs, rx, ry, rs):
    """Localised blue/red emergency light + wet-road reflection, following the
    ACTUAL detected lights in the footage (never a global colour filter)."""
    out = x
    for (cx, cy, st, col) in ((bx, by, bs, (0.32, 0.55, 1.0)),
                              (rx, ry, rs, (1.0, 0.26, 0.24))):
        amt = float(min(st * 9.0, 1.0))
        if amt < 0.02:
            continue
        g = _glow(cx, cy, 0.17, 0.50 * amt)
        # wet-road reflection: a vertical smear below the source
        refl = _glow(cx, min(cy + 0.26, 1.2), 0.13, 0.34 * amt)
        refl *= np.clip((_Y / (OUT_H / 4.0) - cy) * 2.2, 0, 1)
        m = _up(g + refl)[..., None]
        c = np.array(col, np.float32) * 255.0
        out = 255.0 - (255.0 - out) * (1.0 - m * (c / 255.0))   # screen blend
    return out


def explosion(x, flash, wx, wy, rng):
    a = float(flash)
    if a < 0.12:
        return x
    k = (a - 0.12) / 0.88
    core = _up(_glow(wx, wy, 0.22, 0.62 * k))[..., None]
    warm = np.array([255.0, 186.0, 96.0], np.float32)
    x = 255.0 - (255.0 - x) * (1.0 - core * (warm / 255.0))
    x = np.clip(x + 26.0 * k, 0, 255)
    if k > 0.45:                                    # sparks / embers
        n = int(60 * k)
        px = (rng.normal(wx, 0.10, n) * OUT_W).astype(np.int32)
        py = (rng.normal(wy, 0.12, n) * OUT_H).astype(np.int32)
        ok = (px > 1) & (px < OUT_W - 2) & (py > 1) & (py < OUT_H - 2)
        px, py = px[ok], py[ok]
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                x[py + dy, px + dx] = np.minimum(
                    x[py + dy, px + dx] + np.array([210, 150, 70], np.float32), 255)
    return x


def shake_zoom(img, dx, dy, zoom):
    if abs(dx) < 0.05 and abs(dy) < 0.05 and abs(zoom - 1.0) < 0.0008:
        return img
    z = zoom
    a = 1.0 / z
    cx, cy = OUT_W / 2.0, OUT_H / 2.0
    return img.transform((OUT_W, OUT_H), Image.AFFINE,
                         (a, 0, cx - a * cx - dx, 0, a, cy - a * cy - dy),
                         resample=Image.BILINEAR)


# -------------------------------------------------------------------- audio --
def _env(n, a, d):
    e = np.ones(n, np.float32)
    ai, di = int(a * SR), int(d * SR)
    if ai:
        e[:ai] = np.linspace(0, 1, ai)
    if di:
        e[-di:] *= np.linspace(1, 0, di)
    return e


def build_audio(path, segs, ts, sp, track, total, rng):
    n = int(total * SR)
    t = np.arange(n, dtype=np.float32) / SR
    mix = np.zeros(n, np.float32)

    # original audio, cut to the same segments
    try:
        raw = subprocess.run(
            [FFMPEG, "-v", "error", "-i", path, "-vn", "-ac", "1",
             "-ar", str(SR), "-f", "f32le", "-"],
            capture_output=True, check=True).stdout
        orig = np.frombuffer(raw, np.float32)
        parts = []
        for (a, b) in segs:
            parts.append(orig[int(a * SR): int(b * SR)])
        oc = np.concatenate(parts) if parts else np.zeros(0, np.float32)
        if len(oc) < n:
            oc = np.pad(oc, (0, n - len(oc)))
        mix += oc[:n] * 1.0
    except Exception:
        pass

    speed = np.interp(t, np.linspace(0, total, len(sp)), sp)

    # engine: sawtooth stack whose pitch rides the footage-derived speed
    f0 = 62.0 + speed * 118.0
    ph = np.cumsum(f0) * 2 * math.pi / SR
    eng = sum(np.sin(ph * k) / (k * 1.5) for k in (1, 2, 3, 5))
    eng += rng.normal(0, 0.06, n)
    mix += eng.astype(np.float32) * 0.105 * (0.55 + 0.45 * speed)

    # two-tone siren wail
    wail = 660.0 + 210.0 * np.sign(np.sin(2 * math.pi * 1.35 * t))
    wail += 60.0 * np.sin(2 * math.pi * 0.55 * t)
    sph = np.cumsum(wail) * 2 * math.pi / SR
    sir = (np.sin(sph) + 0.34 * np.sin(2 * sph))
    mix += sir.astype(np.float32) * 0.080

    # helicopter rotor thump
    thump = (0.5 + 0.5 * np.sign(np.sin(2 * math.pi * 13.0 * t)))
    heli = rng.normal(0, 1, n).astype(np.float32)
    heli = np.convolve(heli, np.ones(90, np.float32) / 90, mode="same")
    mix += heli * thump.astype(np.float32) * 0.085

    # tyre screech on real yaw peaks + explosion hits on real flash peaks
    afps = track["afps"]
    yaw = np.abs(np.interp(ts * afps, np.arange(track["n"]), track["yaw"]))
    fl = np.interp(ts * afps, np.arange(track["n"]), track["flash"])
    yth = float(np.percentile(yaw, 88)) if len(yaw) else 1e9
    last = -99
    for i in range(len(ts)):
        tt = i / FPS
        if yaw[i] > yth and tt - last > 0.5:
            last = tt
            L = int(0.45 * SR)
            s0 = int(tt * SR)
            if s0 + L < n:
                sc = rng.normal(0, 1, L).astype(np.float32)
                fq = np.linspace(2400, 1500, L)
                sc = sc * 0.35 + np.sin(np.cumsum(fq) * 2 * math.pi / SR) * 0.65
                mix[s0:s0 + L] += sc * _env(L, 0.02, 0.30) * 0.10
    peaks = []
    thr = max(float(np.percentile(fl, 92)), 0.25)
    for i in range(1, len(fl) - 1):
        if fl[i] >= thr and fl[i] >= fl[i - 1] and fl[i] > fl[i + 1]:
            if not peaks or i / FPS - peaks[-1] > 0.8:
                peaks.append(i / FPS)
    for tt in peaks:
        L = int(1.5 * SR)
        s0 = int(tt * SR)
        if s0 + L >= n:
            L = n - s0 - 1
        if L <= 100:
            continue
        boom = rng.normal(0, 1, L).astype(np.float32)
        boom = np.convolve(boom, np.ones(40, np.float32) / 40, mode="same")
        sub = np.sin(np.cumsum(np.linspace(78, 32, L)) * 2 * math.pi / SR)
        e = np.exp(-np.linspace(0, 6.5, L)).astype(np.float32)
        mix[s0:s0 + L] += (boom * 0.55 + sub * 0.75).astype(np.float32) * e * 0.42

    peak = float(np.abs(mix).max())
    if peak > 0:
        mix = mix / peak * 0.94
    # short fades so the loop point has no click
    mix[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    mix[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return (mix * 32767).astype(np.int16), peaks


# ------------------------------------------------------------------- render --
def render(src, out, target=11.0, seed=7, s0_frac=0.0,
           hook="POV: 6 STARS IN GTA 6"):
    info = probe(src)
    track = analyse(src)
    segs = plan_edit(track, target=target)
    n = sum(int(round((b - a) * FPS)) for a, b in segs)
    total = n / FPS
    ts = src_times(segs, n)

    city = City(seed=seed)
    s_arr, yaw_off, sp = build_motion(track, city, ts, n)
    s_arr = s_arr + city.route_len * s0_frac   # closed loop -> still loops
    rng = np.random.default_rng(seed)

    afps = track["afps"]
    ai = np.clip(ts * afps, 0, track["n"] - 1)
    gi = np.arange(track["n"])
    fl = np.interp(ai, gi, track["flash"])
    bx = np.interp(ai, gi, track["blue"]["x"]); by = np.interp(ai, gi, track["blue"]["y"])
    bs = np.interp(ai, gi, track["blue"]["strength"])
    rx = np.interp(ai, gi, track["red"]["x"]); ry = np.interp(ai, gi, track["red"]["y"])
    rs = np.interp(ai, gi, track["red"]["strength"])

    sm = hud.render_stars_money()
    hk = hud.render_hook(hook)
    hook_hold, hook_fade = 1.15, 0.22

    wav = out.replace(".mp4", ".wav")
    audio, peaks = build_audio(src, segs, ts, sp, track, total, rng)
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(audio.tobytes())

    enc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-y",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (OUT_W, OUT_H),
         "-r", str(FPS), "-i", "-", "-i", wav,
         "-map", "0:v", "-map", "1:a",
         "-c:v", "libx264", "-preset", "slow", "-crf", "17",
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
         "-movflags", "+faststart", "-r", str(FPS),
         "-c:a", "aac", "-b:a", "192k", "-shortest", out],
        stdin=subprocess.PIPE)

    prev = None
    first = None
    tail = 8                      # short dissolve back to frame 0 -> clean loop
    dt = 1.0 / FPS
    for i, (frm, _) in enumerate(iter_frames(src, segs)):
        if i >= n:
            break
        for ag in city.police:
            ag.advance(dt)

        x = frm.astype(np.float32)
        # shake + speed zoom on GAMEPLAY only
        sh = float(fl[i]) * 13.0
        dx = rng.normal(0, sh * 0.45); dy = rng.normal(0, sh * 0.45)
        zoom = 1.0 + 0.012 * float(sp[i]) + 0.010 * float(fl[i])
        x = np.asarray(shake_zoom(Image.fromarray(frm), dx, dy, zoom), np.float32)
        # temporal motion blur scaled by real speed
        if prev is not None:
            a = 0.13 + 0.20 * float(sp[i])
            x = x * (1 - a) + prev * a
        prev = x.copy()

        x = grade(x)
        x = police_lights(x, bx[i], by[i], bs[i], rx[i], ry[i], rs[i])
        x = explosion(x, fl[i], 0.5 + (bx[i] - 0.5) * 0.3, 0.45, rng)

        img = Image.fromarray(np.clip(x, 0, 255).astype(np.uint8))

        # ---- HUD LAST: always sharp, never blurred or shaken ----
        pos, hdg = city.route_point(float(s_arr[i]))
        mm = hud.render_minimap(city, pos, hdg + float(yaw_off[i]), i / FPS)
        img.paste(mm, (hud.MM_X, hud.MM_Y), mm)
        img.paste(sm, (OUT_W - sm.width - 34, 40), sm)
        tt = i / FPS
        if tt < hook_hold + hook_fade:
            al = 1.0 if tt < hook_hold else 1.0 - (tt - hook_hold) / hook_fade
            layer = hk.copy()
            layer.putalpha(hk.getchannel("A").point(lambda v: int(v * al)))
            img.paste(layer, ((OUT_W - hk.width) // 2, int(OUT_H * 0.30)), layer)

        arr = np.asarray(img, np.uint8)
        if first is None:
            first = arr.copy()
        if i >= n - tail:                      # dissolve into the opening frame
            w = (i - (n - tail) + 1) / float(tail) * 0.85
            arr = (arr * (1 - w) + first * w).astype(np.uint8)
        enc.stdin.write(arr.tobytes())

    enc.stdin.close()
    enc.wait()
    return {"segments": segs, "frames": n, "duration": total,
            "flash_peaks": peaks, "src_info": info,
            "route_len": city.route_len, "loop_closed": True}
