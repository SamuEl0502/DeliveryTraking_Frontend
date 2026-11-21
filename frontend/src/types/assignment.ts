import type { ShipmentStatus } from './shipment';

// Tipos del contrato de asignación de envíos a vuelos

export interface AssignAirport {
  iataCode: string;
  icaoCode: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  timezone: string;
}

export type AssignFlightStatus = 'SCHEDULED' | 'DEPARTED' | 'LANDED' | 'CANCELLED';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Envío de la lista del personal */
export interface StaffShipment {
  id: string;
  trackingCode: string;
  status: ShipmentStatus;
  weightKg: number;
  createdAt: string;
  origin: AssignAirport;
  destination: AssignAirport;
  hasFlight: boolean;
}

export interface ShipmentsResponse {
  shipments: StaffShipment[];
  pagination: Pagination;
}

export interface ShipmentFilters {
  status?: ShipmentStatus;
  page?: number;
  limit?: number;
}

/** Vuelo al que se puede asignar un envío. Las fechas son ISO en UTC */
export interface AssignFlight {
  id: string;
  flightNumber: string;
  callsign: string | null;
  aircraftIcao24: string | null;
  status: AssignFlightStatus;
  scheduledDeparture: string;
  scheduledArrival: string;
  origin: AssignAirport;
  destination: AssignAirport;
  capacityKg: number;
  assignedKg: number;
  remainingCapacityKg: number;
  version: number;
}

export interface FlightsResponse {
  flights: AssignFlight[];
  pagination: Pagination;
}

export interface FlightFilters {
  origin?: string; // código IATA de 3 letras
  destination?: string; // código IATA de 3 letras
  minCapacityKg?: number;
  page?: number;
  limit?: number;
}

export interface AssignBody {
  shipmentId: string;
  flightId: string;
  expectedFlightVersion: number; // la version del vuelo que se vio en pantalla
}
