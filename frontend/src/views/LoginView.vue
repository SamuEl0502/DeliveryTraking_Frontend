<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({ email: '', password: '' });
const formError = ref<string | null>(null);
const isDev = import.meta.env.DEV;

// Al entrar se borra el error que haya quedado de otra pantalla
auth.clearError();

// Solo se acepta un redirect interno (empieza con "/" y no con "//")
// Sin redirect válido: STAFF y ADMIN van a vuelos y los demás al inicio
function redirectTarget(): string {
  const value = route.query.redirect;
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) return value;
  return auth.role === 'STAFF' || auth.role === 'ADMIN' ? '/staff/vuelos' : '/';
}

function validate(): string | null {
  if (!form.email.trim() || !form.password) return 'Escribe tu correo y tu contraseña';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'El correo no tiene un formato válido';
  return null;
}

async function onSubmit(): Promise<void> {
  formError.value = validate();
  if (formError.value) return;
  const ok = await auth.login({ email: form.email.trim(), password: form.password });
  if (ok) await router.replace(redirectTarget());
}
</script>

<template>
  <main class="auth-page">
    <form class="sheet auth-card" novalidate @submit.prevent="onSubmit">
      <h1>Iniciar sesión</h1>
      <p class="subtitle">Acceso para el personal de Delivery Tracking</p>

      <label class="field">
        <span>Correo</span>
        <input v-model="form.email" type="email" autocomplete="email" inputmode="email" required />
      </label>

      <label class="field">
        <span>Contraseña</span>
        <input v-model="form.password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="formError ?? auth.error" class="error" role="alert">{{ formError ?? auth.error }}</p>

      <button type="submit" class="submit" :disabled="auth.loading">
        <span v-if="auth.loading" class="spinner" aria-hidden="true" />
        {{ auth.loading ? 'Entrando…' : 'Entrar' }}
      </button>

      <!-- Solo en desarrollo: usuarios de prueba del backend -->
      <p v-if="isDev" class="hint">
        Prueba: staff@ o admin@deliverytracking.test · clave Prueba123
      </p>
    </form>
  </main>
</template>

<style scoped>
/* Mobile-first: la página hace scroll por dentro porque el body no tiene scroll */
.auth-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.subtitle {
  margin: -8px 0 0;
  font-size: 14px;
  color: var(--text-2);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
.field input {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: 16px; /* 16 px evita el zoom automático de iOS */
  font-weight: 400;
}
.field input:focus {
  outline: 2px solid var(--plane-selected);
  outline-offset: 1px;
}
.error {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--danger-line);
  border-radius: 12px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 14px;
}
.submit {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: var(--text);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.submit:disabled {
  opacity: 0.6;
  cursor: progress;
}
.hint {
  margin: 0;
  font-size: 12px;
  text-align: center;
  color: var(--text-2);
  overflow-wrap: anywhere;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 768px) {
  .auth-page {
    align-items: center;
    padding: 24px;
  }
  .auth-card {
    padding: 28px;
  }
}
</style>
