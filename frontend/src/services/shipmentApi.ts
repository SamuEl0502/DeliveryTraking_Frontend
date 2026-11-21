import { api } from './api';
import type {ShipmentDetail} from '../types/shipment'
import type { TrackingResponse } from '../types/tracking';

export async function fetchShipment(trackingCode: string): Promise<ShipmentDetail> {
    const{data} = await api.get<ShipmentDetail>(`/api/shipments/${encodeURIComponent(trackingCode)}`)
    return data
}

// Posición del avión que lleva el envío (pública, sin sesión)
export async function fetchTracking(trackingCode: string): Promise<TrackingResponse> {
    const{data} = await api.get<TrackingResponse>(`/api/tracking/${encodeURIComponent(trackingCode)}`)
    return data
}
