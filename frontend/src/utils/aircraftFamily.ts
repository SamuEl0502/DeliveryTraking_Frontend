// Familia de avión a partir del tipo ICAO (B738, C172...), para elegir silueta y tamaño en el mapa.
// Los tipos vienen de la base de Mictronics (ODC-By): se cita en la atribución del mapa.

export type AircraftFamily =
  | 'cessna-high' | 'piston-low' | 'piston-twin' | 'turboprop-single' | 'kingair'
  | 'bizjet-light' | 'bizjet-large' | 'regional-rear' | 'ejet' | 'a220' | 'a320' | 'b737'
  | 'b757-767' | 'b777-787' | 'a330-a350' | 'jumbo' | 'turboprop-regional' | 'heli'
  | 'military-trainer' | 'generic';

// Tipos exactos: excepciones que un prefijo clasificaría mal (C208 no es una Cessna de ala alta, A318 no es un A310...)
const EXACT: Record<string, AircraftFamily> = {
  C72R: 'cessna-high', C77R: 'cessna-high',
  BE33: 'piston-low', BE35: 'piston-low', BE36: 'piston-low', DA40: 'piston-low', PA46: 'piston-low',
  DA42: 'piston-twin', DA62: 'piston-twin', BE55: 'piston-twin', BE58: 'piston-twin', BE76: 'piston-twin', BE95: 'piston-twin',
  C208: 'turboprop-single', PC12: 'turboprop-single', P46T: 'turboprop-single', KODI: 'turboprop-single', PC6T: 'turboprop-single',
  BE20: 'kingair', BE30: 'kingair', B350: 'kingair', BE9L: 'kingair', BE9T: 'kingair', BE99: 'kingair', BE10: 'kingair',
  E50P: 'bizjet-light', E55P: 'bizjet-light', PC24: 'bizjet-light', HDJT: 'bizjet-light', PRM1: 'bizjet-light', BE40: 'bizjet-light',
  F2TH: 'bizjet-large', G280: 'bizjet-large', GALX: 'bizjet-large', E545: 'bizjet-large', E550: 'bizjet-large',
  E135: 'regional-rear', E145: 'regional-rear', E45X: 'regional-rear', E35L: 'regional-rear',
  A318: 'a320', A319: 'a320', A19N: 'a320', A20N: 'a320', A21N: 'a320',
  B37M: 'b737', B38M: 'b737', B39M: 'b737', B3XM: 'b737',
  MD11: 'a330-a350', DC10: 'a330-a350',
  A388: 'jumbo', A124: 'jumbo', C17: 'jumbo', C5M: 'jumbo',
  SF34: 'turboprop-regional', D328: 'turboprop-regional', J328: 'turboprop-regional', C130: 'turboprop-regional', C30J: 'turboprop-regional',
  H60: 'heli', R22: 'heli', R44: 'heli', R66: 'heli', S76: 'heli', S92: 'heli', B06: 'heli', B407: 'heli', B412: 'heli',
  B429: 'heli', A109: 'heli', A119: 'heli', A139: 'heli', A169: 'heli', H125: 'heli', H135: 'heli', H145: 'heli', H160: 'heli',
  TEX2: 'military-trainer', T38: 'military-trainer', T6: 'military-trainer', PC21: 'military-trainer', PC9: 'military-trainer', PC7: 'military-trainer',
};

// Prefijo → familia, en orden: gana el primero que coincide
const PREFIXES: [string, AircraftFamily][] = [
  ['B74', 'jumbo'],
  ['B75', 'b757-767'], ['B76', 'b757-767'], ['B77', 'b777-787'], ['B78', 'b777-787'],
  ['A30', 'a330-a350'], ['A31', 'a330-a350'], ['A33', 'a330-a350'], ['A34', 'a330-a350'], ['A35', 'a330-a350'],
  ['A32', 'a320'], ['B73', 'b737'], ['BCS', 'a220'],
  ['CRJ', 'regional-rear'], ['E17', 'ejet'], ['E19', 'ejet'], ['E29', 'ejet'], ['E75', 'ejet'],
  ['AT4', 'turboprop-regional'], ['AT7', 'turboprop-regional'], ['DH8', 'turboprop-regional'],
  ['C25', 'bizjet-light'], ['C50', 'bizjet-light'], ['C51', 'bizjet-light'], ['C52', 'bizjet-light'], ['C55', 'bizjet-light'],
  ['C56', 'bizjet-light'], ['C65', 'bizjet-light'], ['C68', 'bizjet-light'], ['LJ', 'bizjet-light'], ['H25', 'bizjet-light'],
  ['CL3', 'bizjet-large'], ['CL6', 'bizjet-large'], ['GL', 'bizjet-large'], ['F9', 'bizjet-large'], ['FA', 'bizjet-large'],
  ['C70', 'bizjet-large'], ['C75', 'bizjet-large'],
  ['TBM', 'turboprop-single'], ['PAY', 'kingair'],
  ['PA44', 'piston-twin'], ['PA34', 'piston-twin'], ['PA31', 'piston-twin'], ['PA30', 'piston-twin'], ['PA23', 'piston-twin'],
  ['C31', 'piston-twin'], ['C34', 'piston-twin'], ['C41', 'piston-twin'], ['C42', 'piston-twin'], ['P68', 'piston-twin'],
  ['C15', 'cessna-high'], ['C17', 'cessna-high'], ['C18', 'cessna-high'], ['C20', 'cessna-high'], ['C21', 'cessna-high'],
  ['P28', 'piston-low'], ['P32', 'piston-low'], ['PA28', 'piston-low'], ['PA32', 'piston-low'], ['SR2', 'piston-low'],
  ['S22', 'piston-low'], ['M20', 'piston-low'], ['RV', 'piston-low'],
  ['EC', 'heli'], ['AS3', 'heli'], ['AS5', 'heli'], ['AS6', 'heli'],
];

/** 'generic' si no hay tipo o no se reconoce */
export function familyOf(type: string | null): AircraftFamily {
  if (!type) return 'generic';
  const t = type.toUpperCase();
  return EXACT[t] ?? PREFIXES.find(([p]) => t.startsWith(p))?.[1] ?? 'generic';
}

// Medida mayor (envergadura o largo, en metros) del modelo representativo de cada familia
const FAMILY_METERS: Record<AircraftFamily, number> = {
  'cessna-high': 11, 'piston-low': 10.7, 'piston-twin': 11.8, 'turboprop-single': 16.3, kingair: 16.6,
  'bizjet-light': 16.3, 'bizjet-large': 21, 'regional-rear': 36.2, ejet: 31.7, a220: 38.7, a320: 37.6, b737: 39.5,
  'b757-767': 47.3, 'b777-787': 73.9, 'a330-a350': 66.8, jumbo: 70.7, 'turboprop-regional': 27.2, heli: 10,
  'military-trainer': 10.2, generic: 34,
};
// Dentro de una familia, los que se distinguen por tamaño (767 frente a 757, 787 frente a 777...)
const TYPE_METERS: [string, number][] = [
  ['B76', 54.9], ['B78', 62.8], ['A388', 79.8], ['A321', 44.5], ['A21N', 44.5], ['GL', 29.4], ['DH8D', 32.8],
  ['E13', 29.9], ['E14', 29.9], ['E45X', 29.9], ['H60', 16.4],
];

/** Tamaño del icono en px: 10 + 0,35 px por metro, entre 14 y 36 */
export function sizePx(type: string | null, family = familyOf(type)): number {
  const t = type?.toUpperCase() ?? '';
  const m = (t && TYPE_METERS.find(([p]) => t.startsWith(p))?.[1]) || FAMILY_METERS[family];
  return Math.round(Math.min(36, Math.max(14, 10 + 0.35 * m)));
}
