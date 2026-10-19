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
}

export interface FlightTimes {
  airportIcao: string | null;
  /** ISO 8601 UTC */
  scheduled: string | null;
  /** ISO 8601 UTC */
  revised: string | null;
  terminal: string | null;
  gate: string | null;
}

export interface FlightSchedule {
  flightNumber: string;
  /** Estado de AeroDataBox: Expected, EnRoute, Landed, Delayed, Canceled… */
  status: string;
  departure: FlightTimes;
  arrival: FlightTimes;
  source: 'AeroDataBox';
}
