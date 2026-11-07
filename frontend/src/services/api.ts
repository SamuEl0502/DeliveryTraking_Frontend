import axios, { AxiosError } from 'axios';
import type { AircraftListResponse, FlightTrack } from '../types/aircraft';
import type { AircraftDetails, FlightSchedule } from '../types/flightDetails';
// Se usan solo dentro de los interceptores (en tiempo de ejecución), por eso no hay problema con el import circular
import { canAccess, router } from '../router';
import { useAuthStore } from '../store/auth';

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

// Marca para saber si una petición ya se repitió tras un refresh (evita bucles)
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

type ErrorBody = { error?: { code?: string; message?: string; correlationId?: string } };

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 8000,
  withCredentials: true, // necesario para que viaje la cookie HttpOnly del refresh
});

// Interceptor de petición: agrega el access token si hay sesión
api.interceptors.request.use((config) => {
  const token = useAuthStore().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// En estas rutas un 401 no se arregla con refresh (y refresh llamaría a refresh: bucle)
const NO_REFRESH_URLS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

function needsRefresh(error: AxiosError): boolean {
  const config = error.config;
  if (!config || config._retry) return false;
  if (NO_REFRESH_URLS.some((url) => config.url?.includes(url))) return false;
  const code = (error.response?.data as ErrorBody | undefined)?.error?.code;
  return error.response?.status === 401 && code === 'TOKEN_EXPIRED';
}

// Interceptor de respuesta: primero intenta el refresh y luego traduce el fallo a ApiError
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (error instanceof AxiosError && error.config && needsRefresh(error)) {
      const config = error.config;
      config._retry = true;
      try {
        // Si hay varias peticiones con 401 a la vez, todas esperan el mismo refresh
        await useAuthStore().refresh();
      } catch {
        // El refresh falló: el store ya limpió la sesión. Sin error ruidoso, solo al login si la ruta es privada
        const current = router.currentRoute.value;
        if (!canAccess(current.meta, null)) {
          void router.push({ name: 'login', query: { redirect: current.fullPath } });
        }
        return Promise.reject(new ApiError('Tu sesión expiró. Vuelve a iniciar sesión', 401, 'SESSION_EXPIRED'));
      }
      // Se repite una sola vez; el interceptor de petición pone el token nuevo
      return api(config);
    }
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
      const body = (error.response.data as ErrorBody | undefined)?.error;
      const message = body?.message?.replace(/\.$/, '') ?? `El servidor respondió con error ${status}`;
      const ref = body?.correlationId ? ` (ref. ${body.correlationId})` : '';
      return Promise.reject(new ApiError(message + ref, status, body?.code ?? null));
    }
    return Promise.reject(new ApiError('Error inesperado', null));
  },
);

export async function fetchAircraft(airline?: string): Promise<AircraftListResponse> {
  const { data } = await api.get<AircraftListResponse>('/api/aircraft', { params: airline ? { airline } : {} });
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
