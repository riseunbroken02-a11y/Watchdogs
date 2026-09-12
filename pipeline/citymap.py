"""Procedural GTA-style city: road graph, closed navigation route, POI icons, police agents.

Everything drawn on the minimap is derived from this graph, so by construction:
  * the pink route runs along road centrelines (never over buildings / water),
  * the player marker sits exactly on the route (it *is* a point on the route),
  * police markers stay inside the road network and turn at intersections.
"""
import math
import random

WORLD = 2400.0
SPACING = 150.0


# ---------------------------------------------------------------- geometry ---
def _pip(p, poly):
    x, y = p
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                inside = not inside
    return inside


def _dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


BAY = [(1500, 2400), (2400, 2400), (2400, 1450), (2120, 1560),
       (1960, 1820), (1740, 1930), (1590, 2130)]


class City:
    """Grid of streets + two diagonal avenues + one curved boulevard, minus a bay."""

    def __init__(self, seed=7):
        self.rng = random.Random(seed)
        self.nodes = {}          # nid -> (x, y)
        self.adj = {}            # nid -> set(nid)
        self.segments = []       # ((x1,y1),(x2,y2), class)  class: 0 minor 1 major
        self._grid = {}          # (i,j) -> nid
        self._build_grid()
        self._build_avenues()
        self._build_boulevard()
        self.route = self._build_route()
        self.route_len = self.route_cum[-1]
        self.blocks = self._build_blocks()
        self.pois = self._place_pois()
        self.waypoint = self._place_waypoint()
        self.police = [PoliceAgent(self, self.rng, near=self.route_point(
            self.rng.random() * self.route_cum[-1])[0]) for _ in range(16)]

    # --------------------------------------------------------------- build ---
    def _nid(self, x, y):
        key = (round(x, 1), round(y, 1))
        for nid, p in self.nodes.items():
            if (round(p[0], 1), round(p[1], 1)) == key:
                return nid
        nid = len(self.nodes)
        self.nodes[nid] = (x, y)
        self.adj[nid] = set()
        return nid

    def _link(self, a, b, cls=0):
        if a == b:
            return
        self.adj[a].add(b)
        self.adj[b].add(a)
        self.segments.append((self.nodes[a], self.nodes[b], cls))

    def _build_grid(self):
        n = int(WORLD // SPACING) + 1
        for i in range(n):
            for j in range(n):
                x, y = i * SPACING, j * SPACING
                if _pip((x, y), BAY):
                    continue
                self._grid[(i, j)] = self._nid(x, y)
        # majors every 3rd line -> wider roads, like GTA arterials
        for (i, j), nid in list(self._grid.items()):
            for di, dj in ((1, 0), (0, 1)):
                o = self._grid.get((i + di, j + dj))
                if o is None:
                    continue
                cls = 1 if ((di and j % 3 == 0) or (dj and i % 3 == 0)) else 0
                self._link(nid, o, cls)

    def _build_avenues(self):
        # two diagonals cutting the grid, snapped to existing intersections
        for (i0, j0, di, dj) in ((0, 0, 1, 1), (0, 12, 1, -1)):
            prev = None
            i, j = i0, j0
            while (i, j) in self._grid or prev is None:
                nid = self._grid.get((i, j))
                if nid is not None:
                    if prev is not None:
                        self._link(prev, nid, 1)
                    prev = nid
                i += di
                j += dj
                if not (0 <= i <= 16 and 0 <= j <= 16):
                    break

    def _build_boulevard(self):
        # curved boulevard -> gives the network real curvature for police + route
        pts = []
        for t in range(0, 101):
            u = t / 100.0
            x = 120 + u * 2100
            y = 300 + 240 * math.sin(u * math.pi * 1.4) + 120 * u
            pts.append((x, y))
        prev = None
        for p in pts[::5]:
            if _pip(p, BAY):
                prev = None
                continue
            nid = self._nid(*p)
            if prev is not None:
                self._link(prev, nid, 1)
            prev = nid
        self.boulevard = pts

    # --------------------------------------------------------------- route ---
    def _build_route(self):
        """A CLOSED rectilinear circuit on real grid edges, corners filleted.

        Closed = the map state at the end of the video can equal the state at the
        start, which is what makes the short loop seamlessly.
        """
        circuit = [(2, 2), (5, 2), (5, 4), (8, 4), (8, 7), (11, 7),
                   (11, 10), (7, 10), (7, 8), (4, 8), (4, 5), (2, 5), (2, 2)]
        corners = []
        for (i, j) in circuit:
            nid = self._grid.get((i, j))
            if nid is None:
                raise RuntimeError("route corner off-network: %r" % ((i, j),))
            corners.append(self.nodes[nid])
        self.route_corners = corners
        poly = _fillet(corners, radius=26.0, closed=True)
        self.route_poly = poly
        cum = [0.0]
        for k in range(1, len(poly)):
            cum.append(cum[-1] + _dist(poly[k - 1], poly[k]))
        self.route_cum = cum
        return poly

    def route_point(self, s):
        """World position + heading at arc-length s (wraps -> closed loop)."""
        L = self.route_cum[-1]
        s = s % L
        cum = self.route_cum
        lo, hi = 0, len(cum) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if cum[mid] <= s:
                lo = mid
            else:
                hi = mid
        p0, p1 = self.route_poly[lo], self.route_poly[lo + 1]
        seg = max(cum[lo + 1] - cum[lo], 1e-6)
        t = (s - cum[lo]) / seg
        pos = (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)
        # heading smoothed over a short look-ahead so it reads as a vehicle, not a jitter
        a = self._raw_at(s - 12.0)
        b = self._raw_at(s + 12.0)
        hdg = math.atan2(b[1] - a[1], b[0] - a[0])
        return pos, hdg

    def _raw_at(self, s):
        L = self.route_cum[-1]
        s = s % L
        cum = self.route_cum
        for k in range(len(cum) - 1):
            if cum[k] <= s <= cum[k + 1]:
                p0, p1 = self.route_poly[k], self.route_poly[k + 1]
                seg = max(cum[k + 1] - cum[k], 1e-6)
                t = (s - cum[k]) / seg
                return (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)
        return self.route_poly[0]

    def _build_blocks(self):
        """City blocks between streets -> gives the map depth instead of flat land."""
        out = []
        inset = 15.0
        n = int(WORLD // SPACING) + 1
        for i in range(n - 1):
            for j in range(n - 1):
                if not all((i + a, j + b) in self._grid
                           for a, b in ((0, 0), (1, 0), (0, 1), (1, 1))):
                    continue
                x0, y0 = i * SPACING + inset, j * SPACING + inset
                x1, y1 = (i + 1) * SPACING - inset, (j + 1) * SPACING - inset
                shade = self.rng.uniform(0.82, 1.18)
                out.append(((x0, y0), (x1, y1), shade))
        return out

    # ---------------------------------------------------------------- pois ---
    def _place_pois(self):
        """POIs on lots adjacent to route intersections, offset off the roadway."""
        want = ["burger", "gym", "gun", "gas", "police", "burger", "gas"]
        out = []
        for k, kind in enumerate(want):
            frac = (k + 0.5) / len(want)
            s = frac * self.route_cum[-1]
            pos, hdg = self.route_point(s)
            side = 1 if k % 2 == 0 else -1
            off = 46.0 * side
            px = pos[0] + math.cos(hdg + math.pi / 2) * off
            py = pos[1] + math.sin(hdg + math.pi / 2) * off
            if _pip((px, py), BAY):
                px = pos[0] - math.cos(hdg + math.pi / 2) * off
                py = pos[1] - math.sin(hdg + math.pi / 2) * off
            out.append({"kind": kind, "pos": (px, py)})
        return out

    def _place_waypoint(self):
        pos, _ = self.route_point(self.route_cum[-1] * 0.62)
        return pos


def _fillet(corners, radius=26.0, closed=True):
    """Round the corners of a rectilinear path slightly, staying on the centreline."""
    pts = list(corners)
    if closed and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    out = []
    for i in range(n):
        p_prev = pts[(i - 1) % n]
        p = pts[i]
        p_next = pts[(i + 1) % n]
        v1 = (p_prev[0] - p[0], p_prev[1] - p[1])
        v2 = (p_next[0] - p[0], p_next[1] - p[1])
        l1 = max(math.hypot(*v1), 1e-6)
        l2 = max(math.hypot(*v2), 1e-6)
        r = min(radius, l1 * 0.35, l2 * 0.35)
        a = (p[0] + v1[0] / l1 * r, p[1] + v1[1] / l1 * r)
        b = (p[0] + v2[0] / l2 * r, p[1] + v2[1] / l2 * r)
        out.append(a)
        for t in (0.25, 0.5, 0.75):
            # quadratic bezier a -> p -> b
            x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * p[0] + t ** 2 * b[0]
            y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * p[1] + t ** 2 * b[1]
            out.append((x, y))
        out.append(b)
    if closed:
        out.append(out[0])
    return out


class PoliceAgent:
    """Traverses graph edges, prefers going straight, turns at intersections."""

    def __init__(self, city, rng, near=None):
        self.city = city
        self.rng = rng
        nids = [n for n in city.nodes if city.adj[n]]
        if near is not None:
            nids.sort(key=lambda n: _dist(city.nodes[n], near))
            nids = nids[:14]
        self.a = rng.choice(nids)
        self.b = rng.choice(sorted(city.adj[self.a]))
        self.t = rng.random()
        self.speed = rng.uniform(38.0, 66.0)
        self.phase = rng.random()

    def advance(self, dt):
        c = self.city
        pa, pb = c.nodes[self.a], c.nodes[self.b]
        L = max(_dist(pa, pb), 1e-6)
        self.t += self.speed * dt / L
        guard = 0
        while self.t >= 1.0 and guard < 8:
            guard += 1
            self.t -= 1.0
            prev, cur = self.a, self.b
            opts = [n for n in sorted(c.adj[cur]) if n != prev] or [prev]
            # prefer continuing straight: score by heading continuity
            ph, pc = c.nodes[prev], c.nodes[cur]
            hx, hy = pc[0] - ph[0], pc[1] - ph[1]
            hl = max(math.hypot(hx, hy), 1e-6)
            scored = []
            for n in opts:
                pn = c.nodes[n]
                nx, ny = pn[0] - pc[0], pn[1] - pc[1]
                nl = max(math.hypot(nx, ny), 1e-6)
                dot = (hx * nx + hy * ny) / (hl * nl)
                scored.append((dot, n))
            scored.sort(reverse=True)
            # 70% straightest, else a genuine turn
            self.a, self.b = cur, (scored[0][1] if self.rng.random() < 0.7
                                   else scored[self.rng.randrange(len(scored))][1])
            pa, pb = c.nodes[self.a], c.nodes[self.b]
            L = max(_dist(pa, pb), 1e-6)

    def pos(self):
        pa, pb = self.city.nodes[self.a], self.city.nodes[self.b]
        t = min(max(self.t, 0.0), 1.0)
        return (pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t)
