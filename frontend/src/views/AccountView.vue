<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';
import type { Role } from '../types/auth';

const auth = useAuthStore();
const router = useRouter();
const leaving = ref(false);

const ROLE_LABELS: Record<Role, string> = { CLIENT: 'Cliente', STAFF: 'Personal', ADMIN: 'Administrador' };

async function onLogout(): Promise<void> {
  leaving.value = true;
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <main class="account-page">
    <!-- La guarda ya exige sesión; el v-if cubre el instante en que se cierra -->
    <section v-if="auth.user" class="sheet account-card">
      <h1>Mi cuenta</h1>

      <dl class="data">
        <div class="row">
          <dt>Nombre</dt>
          <dd>{{ auth.user.name }}</dd>
        </div>
        <div class="row">
          <dt>Correo</dt>
          <dd>{{ auth.user.email }}</dd>
        </div>
        <div class="row">
          <dt>Rol</dt>
          <dd><span class="role">{{ ROLE_LABELS[auth.user.role] }}</span></dd>
        </div>
      </dl>

      <button type="button" class="logout" :disabled="leaving" @click="onLogout">
        {{ leaving ? 'Cerrando sesión…' : 'Cerrar sesión' }}
      </button>
    </section>
  </main>
</template>

<style scoped>
/* Mobile-first, igual que las vistas de login y registro */
.account-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.account-card {
  width: 100%;
  max-width: 440px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.data {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.row {
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row:last-child {
  border-bottom: 0;
}
dt {
  font-size: 13px;
  color: var(--text-2);
}
dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere; /* correos largos no generan scroll horizontal */
}
.role {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--green);
  font-size: 14px;
}
.logout {
  min-height: 44px;
  border: 1px solid var(--danger-line);
  border-radius: 999px;
  background: var(--danger-bg);
  color: var(--danger);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.logout:disabled {
  opacity: 0.6;
  cursor: progress;
}

@media (min-width: 768px) {
  .account-page {
    align-items: center;
    padding: 24px;
  }
  .account-card {
    padding: 28px;
  }
  /* En escritorio etiqueta y valor van en la misma línea */
  .row {
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
  }
  dd {
    text-align: right;
  }
}
</style>
