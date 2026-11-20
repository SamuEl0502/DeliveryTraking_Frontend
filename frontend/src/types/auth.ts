// Copia de los tipos de autenticación del backend (backend/types/)

export type Role = 'CLIENT' | 'STAFF' | 'ADMIN';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  airportId: string | null;
}

/** Respuesta de login y refresh */
export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface LoginBody {
  email: string;
  password: string;
}
