import { createRouter, createWebHistory, type RouteMeta } from 'vue-router';
import { useAuthStore } from '../store/auth';
import type { Role } from '../types/auth';

// Campos que puede llevar `meta` en cada ruta
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean; // hay que iniciar sesión
    roles?: Role[]; // si viene, solo esos roles pueden entrar
    guestOnly?: boolean; // solo sin sesión (login y registro)
    menu?: string; // texto del enlace en la cabecera; sin él la ruta no sale en el menú
  }
}

/** ¿Puede este rol entrar a una ruta con este meta? La usan la guarda y la cabecera */
export function canAccess(meta: RouteMeta, role: Role | null): boolean {
  if (meta.requiresAuth && !role) return false;
  if (meta.roles && (!role || !meta.roles.includes(role))) return false;
  return true;
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // El mapa es público
    { path: '/', name: 'map', component: () => import('../views/MapView.vue'), meta: { menu: 'Mapa' } },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/registro',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/cuenta',
      name: 'account',
      component: () => import('../views/AccountView.vue'),
      meta: { requiresAuth: true }, // su enlace es el nombre del usuario en la cabecera
    },
    // Las rutas nuevas van antes del comodín
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  // La primera vez se espera el refresh silencioso para saber si hay sesión
  if (!auth.initialized) await auth.restoreSession();

  if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'map' };
  // Pedir roles también implica tener sesión
  if ((to.meta.requiresAuth || to.meta.roles) && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  // Con sesión pero sin el rol pedido: de vuelta al mapa
  if (!canAccess(to.meta, auth.role)) return { name: 'map' };
  return true;
});
