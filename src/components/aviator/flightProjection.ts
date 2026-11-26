import { timeForMultiplier } from './gameLogic';

export type FlightPoint = [number, number];

export function smoothStep(value: number): number {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
}

const HORIZONTAL_PROGRESS_STOPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [2.72, 0.42],
  [6.75, 0.71],
  [10.5, 0.95],
];

/** Keep the path clock monotone so the plane never retraces its horizontal trail. */
export function pathReferenceTime(referenceTime: number): number {
  return Math.max(0, Number.isFinite(referenceTime) ? referenceTime : 0);
}

/** Monotone Hermite interpolation through the reference-video positions. */
export function horizontalProgress(referenceTime: number): number {
  const time = Math.max(0, Number.isFinite(referenceTime) ? referenceTime : 0);
  const last = HORIZONTAL_PROGRESS_STOPS.length - 1;
  if (time >= HORIZONTAL_PROGRESS_STOPS[last][0]) return HORIZONTAL_PROGRESS_STOPS[last][1];
  let segment = 0;
  while (segment < last - 1 && time > HORIZONTAL_PROGRESS_STOPS[segment + 1][0]) segment += 1;
  const slope = (index: number) => {
    if (index === 0) {
      const a = HORIZONTAL_PROGRESS_STOPS[0], b = HORIZONTAL_PROGRESS_STOPS[1];
      return (b[1] - a[1]) / (b[0] - a[0]);
    }
    if (index === last) {
      const a = HORIZONTAL_PROGRESS_STOPS[last - 1], b = HORIZONTAL_PROGRESS_STOPS[last];
      return (b[1] - a[1]) / (b[0] - a[0]);
    }
    const a = HORIZONTAL_PROGRESS_STOPS[index - 1], b = HORIZONTAL_PROGRESS_STOPS[index], c = HORIZONTAL_PROGRESS_STOPS[index + 1];
    const leftSlope = (b[1] - a[1]) / (b[0] - a[0]);
    const rightSlope = (c[1] - b[1]) / (c[0] - b[0]);
    if (leftSlope * rightSlope <= 0) return 0;
    const leftSpan = b[0] - a[0], rightSpan = c[0] - b[0];
    const leftWeight = 2 * rightSpan + leftSpan, rightWeight = rightSpan + 2 * leftSpan;
    return (leftWeight + rightWeight) / (leftWeight / leftSlope + rightWeight / rightSlope);
  };
  const [x0, y0] = HORIZONTAL_PROGRESS_STOPS[segment];
  const [x1, y1] = HORIZONTAL_PROGRESS_STOPS[segment + 1];
  const span = x1 - x0, u = (time - x0) / span;
  const slope0 = slope(segment), slope1 = slope(segment + 1);
  const u2 = u * u, u3 = u2 * u;
  const value = (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * span * slope0 +
    (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * span * slope1;
  return Math.min(y1, Math.max(y0, value));
}

/**
 * Projection seulement : ne calcule ni une cote, ni un crash, ni un gain.
 * La cote fournie par le moteur permet de caler les poses sur la vidéo,
 * quelle que soit la vitesse réelle d'une manche.
 */
export function createFlightProjection(multiplier: number, width: number, height: number) {
  const mRaw = Math.max(1, Number.isFinite(multiplier) ? multiplier : 1);
  const t = timeForMultiplier(mRaw);
  const referenceTime = Math.log(mRaw) / 0.082;
  const pathTime = pathReferenceTime(referenceTime);
  const assetScale = Math.max(0.78, Math.min(1.18, width / 416));
  const left = width * 0.035;
  const graphBottom = height - 1.5;
  const bottom = height - 18 * assetScale;
  // Marge pour le fuselage entier, pas seulement pour la pointe du trait.
  const right = width - 46 * assetScale;
  const top = Math.max(height * 0.055, 48 * assetScale);
  const travel = horizontalProgress(pathTime);
  const planeX = left + (right - left) * travel;

  // Projection visuelle seulement : conserver la montée vidéo jusqu’à 2,50×,
  // puis faire onduler l’altitude en place. Le temps horizontal reste monotone.
  // La cote reçue, le cashout, le seuil de crash et les gains restent inchangés.
  const firstOscillationStart = timeForMultiplier(1.85);
  const plateauStart = timeForMultiplier(2.5);
  const lowAltitude = 0.55;
  const highAltitude = 0.72;
  const altitude = mRaw < 1.85
    ? lowAltitude * smoothStep(Math.log(mRaw) / Math.log(1.85))
    : mRaw <= 2.5
      ? lowAltitude + (highAltitude - lowAltitude) *
        (1 - Math.cos((Math.PI * Math.max(0, t - firstOscillationStart)) / Math.max(0.001, plateauStart - firstOscillationStart))) / 2
      : highAltitude - (highAltitude - lowAltitude) *
        (1 - Math.cos((2 * Math.PI * Math.max(0, t - plateauStart)) / 4.4)) / 2;
  const planeY = Math.min(bottom, Math.max(top, bottom - (bottom - top) * altitude));

  const points: FlightPoint[] = [];
  if (t >= 0.01) {
    for (let i = 0; i <= 40; i += 1) {
      const u = i / 40;
      points.push([left + (planeX - left) * u, graphBottom - (graphBottom - planeY) * Math.pow(u, 2.2)]);
    }
    points[points.length - 1] = [planeX, planeY];
  }
  return { t, referenceTime, pathTime, mRaw, planeX, planeY, points };
}
