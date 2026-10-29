// Contrato de /api/aircraft/:icao24/details y /schedule (igual a backend/types/flightDetails.ts)
import type { AircraftState } from './aircraft';

export interface Airport {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  lat: number;
  lng: number;
}

export interface AircraftInfo {
  registration: string | null;
  model: string | null;
  icaoType: string | null;
  owner: string | null;
  photoUrl: string | null;
  photoThumbnailUrl: string | null;
  /** Página de la foto en Planespotters; el frontend debe enlazarla junto al fotógrafo */
  photoLink: string | null;
  photographer: string | null;
}

export interface FlightRoute {
  callsign: string;
  flightNumber: string | null;
  airline: { name: string; icao: string | null; iata: string | null } | null;
  origin: Airport;
  destination: Airport;
  /** false: la ruta sale del callsign sin confirmar; entonces progress llega null */
  verified: boolean;
}

export interface FlightProgress {
  totalKm: number;
  flownKm: number;
  remainingKm: number;
  /** 0 a 100 */
  percent: number;
  /** null si está en tierra o no hay velocidad */
  etaMinutes: number | null;
}

export interface AircraftDetails {
  /** Foto del momento de la consulta; los datos en vivo salen del store */
  state: AircraftState;
  aircraft: AircraftInfo | null;
  route: FlightRoute | null;
  progress: FlightProgress | null;
  /** Aeropuerto del que despegó según el recorrido de OpenSky; null si OpenSky no vio el despegue */
  departure: Airport | null;
}

export interface FlightTimes {
  airport: { icao: string; iata: string | null; name: string } | null;
  /** ISO 8601 UTC (el backend ya convierte desde la hora local del aeropuerto) */
  scheduled: string | null;
  /** ISO 8601 UTC */
  estimated: string | null;
  /** ISO 8601 UTC */
  actual: string | null;
  delayMinutes: number | null;
  terminal: string | null;
  gate: string | null;
}

export interface FlightSchedule {
  flightNumber: string;
  airline: string | null;
  /** scheduled | active | landed | cancelled | incident | diverted */
  status: string;
  departure: FlightTimes;
  arrival: FlightTimes;
  /** Ruta real del tramo activo; si llega, reemplaza a la de /details */
  route: FlightRoute | null;
  progress: FlightProgress | null;
  source: 'Aviationstack';
}
