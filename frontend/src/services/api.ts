import axios, { AxiosError } from 'axios';
import type { AircraftListResponse } from '../types/aircraft';

/** Error normalizado: la UI solo necesita un mensaje y, si existe, el código HTTP */
export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
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
      // Formato del backend: { error: { code, message, correlationId } }; el 429 del rate limiter puede no traerlo
      const body = (error.response.data as { error?: { message?: string; correlationId?: string } } | undefined)?.error;
      const message = body?.message?.replace(/\.$/, '') ?? `El servidor respondió con error ${status}`;
      const ref = body?.correlationId ? ` (ref. ${body.correlationId})` : '';
      return Promise.reject(new ApiError(message + ref, status));
    }
    return Promise.reject(new ApiError('Error inesperado', null));
  },
);

export async function fetchAircraft(): Promise<AircraftListResponse> {
  const { data } = await api.get<AircraftListResponse>('/api/aircraft');
  return data;
}
