# GTA VI Shorts production pipeline

Renders two vertical 1080x1920 Shorts from two source clips, with a tracked
GTA VI-style HUD recreated from the AI reference image.

## Run

    python3 make_shorts.py

Inputs are auto-detected from `originals/` (any filenames). Originals are
copied read-only into `work/` before use and are never modified.
Outputs: `output_video_1.mp4`, `output_video_2.mp4`.

## How it works

| module | role |
|---|---|
| `pipeline/citymap.py` | Procedural city: street grid + diagonals + curved boulevard, minus a bay. Blocks, POIs, a **closed** navigation circuit, road-following police agents. |
| `pipeline/egomotion.py` | Reads the ACTUAL footage: FFT phase-correlation split left/right recovers yaw and forward speed; also luma/warm-energy flash detection and blue/red emergency-light centroids. |
| `pipeline/hud.py` | Ground-plane pinhole projection of the road network (real perspective, width tapers with depth), drawn as sharp vectors at 3x supersample. Six stars, green money, auto-fitted hook with a vector skull. |
| `pipeline/render.py` | Edit planning, footage-driven map motion, grade, localised police light + wet-road reflections, explosion flash/sparks/shake, audio synthesis, H.264 encode. |
| `pipeline/qa.py` | Decodes the rendered mp4 and measures 31 checks on real pixels. |

### Design guarantees (structural, not cosmetic)

* **Player icon is always on the pink route** — the icon is drawn at the
  projected vehicle origin, and the vehicle's world position is by definition a
  point on the route polyline.
* **Route never crosses buildings** — it is built from real graph edges
  (street centrelines), corners only lightly filleted.
* **Police markers stay on roads** — agents traverse graph edges and choose a
  new edge at each intersection (70% straightest, else a real turn).
* **Seamless loop** — the route is a closed circuit and the footage-derived
  speed profile is normalised so one video equals exactly one lap, so the map
  state at the end equals the state at the start. Map rotation from footage yaw
  is windowed to zero at both ends.
* **HUD is never blurred or shaken** — all grade/blur/shake/zoom is applied to
  the gameplay array, and the HUD tiles are pasted afterwards.
* **No HUD panels** — stars and money are drawn with a glyph stroke only; QA
  asserts the background behind them still varies (a flat panel would not).

## Status

The pipeline is built and validated end to end: **31/31 QA checks pass** on a
full 330-frame / 11.000s render.

The two final Shorts are not rendered yet because the source footage cannot be
reached from this container — see the note in the task thread. Once the two
MP4s are in `originals/`, `make_shorts.py` produces both finished videos.
