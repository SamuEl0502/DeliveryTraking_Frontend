// Contrato de un avión en la API (el frontend usa el mismo tipo)
export interface AircraftState {
  icao24: string;
  callsign: string | null;
  lat: number;
  lng: number;
  /** Rumbo en grados desde el norte, sentido horario */
  hdg: number | null;
  /** Velocidad en m/s */
  spd: number | null;
  /** Altitud en metros */
  alt: number | null;
  onGround: boolean;
  /** Momento de la posición, Unix en segundos */
  ts: number;
  /** Tipo ICAO del avión (B738, A321, C172...); null si no está en la base de aeronaves */
  type: string | null;
}

/** Punto del recorrido de GET /api/aircraft/:icao24/track (OpenSky) */
export interface TrackPoint {
  ts: number;
  lat: number;
  lng: number;
  alt: number | null;
  hdg: number | null;
  onGround: boolean;
}

/** Recorrido desde el despegue hasta ahora */
export interface FlightTrack {
  icao24: string;
  callsign: string | null;
  path: TrackPoint[];
}

export interface AircraftSnapshot {
  /** Momento del lote según OpenSky, Unix en segundos */
  time: number;
  aircraft: AircraftState[];
}

/** Respuesta de GET /api/aircraft: el lote más el total */
export interface AircraftListResponse extends AircraftSnapshot {
  count: number;
}
