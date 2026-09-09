/**
 * Procedural marble — pure maths, no React, so the backdrop can be previewed
 * and tuned in a browser before it ever runs on a phone.
 *
 * Real marble veining is a fracture pattern: a few long primary seams running
 * roughly with the bedding plane, thinner branches leaving them at shallow
 * angles, and a dust of crystalline speckle. Drawing it that way rather than as
 * random squiggles is the difference between stone and a screensaver.
 *
 * Everything is seeded, so a given card always renders the same slab — a
 * backdrop that reshuffles on every render reads as noise, not material.
 */

export interface Vein {
  /** SVG path data */
  d: string;
  width: number;
  opacity: number;
}

export interface Speck {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

export interface MarbleGeometry {
  width: number;
  height: number;
  veins: Vein[];
  specks: Speck[];
  /** unit vector the light runs along, for the gradient */
  light: { x1: string; y1: string; x2: string; y2: string };
}

/** Mulberry32 — small, fast, and good enough for texture. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string into a stable numeric seed. */
export function seedFrom(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * A seam: starts off one edge, wanders across the slab at roughly `angle`,
 * and leaves at the far side. Wander is a random walk on the heading rather
 * than on the position, which is what keeps it looking like a fracture instead
 * of a scribble.
 */
function seam(
  rand: () => number,
  w: number,
  h: number,
  angleDeg: number,
  steps: number,
  wander: number
): { d: string; points: { x: number; y: number }[] } {
  const diag = Math.hypot(w, h);
  let heading = ((angleDeg + (rand() - 0.5) * 24) * Math.PI) / 180;

  // start somewhere off the leading edge so the seam always crosses the slab
  let x = -w * 0.15 + rand() * w * 0.5;
  let y = rand() * h;
  if (rand() > 0.5) {
    x = rand() * w;
    y = -h * 0.15 + rand() * h * 0.4;
  }

  const step = diag / steps;
  const points: { x: number; y: number }[] = [{ x, y }];
  for (let i = 0; i < steps; i += 1) {
    heading += (rand() - 0.5) * wander;
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    points.push({ x, y });
  }

  // smooth through the points with quadratic midpoints — sharp corners read as
  // vector art, and marble has none
  let d = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q${round(points[i].x)},${round(points[i].y)} ${round(mx)},${round(my)}`;
  }
  return { d, points };
}

export function marbleGeometry(
  width: number,
  height: number,
  seed: number,
  lightAngle = 35
): MarbleGeometry {
  const rand = rng(seed);
  const veins: Vein[] = [];

  // Broad tonal washes first. These are what separate stone from a dark
  // gradient with lines drawn on it: very wide, very faint bands that drift
  // across the slab and give the surface large-scale variation for the thin
  // seams to sit on.
  const washes = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < washes; i += 1) {
    const s = seam(rand, width, height, lightAngle + (rand() - 0.5) * 50, 8, 0.35);
    veins.push({
      d: s.d,
      width: round(width * (0.09 + rand() * 0.16)),
      opacity: 0.025 + rand() * 0.035,
    });
  }

  // primary seams — few, wide, low contrast
  const primaries = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < primaries; i += 1) {
    const s = seam(rand, width, height, lightAngle, 14, 0.5);
    veins.push({
      d: s.d,
      width: round(width * (0.004 + rand() * 0.011)),
      opacity: 0.12 + rand() * 0.16,
    });

    // branches leave a primary partway along and run off at a shallow angle
    const branches = 2 + Math.floor(rand() * 4);
    for (let b = 0; b < branches; b += 1) {
      const from = s.points[2 + Math.floor(rand() * (s.points.length - 4))];
      const br = seam(rand, width, height, lightAngle + (rand() - 0.5) * 70, 6, 0.7);
      // re-root the branch onto its parent
      const first = br.d.match(/^M([-\d.]+),([-\d.]+)/);
      if (from && first) {
        const dx = from.x - parseFloat(first[1]);
        const dy = from.y - parseFloat(first[2]);
        veins.push({
          d: br.d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, function (_m, a, c) {
            return `${round(parseFloat(a) + dx)},${round(parseFloat(c) + dy)}`;
          }),
          width: round(width * (0.0012 + rand() * 0.004)),
          opacity: 0.07 + rand() * 0.12,
        });
      }
    }
  }

  // crystalline speckle, denser toward the lit side
  const specks: Speck[] = [];
  const count = Math.round((width * height) / 2600);
  for (let i = 0; i < count; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const lit = 1 - (x / width) * 0.5 - (y / height) * 0.3;
    specks.push({
      x: round(x),
      y: round(y),
      r: round(width * (0.0008 + rand() * 0.0022)),
      opacity: Math.max(0.02, Math.min(0.14, lit * (0.03 + rand() * 0.1))),
    });
  }

  const rad = (lightAngle * Math.PI) / 180;
  return {
    width,
    height,
    veins,
    specks,
    light: {
      x1: `${round(50 - Math.cos(rad) * 50)}%`,
      y1: `${round(50 - Math.sin(rad) * 50)}%`,
      x2: `${round(50 + Math.cos(rad) * 50)}%`,
      y2: `${round(50 + Math.sin(rad) * 50)}%`,
    },
  };
}
