// Contrato para vuelos y asignaciones (flight staff features)
import type { Airport } from './flightDetails';

export interface Flight {
  id: string;
  callsign: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  origin: Airport;
  destination: Airport;
  departureTime: string; // ISO 8601 UTC
  arrivalTime: string; // ISO 8601 UTC
  aircraftIcao24: string | null;
  /** Control de versión optimista: cambia al asignar/desasignar avión */
  expectedVersion: number;
  capacityRemaining: number;
  totalCapacity: number;
}

export interface FlightListResponse {
  flights: Flight[];
  total: number;
}

export interface AssignAircraftRequest {
  icao24: string;
  expectedVersion: number;
}

export interface AssignmentRequest {
  flightId: string;
  shipmentId: string;
  expectedFlightVersion: number;
}
