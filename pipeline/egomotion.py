"""Derive real ego-motion + event timing from the ACTUAL footage.

No cv2 available, so global motion is recovered with FFT phase correlation on
downscaled luma, split left/right:

    yaw       ~ (dx_left + dx_right) / 2      (both halves slide the same way)
    forward   ~ (dx_right - dx_left) / 2      (divergence = moving into the scene)

Also extracts per-frame luminance / warm energy (explosion flashes) and the
screen positions + strength of blue and red emergency lights, so light and
shake effects can follow the real police cars instead of being a global filter.
"""
import re
import subprocess

import numpy as np

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def probe(path):
    """Media info parsed from ffmpeg's own stderr (no ffprobe binary here)."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", path],
                       capture_output=True, text=True)
    err = r.stderr
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", err)
    dur = (int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))) if m else 0.0
    v = re.search(r"Stream #\d+:\d+.*?: Video:\s*([a-zA-Z0-9_]+).*?,\s*(\w+).*?,\s*(\d+)x(\d+)", err)
    fpsm = re.search(r",\s*([\d.]+)\s*fps", err)
    a = re.search(r"Stream #\d+:\d+.*?: Audio:\s*([a-zA-Z0-9_]+)", err)
    br = re.search(r"bitrate:\s*(\d+)\s*kb/s", err)
    if not v:
        raise RuntimeError("no video stream found in %s\n%s" % (path, err[-1500:]))
    return {
        "width": int(v.group(3)), "height": int(v.group(4)),
        "fps": float(fpsm.group(1)) if fpsm else 30.0,
        "duration": dur,
        "vcodec": v.group(1), "pix_fmt": v.group(2),
        "has_audio": a is not None, "acodec": a.group(1) if a else None,
        "bitrate_kbps": int(br.group(1)) if br else None,
    }


def read_rgb(path, w, h, fps=None):
    """Decode whole clip to an (N,h,w,3) uint8 array at analysis resolution."""
    cmd = [FFMPEG, "-v", "error", "-i", path]
    vf = "scale=%d:%d" % (w, h)
    if fps:
        vf = "fps=%g," % fps + vf
    cmd += ["-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw[: n * w * h * 3], np.uint8).reshape(n, h, w, 3)


def _phase_shift(a, b):
    """Sub-pixel (dx, dy) that best aligns b onto a, via phase correlation."""
    a = a - a.mean()
    b = b - b.mean()
    win_y = np.hanning(a.shape[0])[:, None]
    win_x = np.hanning(a.shape[1])[None, :]
    A = np.fft.rfft2(a * win_y * win_x)
    B = np.fft.rfft2(b * win_y * win_x)
    R = A * np.conj(B)
    mag = np.abs(R)
    mag[mag < 1e-8] = 1e-8
    r = np.fft.irfft2(R / mag, s=a.shape)
    idx = int(np.argmax(r))
    py, px = divmod(idx, r.shape[1])
    H, W = a.shape

    def _ref(arr, i, n):
        m0 = arr[(i - 1) % n]
        m1 = arr[i % n]
        m2 = arr[(i + 1) % n]
        den = (m0 - 2 * m1 + m2)
        return 0.0 if abs(den) < 1e-9 else 0.5 * (m0 - m2) / den

    sy = _ref(r[:, px], py, H)
    sx = _ref(r[py, :], px, W)
    dy = py + sy
    dx = px + sx
    if dy > H / 2:
        dy -= H
    if dx > W / 2:
        dx -= W
    return float(dx), float(dy)


def analyse(path, aw=192, ah=336, afps=15.0):
    """Return a per-sample motion/event track for the clip."""
    info = probe(path)
    frames = read_rgb(path, aw, ah, fps=afps)
    n = len(frames)
    f = frames.astype(np.float32)
    luma = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]

    # ---- global ego-motion ------------------------------------------------
    yaw = np.zeros(n, np.float32)
    fwd = np.zeros(n, np.float32)
    half = aw // 2
    band = slice(int(ah * 0.25), int(ah * 0.85))   # ignore sky + HUD-ish edges
    for i in range(1, n):
        prev, cur = luma[i - 1][band], luma[i][band]
        dxl, _ = _phase_shift(prev[:, :half], cur[:, :half])
        dxr, _ = _phase_shift(prev[:, half:], cur[:, half:])
        yaw[i] = (dxl + dxr) * 0.5
        fwd[i] = (dxr - dxl) * 0.5
    # despike then smooth
    yaw = _smooth(_despike(yaw), 5)
    fwd = _smooth(_despike(fwd), 5)

    # ---- brightness / explosion flashes ----------------------------------
    mean_l = luma.reshape(n, -1).mean(1)
    p99 = np.percentile(luma.reshape(n, -1), 99, axis=1)
    warm = ((f[..., 0] - f[..., 2]) * (f[..., 0] > 140)).reshape(n, -1).mean(1)
    d_mean = np.diff(mean_l, prepend=mean_l[0])
    flash = _norm(np.maximum(d_mean, 0)) * 0.55 + _norm(warm) * 0.45
    flash = _smooth(flash, 3)

    # ---- emergency light detection ---------------------------------------
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    blue_m = (b > 120) & (b - r > 45) & (b - g > 25)
    red_m = (r > 120) & (r - b > 45) & (r - g > 35)
    blue = _centroids(blue_m, aw, ah)
    red = _centroids(red_m, aw, ah)

    # ---- action score: what to keep in the edit --------------------------
    action = (_norm(np.abs(fwd)) * 0.40 + _norm(np.abs(yaw)) * 0.20 +
              _norm(flash) * 0.25 + _norm(blue["strength"] + red["strength"]) * 0.15)
    action = _smooth(action, 4)

    return {
        "info": info, "afps": afps, "n": n,
        "yaw": yaw, "fwd": fwd, "flash": flash,
        "mean_luma": mean_l, "p99": p99,
        "blue": blue, "red": red, "action": action,
    }


def _despike(v, k=3.0):
    v = v.copy()
    med = np.median(v)
    mad = np.median(np.abs(v - med)) + 1e-6
    bad = np.abs(v - med) > k * 1.4826 * mad * 3.0
    idx = np.arange(len(v))
    if bad.any() and (~bad).sum() > 2:
        v[bad] = np.interp(idx[bad], idx[~bad], v[~bad])
    return v


def _smooth(v, w):
    if w < 2:
        return v
    k = np.ones(w, np.float32) / w
    return np.convolve(np.asarray(v, np.float32), k, mode="same")


def _norm(v):
    v = np.asarray(v, np.float32)
    lo, hi = float(v.min()), float(v.max())
    return (v - lo) / (hi - lo) if hi - lo > 1e-6 else np.zeros_like(v)


def _centroids(mask, aw, ah):
    n = mask.shape[0]
    xs = np.zeros(n, np.float32)
    ys = np.zeros(n, np.float32)
    st = np.zeros(n, np.float32)
    gx = np.arange(aw, dtype=np.float32)[None, :]
    gy = np.arange(ah, dtype=np.float32)[:, None]
    for i in range(n):
        m = mask[i]
        s = m.sum()
        st[i] = s / float(aw * ah)
        if s > 8:
            xs[i] = float((m * gx).sum() / s) / aw
            ys[i] = float((m * gy).sum() / s) / ah
        else:
            xs[i] = ys[i] = np.nan
    for arr in (xs, ys):
        idx = np.arange(n)
        ok = ~np.isnan(arr)
        if ok.any():
            arr[~ok] = np.interp(idx[~ok], idx[ok], arr[ok])
        else:
            arr[:] = 0.5
    return {"x": _smooth(xs, 3), "y": _smooth(ys, 3), "strength": _smooth(st, 3)}
