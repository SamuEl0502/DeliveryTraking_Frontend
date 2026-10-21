// Color por altitud al estilo FlightRadar24. Se usa en la estela y la leyenda (los marcadores van de un solo color)

/** Franjas por altitud máxima en metros; la última no tiene tope */
export const ALT_BANDS: { maxM: number; color: string; label: string }[] = [
  { maxM: 600, color: '#2e9e44', label: '< 600 m · 2.000 ft' },
  { maxM: 3000, color: '#9bbf1f', label: '600–3.000 m · 2.000–10.000 ft' },
  { maxM: 6000, color: '#f29b1d', label: '3.000–6.000 m · 10.000–20.000 ft' },
  { maxM: 9000, color: '#e0442b', label: '6.000–9.000 m · 20.000–30.000 ft' },
  { maxM: 12000, color: '#c2338f', label: '9.000–12.000 m · 30.000–40.000 ft' },
  { maxM: Infinity, color: '#7a3fc7', label: '> 12.000 m · 40.000 ft' },
];
export const GROUND_COLOR = '#55575c';

/** null si no hay altitud: se queda el color por defecto */
export function altColor(alt: number | null, onGround = false): string | null {
  if (onGround) return GROUND_COLOR;
  if (alt === null) return null;
  return ALT_BANDS.find((b) => alt < b.maxM)!.color;
}
