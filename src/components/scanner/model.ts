/** A 240 mm check window along the sheet. The head's travel maps onto it linearly. */
export const TRAVEL_MM = 240;
export const X_MIN = -100;
export const X_MAX = 64;
export const PERIOD = 4.8;

export function xOf(mm: number) {
  const share = Math.min(1, Math.max(0, mm / TRAVEL_MM));
  return X_MIN + share * (X_MAX - X_MIN);
}

export function readoutOf(mm: number) {
  const shown = Math.round(Math.min(TRAVEL_MM, Math.max(0, mm)) * 10) / 10;
  const text = shown.toFixed(1);
  return `scan ${text === "-0.0" ? "0.0" : text} mm`;
}

/** Cosine sweep: 0 mm at clock 0, 240 mm at half a period, back at the period. */
export function mmAt(clock: number) {
  const turns = clock / PERIOD;
  const phase = turns - Math.floor(turns);
  return (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)) * TRAVEL_MM;
}

/** Clock, in the current period, whose sweep is at `mm` and heading `direction`. */
export function clockAt(mm: number, direction: 1 | -1) {
  const share = Math.min(1, Math.max(0, mm / TRAVEL_MM));
  const theta = Math.acos(Math.min(1, Math.max(-1, 1 - 2 * share)));
  const angle = direction < 0 ? Math.PI * 2 - theta : theta;
  return (angle / (Math.PI * 2)) * PERIOD;
}
