// Búsqueda de vuelos por número en la lista que ya está en memoria (sin llamar a ninguna API).
// La gente escribe el número comercial IATA (WN590), pero OpenSky da el callsign ICAO (SWA590).

/** Aerolíneas principales de EE. UU.: código IATA → [prefijo ICAO, nombre] */
const AIRLINES: Record<string, [icao: string, name: string]> = {
  AA: ['AAL', 'American Airlines'],
  UA: ['UAL', 'United Airlines'],
  DL: ['DAL', 'Delta Air Lines'],
  WN: ['SWA', 'Southwest Airlines'],
  B6: ['JBU', 'JetBlue'],
  AS: ['ASA', 'Alaska Airlines'],
  NK: ['NKS', 'Spirit Airlines'],
  F9: ['FFT', 'Frontier Airlines'],
  HA: ['HAL', 'Hawaiian Airlines'],
  G4: ['AAY', 'Allegiant Air'],
  SY: ['SCX', 'Sun Country Airlines'],
};
const NAME_BY_ICAO = new Map(Object.values(AIRLINES));
const IATA_BY_ICAO = new Map(Object.entries(AIRLINES).map(([iata, [icao]]) => [icao, iata]));

/**
 * Número comercial a partir del callsign ICAO (SWA590 → WN590), como lo muestra FlightRadar24.
 * Usa la aerolínea de adsbdb si coincide con el prefijo y, si no, la tabla. null si no se puede.
 */
export function flightNumber(
  callsign: string,
  airline?: { icao: string | null; iata: string | null } | null,
): string | null {
  const m = /^([A-Z]{3})(\d[A-Z0-9]*)$/.exec(callsign);
  if (!m) return null; // matrículas (N123AB) y demás se quedan como están
  const iata = (airline?.icao === m[1] && airline?.iata) || IATA_BY_ICAO.get(m[1]!);
  return iata ? iata + m[2] : null;
}

/** Prefijos de callsign que corresponden a lo escrito: tal cual y, si es IATA + número, en ICAO */
export function callsignPrefixes(input: string): string[] {
  const q = input.toUpperCase().replace(/\s+/g, '');
  if (!q) return [];
  const iata = /^([A-Z0-9]{2})(\d.*)$/.exec(q);
  const icao = iata ? AIRLINES[iata[1]!]?.[0] : undefined;
  return icao ? [q, icao + iata![2]] : [q];
}

/** Nombre de la aerolínea a partir del callsign, si es una de las conocidas */
export function airlineName(callsign: string): string | null {
  return NAME_BY_ICAO.get(callsign.slice(0, 3)) ?? null;
}

/** Hasta `limit` elementos cuyo callsign empieza por lo escrito, en orden alfabético */
export function searchFlights<T extends { callsign: string | null }>(items: Iterable<T>, input: string, limit = 8): T[] {
  const prefixes = callsignPrefixes(input);
  if (!prefixes.length) return [];
  const found: T[] = [];
  for (const a of items) if (a.callsign && prefixes.some((p) => a.callsign!.startsWith(p))) found.push(a);
  return found.sort((a, b) => a.callsign!.localeCompare(b.callsign!)).slice(0, limit);
}
