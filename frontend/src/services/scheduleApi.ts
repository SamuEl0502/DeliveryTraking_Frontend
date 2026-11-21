import { api } from './api';
import type { ScheduleImportResponse, ScheduleResponse } from '../types/schedule';

/** Salidas reales de la ruta. Gasta créditos: llamar solo al pulsar el botón */
export async function fetchSchedule(
  origin: string,
  destination: string,
  minutes: number,
): Promise<ScheduleResponse> {
  const { data } = await api.get<ScheduleResponse>('/api/schedules', {
    params: {
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      minutes,
    },
  });
  return data;
}

/** Guarda las salidas reales de la ruta como vuelos. Solo STAFF y ADMIN */
export async function importSchedule(
  origin: string,
  destination: string,
  minutes: number,
): Promise<ScheduleImportResponse> {
  const { data } = await api.post<ScheduleImportResponse>('/api/schedules/import', {
    origin: origin.trim().toUpperCase(),
    destination: destination.trim().toUpperCase(),
    minutes,
  });
  return data;
}
