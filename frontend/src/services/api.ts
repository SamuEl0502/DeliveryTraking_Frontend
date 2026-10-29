import axios, { AxiosError } from 'axios';
import type { AircraftListResponse, FlightTrack } from '../types/aircraft';
import type { AircraftDetails, FlightSchedule } from '../types/flightDetails';

/** Error normalizado: mensaje para la UI, código HTTP y `code` del backend si existen */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 8000,
});

// Interceptor de respuesta: traduce cualquier fallo de Axios a ApiError
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      if (error.code === AxiosError.ECONNABORTED) {
        return Promise.reject(new ApiError('El servidor tardó demasiado en responder', null));
      }
      if (!error.response) {
        // Sin respuesta: backend apagado, sin red o bloqueado por CORS
        return Promise.reject(new ApiError('No se pudo conectar con el servidor', null));
      }
      const status = error.response.status;
      // Formato del backend: { error: { code, message, correlationId } }; si no viene, mensaje genérico
      const body = (
        error.response.data as { error?: { code?: string; message?: string; correlationId?: string } } | undefined
      )?.error;
      const message = body?.message?.replace(/\.$/, '') ?? `El servidor respondió con error ${status}`;
      const ref = body?.correlationId ? ` (ref. ${body.correlationId})` : '';
      return Promise.reject(new ApiError(message + ref, status, body?.code ?? null));
    }
    return Promise.reject(new ApiError('Error inesperado', null));
  },
);

export async function fetchAircraft(): Promise<AircraftListResponse> {
  const { data } = await api.get<AircraftListResponse>('/api/aircraft');
  return data;
}

/** Avión, ruta y progreso. Una vez por selección: el backend lo cachea 6 h */
export async function fetchAircraftDetails(icao24: string, signal?: AbortSignal): Promise<AircraftDetails> {
  const { data } = await api.get<AircraftDetails>(`/api/aircraft/${icao24}/details`, { signal });
  return data;
}

/** Recorrido desde el despegue. 4 créditos de OpenSky (caché de 1 min en el backend); 404 TRACK_NOT_FOUND si no hay */
export async function fetchAircraftTrack(icao24: string, signal?: AbortSignal): Promise<FlightTrack> {
  const { data } = await api.get<FlightTrack>(`/api/aircraft/${icao24}/track`, { signal });
  return data;
}

/** Horarios y ruta real de Aviationstack. Solo a pedido del usuario: el cupo es de 100 al mes */
export async function fetchAircraftSchedule(icao24: string, signal?: AbortSignal): Promise<FlightSchedule> {
  const { data } = await api.get<FlightSchedule>(`/api/aircraft/${icao24}/schedule`, { signal });
  return data;
}
