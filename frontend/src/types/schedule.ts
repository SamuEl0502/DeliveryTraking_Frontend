// Contrato de GET /api/schedules (salidas reales de una ruta)

/** De dónde salen los datos: consulta nueva, caché del backend o datos de ejemplo */
export type ScheduleSource = 'airlabs' | 'cache' | 'fixture';

export interface ScheduleDeparture {
  flightIata: string;
  flightIcao: string | null;
  airlineIata: string | null;
  scheduledDeparture: string; // ISO 8601 UTC
  scheduledArrival: string | null; // ISO 8601 UTC
  status: string | null;
  delayMinutes: number | null;
}

export interface ScheduleResponse {
  origin: string;
  destination: string;
  windowMinutes: number;
  generatedAt: string; // ISO 8601 UTC
  source: ScheduleSource;
  queriesToday: number;
  departures: ScheduleDeparture[];
}
