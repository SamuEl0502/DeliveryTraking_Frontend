
export type FlightStatus = 'SCHEDULED' | 'DEPARTED' | 'LANDED' | 'CANCELLED';
export type ShipmentStatus = 'RECEIVED' |'LOADED' | 'IN_FLIGHT' | 'UNLOADED' | 'DELIVERED';
export type TrackingEventType = 'RECEIVED' | 'LOADED' | 'TOOK_OFF' | 'LANDED' | 'UNLOADED' | 'DELIVERED' | 'ALERT' | 'ASSIGNED' | 'REASSIGNED' | 'UNASSIGNED';


export interface ShipmentAirport {
  iataCode: string;
  icaoCode: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  timezone: string;
}

export interface ShipmentEvent {
  id: string;
  type: TrackingEventType;
  occurredAt: string;
  note: string | null;
  airport: { iataCode: string; name: string; city: string } | null;
}

export interface ShipmentDetail {
  id: string;
  trackingCode: string;
  description: string;
  weightKg: number;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
  flight: {
    flightNumber: string;
    callsign: string | null;
    status: FlightStatus;
    scheduledDeparture: string;
    scheduledArrival: string;
    origin: ShipmentAirport;
    destination: ShipmentAirport;
  } | null;
  /** Del más reciente al más antiguo */
  events: ShipmentEvent[];
}