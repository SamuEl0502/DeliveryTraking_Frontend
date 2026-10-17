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
