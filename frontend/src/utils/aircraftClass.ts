// Clase de avión a partir del tipo ICAO (B738, C172...), para elegir icono y tamaño en el mapa.
// Los tipos vienen de la base de Mictronics (ODC-By): se cita en la atribución del mapa.

export type AircraftClass = 'light' | 'business' | 'regional' | 'narrow' | 'wide' | 'jumbo' | 'heli';

// Excepciones que una regla por prefijo clasificaría mal (C72R es un 172, A318 no es un A310...)
const EXACT: Record<string, AircraftClass> = {
  C72R: 'light', C77R: 'light', C208: 'light', PC12: 'light', M20P: 'light', M20T: 'light',
  PC24: 'business', HDJT: 'business', E55P: 'business', E50P: 'business', GLEX: 'business',
  B350: 'light', B37M: 'narrow', B38M: 'narrow', B39M: 'narrow', A318: 'narrow', A319: 'narrow', A19N: 'narrow', A20N: 'narrow', A21N: 'narrow',
  MD11: 'wide', A388: 'jumbo', A124: 'jumbo', AN22: 'jumbo',
  H60: 'heli', R22: 'heli', R44: 'heli', R66: 'heli', S76: 'heli', B06: 'heli', B407: 'heli',
  B412: 'heli', B429: 'heli', A109: 'heli', A119: 'heli', A139: 'heli', A169: 'heli', H125: 'heli',
  H135: 'heli', H145: 'heli',
};

// Prefijo → clase, en orden: gana el primero que coincide
const PREFIXES: [string, AircraftClass][] = [
  ['B74', 'jumbo'],
  ['A30', 'wide'], ['A31', 'wide'], ['A33', 'wide'], ['A34', 'wide'], ['A35', 'wide'],
  ['B76', 'wide'], ['B77', 'wide'], ['B78', 'wide'],
  ['A32', 'narrow'], ['B73', 'narrow'], ['B75', 'narrow'], ['MD8', 'narrow'], ['MD9', 'narrow'],
  ['CRJ', 'regional'], ['E1', 'regional'], ['E7', 'regional'], ['AT4', 'regional'], ['AT7', 'regional'],
  ['DH8', 'regional'], ['BCS', 'regional'],
  ['C5', 'business'], ['C6', 'business'], ['C7', 'business'], ['CL3', 'business'], ['CL6', 'business'],
  ['GLF', 'business'], ['LJ', 'business'], ['FA', 'business'],
  ['C1', 'light'], ['C2', 'light'], ['P28', 'light'], ['PA', 'light'], ['SR2', 'light'], ['DA4', 'light'],
  ['BE', 'light'],
  ['EC', 'heli'], ['AS', 'heli'],
];

/** null si no hay tipo (se usa el icono genérico); 'narrow' si el tipo no se reconoce */
export function classOf(type: string | null): AircraftClass | null {
  if (!type) return null;
  const t = type.toUpperCase();
  return EXACT[t] ?? PREFIXES.find(([p]) => t.startsWith(p))?.[1] ?? 'narrow';
}
