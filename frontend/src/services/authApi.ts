import { api } from './api';
import type { AuthResponse, LoginBody, PublicUser, RegisterBody } from '../types/auth';

// Todas usan la instancia `api`, que ya manda la cookie (withCredentials)

export async function register(body: RegisterBody): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/register', body);
  return data;
}

export async function login(body: LoginBody): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', body);
  return data;
}

/** Pide un access token nuevo con la cookie HttpOnly del refresh (sin body) */
export async function refresh(): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/refresh');
  return data;
}

/** El backend responde 204 sin cuerpo */
export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

/**
 * Usuario de la sesión actual. Falta confirmar si el backend lo manda directo
 * o dentro de { user }; por eso se aceptan las dos formas solo aquí.
 */
export async function fetchMe(): Promise<PublicUser> {
  const { data } = await api.get<PublicUser | { user: PublicUser }>('/api/auth/me');
  return 'user' in data ? data.user : data;
}
