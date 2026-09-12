#!/usr/bin/env python3
"""Produce output_video_1.mp4 and output_video_2.mp4 from the two original clips.

Auto-detects the inputs (any filenames), renders both with the same HUD design so
they read as one channel, and tracks each one's map movement from its OWN footage.
Originals and the reference image are opened read-only and never overwritten.
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline.qa import report          # noqa: E402
from pipeline.render import render      # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
VID_EXT = (".mp4", ".mov", ".mkv", ".webm", ".m4v")
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")
OUTPUTS = {"output_video_1.mp4", "output_video_2.mp4"}


def find_inputs():
    vids, imgs = [], []
    for d in (os.path.join(ROOT, "originals"), ROOT, os.path.join(ROOT, "input")):
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            p = os.path.join(d, fn)
            if not os.path.isfile(p) or fn in OUTPUTS:
                continue
            low = fn.lower()
            if low.endswith(VID_EXT) and p not in vids:
                vids.append(p)
            elif low.endswith(IMG_EXT) and p not in imgs:
                imgs.append(p)
        if len(vids) >= 2:
            break
    return vids, imgs


def main():
    vids, imgs = find_inputs()
    print("detected videos:  %s" % (vids or "NONE"))
    print("detected images:  %s" % (imgs or "NONE"))
    if len(vids) < 2:
        sys.exit("ERROR: need two source videos; found %d. "
                 "Put them in %s/originals/." % (len(vids), ROOT))

    # never touch the originals: work from read-only copies
    safe = []
    os.makedirs(os.path.join(ROOT, "work"), exist_ok=True)
    for i, v in enumerate(vids[:2], 1):
        c = os.path.join(ROOT, "work", "src_%d%s" % (i, os.path.splitext(v)[1]))
        if os.path.abspath(c) != os.path.abspath(v):
            shutil.copy2(v, c)
        os.chmod(c, 0o444)
        safe.append(c)

    results = []
    for i, (src, s0) in enumerate(zip(safe, (0.0, 0.42)), 1):
        out = os.path.join(ROOT, "output_video_%d.mp4" % i)
        print("\n=== rendering %s from %s ===" % (os.path.basename(out),
                                                  os.path.basename(vids[i - 1])))
        info = render(src, out, target=11.0, seed=7, s0_frac=s0)
        print("  segments: %s" % [(round(a, 2), round(b, 2)) for a, b in info["segments"]])
        print("  %d frames, %.3fs" % (info["frames"], info["duration"]))
        txt, bad = report(out)
        print(txt)
        results.append((out, info, bad))

    print("\n================ SUMMARY ================")
    fail = 0
    for out, info, bad in results:
        print("%s  %.2fs  %s" % (os.path.basename(out), info["duration"],
                                 "QA PASS" if not bad else "QA FAIL: %s" %
                                 [b["check"] for b in bad]))
        fail += len(bad)
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
