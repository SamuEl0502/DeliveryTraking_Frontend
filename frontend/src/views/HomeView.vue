<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

const router = useRouter();

const code = ref('');
const formError = ref<string | null>(null);

async function onSubmit(): Promise<void> {
  // Sin espacios y en mayúsculas, como están guardados los códigos
  const clean = code.value.replace(/\s+/g, '').toUpperCase();
  if (!clean) {
    formError.value = 'Escribe el código de seguimiento de tu envío';
    return;
  }
  formError.value = null;
  await router.push({ name: 'shipment-tracking', params: { codigo: clean } });
}
</script>

<template>
  <main class="home-page">
    <form class="sheet home-card" novalidate @submit.prevent="onSubmit">
      <h1>Rastrea tu envío</h1>
      <p class="subtitle">Escribe tu código de seguimiento para ver dónde está</p>

      <label class="field">
        <span>Código de seguimiento</span>
        <input
          v-model="code"
          type="text"
          placeholder="DT-A1B2C3"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
      </label>

      <p v-if="formError" class="error" role="alert">{{ formError }}</p>

      <button type="submit" class="submit">Buscar envío</button>

      <div class="links">
        <RouterLink :to="{ name: 'map' }">Ver mapa de vuelos</RouterLink>
        <RouterLink :to="{ name: 'login' }">Acceso del personal</RouterLink>
      </div>
    </form>
  </main>
</template>

<style scoped>
/* Mobile-first: la página hace scroll por dentro porque el body no tiene scroll */
.home-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.home-card {
  width: 100%;
  max-width: 480px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h1 {
  margin: 0;
  font-size: 28px;
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
  min-height: 56px; /* caja grande */
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: 18px; /* más de 16 px evita el zoom automático de iOS */
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.field input::placeholder {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
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
  min-height: 48px;
  border: 0;
  border-radius: 999px;
  background: var(--text);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.links {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.links a {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: var(--text-2);
  font-size: 14px;
  text-decoration: none;
}
.links a:hover {
  color: var(--text);
}

@media (min-width: 768px) {
  .home-page {
    align-items: center;
    padding: 24px;
  }
  .home-card {
    padding: 32px;
  }
  .links {
    flex-direction: row;
    justify-content: center;
    gap: 16px;
  }
}
</style>
