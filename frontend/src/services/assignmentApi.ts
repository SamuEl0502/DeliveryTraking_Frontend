import { api } from './api';
import type {
  AssignBody,
  FlightFilters,
  FlightsResponse,
  ShipmentFilters,
  ShipmentsResponse,
} from '../types/assignment';

// Envíos del personal (STAFF solo ve los de su aeropuerto, ADMIN todos)
export async function fetchShipments(filters: ShipmentFilters = {}): Promise<ShipmentsResponse> {
  const { data } = await api.get<ShipmentsResponse>('/api/shipments', { params: filters });
  return data;
}

// Vuelos para asignar; los filtros vacíos no se envían
export async function fetchFlights(filters: FlightFilters = {}): Promise<FlightsResponse> {
  const { data } = await api.get<FlightsResponse>('/api/flights', { params: filters });
  return data;
}

// Asigna el envío al vuelo o lo reasigna
export async function assignShipment(body: AssignBody): Promise<void> {
  await api.post('/api/assignments', body);
}

// Quita el envío de su vuelo
export async function unassignShipment(shipmentId: string): Promise<void> {
  await api.delete(`/api/assignments/${encodeURIComponent(shipmentId)}`);
}
