import { api } from './api';
import type { Flight, FlightListResponse, AssignAircraftRequest, AssignmentRequest } from '../types/flights';

interface FlightListFilters {
  originIata?: string;
  destinationIata?: string;
  minCapacityRemaining?: number;
}

export async function fetchFlights(filters?: FlightListFilters): Promise<FlightListResponse> {
  const params = filters ? { ...filters } : {};
  const { data } = await api.get<FlightListResponse>('/api/flights', { params });
  return data;
}

export async function assignAircraftToFlight(
  flightId: string,
  body: AssignAircraftRequest,
): Promise<Flight> {
  const { data } = await api.patch<Flight>(`/api/flights/${flightId}/aircraft`, body);
  return data;
}

export async function assignShipmentToFlight(body: AssignmentRequest): Promise<void> {
  await api.post('/api/assignments', body);
}
