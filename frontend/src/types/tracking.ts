import type { FlightStatus, ShipmentAirport, ShipmentStatus } from './shipment';

// Posición del avión en este momento (la velocidad viene en m/s y la altitud en metros)
export interface LivePosition {
  lat: number;
  lng: number;
  hdg: number | null;
  spd: number | null;
  alt: number | null;
  onGround: boolean;
  ts: number; // Unix en segundos
}

// Por qué no hay posición (no es un error, es un caso normal)
export type NoPositionReason = 'no_flight' | 'no_aircraft' | 'no_position' | 'source_unavailable';

export interface TrackingFlight {
  flightNumber: string;
  callsign: string | null;
  status: FlightStatus;
  scheduledDeparture: string;
  scheduledArrival: string;
  origin: ShipmentAirport;
  destination: ShipmentAirport;
}

// Lo que se repite siempre
interface TrackingBase {
  trackingCode: string;
  status: ShipmentStatus;
  flight: TrackingFlight | null;
}

// Con posición: live viene lleno y reason es null
interface TrackingWithPosition extends TrackingBase {
  live: LivePosition;
  reason: null;
}

// Sin posición: live es null y reason explica por qué
interface TrackingWithoutPosition extends TrackingBase {
  live: null;
  reason: NoPositionReason;
}

export type TrackingResponse = TrackingWithPosition | TrackingWithoutPosition;
