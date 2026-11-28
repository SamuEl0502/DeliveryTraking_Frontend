import { api } from './api';
import type {
  Flight,
  FlightListFilters,
  FlightListResponse,
  AssignAircraftRequest,
  UnassignAircraftRequest,
  AssignmentRequest,
} from '../types/flights';

/** Arma los parámetros: IATA en mayúsculas y sin enviar los vacíos */
function buildParams(filters: FlightListFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  const origin = filters.origin?.trim().toUpperCase();
  const destination = filters.destination?.trim().toUpperCase();
  const date = filters.date?.trim();
  if (origin) params.origin = origin;
  if (destination) params.destination = destination;
  if (date) params.date = date;
  if (filters.minCapacityKg !== undefined && !Number.isNaN(filters.minCapacityKg)) {
    params.minCapacityKg = filters.minCapacityKg;
  }
  if (filters.withShipments) params.withShipments = 'true';
  if (filters.page !== undefined) params.page = filters.page;
  if (filters.limit !== undefined) params.limit = filters.limit;
  return params;
}

export async function fetchFlights(filters: FlightListFilters = {}): Promise<FlightListResponse> {
  const { data } = await api.get<FlightListResponse>('/api/flights', { params: buildParams(filters) });
  return data;
}

export async function fetchFlight(flightId: string): Promise<Flight> {
  const { data } = await api.get<Flight>(`/api/flights/${flightId}`);
  return data;
}

export async function assignAircraftToFlight(
  flightId: string,
  body: AssignAircraftRequest,
): Promise<Flight> {
  const { data } = await api.patch<Flight>(`/api/flights/${flightId}/aircraft`, body);
  return data;
}

export async function unassignAircraftFromFlight(
  flightId: string,
  body: UnassignAircraftRequest,
): Promise<Flight> {
  // En Axios el cuerpo del DELETE va dentro de `data`
  const { data } = await api.delete<Flight>(`/api/flights/${flightId}/aircraft`, { data: body });
  return data;
}

export async function assignShipmentToFlight(body: AssignmentRequest): Promise<void> {
  await api.post('/api/assignments', body);
}
