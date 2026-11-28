// Contrato de vuelos y asignaciones (igual a la API del backend)

export interface Airport {
  iataCode: string;
  icaoCode: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  timezone: string;
}

export type FlightStatus = 'SCHEDULED' | 'DEPARTED' | 'LANDED' | 'CANCELLED';

export interface Flight {
  id: string;
  flightNumber: string;
  callsign: string | null;
  aircraftIcao24: string | null;
  status: FlightStatus;
  scheduledDeparture: string; // ISO 8601 UTC
  scheduledArrival: string; // ISO 8601 UTC
  origin: Airport;
  destination: Airport;
  capacityKg: number;
  assignedKg: number;
  remainingCapacityKg: number;
  /** Control de versión optimista: cambia con cada modificación del vuelo */
  version: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FlightListResponse {
  flights: Flight[];
  pagination: Pagination;
}

/** Filtros de GET /api/flights */
export interface FlightListFilters {
  origin?: string; // IATA de 3 letras
  destination?: string; // IATA de 3 letras
  date?: string; // AAAA-MM-DD
  minCapacityKg?: number;
  withShipments?: boolean; // solo vuelos con al menos un envío
  page?: number;
  limit?: number; // máximo 100
}

/** Cuerpo de PATCH /api/flights/:id/aircraft */
export interface AssignAircraftRequest {
  icao24: string; // 6 caracteres hexadecimales
  expectedVersion: number;
}

/** Cuerpo de DELETE /api/flights/:id/aircraft */
export interface UnassignAircraftRequest {
  expectedVersion: number;
}

export interface AssignmentRequest {
  flightId: string;
  shipmentId: string;
  expectedFlightVersion: number;
}
