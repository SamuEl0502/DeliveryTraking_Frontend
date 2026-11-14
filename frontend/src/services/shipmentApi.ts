import { api } from './api';
import type {ShipmentDetail} from '../types/shipment' 

export async function fetchMeShipment(trackingCode: string): Promise<ShipmentDetail> {
    const{data} = await api.get<ShipmentDetail>(`/api/shipments/${encodeURIComponent(trackingCode)}`)
    return data
} 