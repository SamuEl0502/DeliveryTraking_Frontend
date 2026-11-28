import { api } from './api';
import type {CreateManualShipmentRequest, ShipmentDetail} from '../types/shipment'
import type { TrackingResponse } from '../types/tracking';

export async function fetchShipment(trackingCode: string): Promise<ShipmentDetail> {
    const{data} = await api.get<ShipmentDetail>(`/api/shipments/${encodeURIComponent(trackingCode)}`)
    return data
}

// Crea un envío a nombre de un cliente (solo STAFF y ADMIN)
export async function createManualShipment(body: CreateManualShipmentRequest): Promise<ShipmentDetail> {
    const{data} = await api.post<ShipmentDetail>('/api/shipments/manual', body)
    return data
}

// Posición del avión que lleva el envío (pública, sin sesión)
export async function fetchTracking(trackingCode: string): Promise<TrackingResponse> {
    const{data} = await api.get<TrackingResponse>(`/api/tracking/${encodeURIComponent(trackingCode)}`)
    return data
}
