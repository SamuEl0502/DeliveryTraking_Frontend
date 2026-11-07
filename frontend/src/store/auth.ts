import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError } from '../services/api';
import * as authApi from '../services/authApi';
import type { AuthResponse, LoginBody, PublicUser, RegisterBody, Role } from '../types/auth';

// Mensajes para la UI según el `code` del backend
function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Error inesperado';
  switch (e.code) {
    case 'INVALID_CREDENTIALS':
      return 'Correo o contraseña incorrectos';
    case 'EMAIL_TAKEN':
      return 'Ya existe una cuenta con ese correo';
    case 'VALIDATION_ERROR':
      return 'Revisa los datos del formulario';
    case 'TOO_MANY_REQUESTS':
      return 'Demasiados intentos. Espera unos minutos y vuelve a probar';
    default:
      // Sin código: problema de conexión u otro error (el mensaje ya viene en español)
      return e.message;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PublicUser | null>(null);
  // El access token vive solo en memoria: al recargar se recupera con el refresh (cookie)
  const accessToken = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  // true cuando ya se intentó recuperar la sesión al cargar la app
  const initialized = ref(false);

  const isAuthenticated = computed(() => user.value !== null && accessToken.value !== null);
  const role = computed<Role | null>(() => user.value?.role ?? null);

  // Promesas en curso: se reutilizan para no repetir la misma petición
  let refreshPromise: Promise<string> | null = null;
  let restorePromise: Promise<void> | null = null;

  function setSession(data: AuthResponse): void {
    user.value = data.user;
    accessToken.value = data.accessToken;
  }

  function clearSession(): void {
    user.value = null;
    accessToken.value = null;
  }

  async function login(body: LoginBody): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      setSession(await authApi.login(body));
      return true;
    } catch (e: unknown) {
      error.value = errorMessage(e);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(body: RegisterBody): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      // El backend ya deja la sesión iniciada al registrarse
      setSession(await authApi.register(body));
      return true;
    } catch (e: unknown) {
      error.value = errorMessage(e);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Aunque falle en el servidor, la sesión local se cierra igual
    } finally {
      clearSession();
    }
  }

  /**
   * Pide un access token nuevo y lo devuelve. Si varias peticiones lo piden
   * a la vez, todas esperan la misma llamada. Si falla, se limpia la sesión.
   */
  function refresh(): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = authApi
        .refresh()
        .then((data) => {
          setSession(data);
          return data.accessToken;
        })
        .catch((e: unknown) => {
          clearSession();
          throw e;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  /** Refresh silencioso al abrir la app: si no hay cookie, simplemente no hay sesión */
  function restoreSession(): Promise<void> {
    if (!restorePromise) {
      restorePromise = refresh()
        .then(() => undefined)
        .catch(() => undefined) // sin error en pantalla
        .finally(() => {
          initialized.value = true;
        });
    }
    return restorePromise;
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    user,
    accessToken,
    loading,
    error,
    initialized,
    isAuthenticated,
    role,
    login,
    register,
    logout,
    refresh,
    restoreSession,
    clearSession,
    clearError,
  };
});
