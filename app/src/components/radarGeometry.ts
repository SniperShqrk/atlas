/**
 * Radar geometry — pure maths, no React and no react-native imports, so the
 * shape can be unit-tested and rendered headlessly without a device.
 *
 * The chart plots each region's volume as a fraction of that region's own
 * weekly target. 1.0 is the target ring; the outer edge is 1.5x target. That
 * normalisation is what makes the polygon readable: an even octagon sitting on
 * the bronze ring is balanced training, and every dent or spike is a real
 * bias rather than an artefact of some muscles simply needing more sets.
 */

export const RADAR_MAX = 1.5;
/** the ring that represents "on target" */
export const RADAR_TARGET = 1.0;
export const RADAR_RINGS = [0.5, 1.0, 1.5];

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarAxis extends RadarPoint {
  /** where the spoke label sits, pushed outside the outer ring */
  labelX: number;
  labelY: number;
  /** text anchor that keeps the label from overlapping the chart */
  anchor: 'start' | 'middle' | 'end';
  angle: number;
}

export interface RadarGeometry {
  size: number;
  cx: number;
  cy: number;
  radius: number;
  axes: RadarAxis[];
  /** grid polygons, innermost first */
  rings: { value: number; points: string }[];
  /** the user's shape */
  valuePoints: RadarPoint[];
  polygon: string;
  /** clipped ratios actually plotted */
  plotted: number[];
}

function ringPoints(cx: number, cy: number, r: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    pts.push(`${round(cx + Math.cos(angle) * r)},${round(cy + Math.sin(angle) * r)}`);
  }
  return pts.join(' ');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param values one ratio per spoke, in the order the spokes are drawn
 * @param size   the square the chart is drawn into
 * @param labelPad room reserved around the chart for the spoke labels
 */
export function radarGeometry(
  values: number[],
  size: number,
  labelPad = 46
): RadarGeometry {
  const n = Math.max(3, values.length);
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.max(10, size / 2 - labelPad);

  const axes: RadarAxis[] = [];
  const valuePoints: RadarPoint[] = [];
  const plotted: number[] = [];

  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // the label sits just outside the outer ring; the reserved pad is what
    // stops the horizontal spokes from running off the edge of the canvas
    const labelR = radius + 9;
    // a near-vertical spoke reads best centred; the sides get pushed outward
    const anchor: RadarAxis['anchor'] =
      Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';

    axes.push({
      x: round(cx + cos * radius),
      y: round(cy + sin * radius),
      labelX: round(cx + cos * labelR),
      labelY: round(cy + sin * labelR),
      anchor,
      angle,
    });

    const ratio = Math.max(0, Math.min(RADAR_MAX, values[i] ?? 0));
    plotted.push(ratio);
    const r = (ratio / RADAR_MAX) * radius;
    valuePoints.push({ x: round(cx + cos * r), y: round(cy + sin * r) });
  }

  return {
    size,
    cx,
    cy,
    radius,
    axes,
    rings: RADAR_RINGS.map((value) => ({
      value,
      points: ringPoints(cx, cy, (value / RADAR_MAX) * radius, n),
    })),
    valuePoints,
    polygon: valuePoints.map((p) => `${p.x},${p.y}`).join(' '),
    plotted,
  };
}
