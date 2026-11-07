// Copia de los tipos de autenticación del backend (backend/types/)

export type Role = 'CLIENT' | 'STAFF' | 'ADMIN';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  airportId: string | null;
}

/** Respuesta de register, login y refresh */
export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  email: string;
  password: string; // entre 8 y 72 caracteres
  name: string;
}
