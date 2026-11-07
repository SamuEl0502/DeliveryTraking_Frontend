<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { canAccess } from '../router';
import { useAuthStore } from '../store/auth';
import type { Role } from '../types/auth';

const auth = useAuthStore();
const router = useRouter();

const ROLE_LABELS: Record<Role, string> = { CLIENT: 'Cliente', STAFF: 'Personal', ADMIN: 'Admin' };

// Menú: rutas con `meta.menu` que el rol actual puede ver (misma regla que la guarda)
const links = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta.menu && r.name && canAccess(r.meta, auth.role))
    .map((r) => ({ name: r.name, label: r.meta.menu ?? '' })),
);

async function onLogout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand" aria-label="Delivery Tracking, ir al mapa">
      <span class="brand-short">DT</span>
      <span class="brand-full">Delivery Tracking</span>
    </RouterLink>

    <nav class="nav" aria-label="Principal">
      <RouterLink v-for="link in links" :key="String(link.name)" :to="{ name: link.name }" class="nav-link">
        {{ link.label }}
      </RouterLink>
    </nav>

    <!-- Hasta saber si hay sesión no se muestra nada (evita parpadeo) -->
    <div v-if="auth.initialized" class="session">
      <template v-if="auth.user">
        <!-- El nombre lleva a "Mi cuenta" -->
        <RouterLink :to="{ name: 'account' }" class="user" :title="`Mi cuenta (${auth.user.email})`">
          <span class="user-name">{{ auth.user.name }}</span>
          <span class="role">{{ ROLE_LABELS[auth.user.role] }}</span>
        </RouterLink>
        <button type="button" class="btn" @click="onLogout">Salir</button>
      </template>
      <template v-else>
        <RouterLink :to="{ name: 'login' }" class="btn">Entrar</RouterLink>
        <RouterLink :to="{ name: 'register' }" class="btn btn-dark">Crear cuenta</RouterLink>
      </template>
    </div>
  </header>
</template>

<style scoped>
/* Mobile-first: altura fija para que el mapa ocupe el resto exacto */
.app-header {
  flex: none;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  position: relative;
  z-index: 1100; /* por encima de los controles del mapa */
}
a {
  color: inherit;
  text-decoration: none;
}
.brand {
  flex: none;
  min-height: 44px;
  display: flex;
  align-items: center;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.brand-full {
  display: none;
}
.nav {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.nav-link {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
}
.nav-link.router-link-exact-active {
  color: var(--text);
  background: var(--surface-2);
}
.session {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.user {
  min-height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  min-width: 0;
  padding: 0 8px;
  border-radius: 10px;
  line-height: 1.2;
}
.user.router-link-exact-active {
  background: var(--surface-2);
}
.user-name {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.role {
  font-size: 11px;
  font-weight: 600;
  color: var(--green);
}
.btn {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.btn-dark {
  background: var(--text);
  border-color: var(--text);
  color: #fff;
}

@media (min-width: 768px) {
  .app-header {
    padding: 0 20px;
    gap: 16px;
  }
  .brand-short {
    display: none;
  }
  .brand-full {
    display: inline;
  }
  .user-name {
    max-width: 200px;
  }
}
</style>
