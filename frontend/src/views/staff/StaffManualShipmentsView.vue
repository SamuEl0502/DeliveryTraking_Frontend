<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ApiError } from '../../services/api';
import { createManualShipment } from '../../services/shipmentApi';
import { useAuthStore } from '../../store/auth';
import type { CreateManualShipmentRequest } from '../../types/shipment';

const auth = useAuthStore();
const form = reactive({
  origin: '',
  destination: '',
  weightKg: null as number | null,
  ownerEmail: '',
  description: '',
});

// Un Staff siempre sale de su aeropuerto: no escribe el origen (usa el mismo `auth` de arriba)
const staffAirport = computed(() =>
  auth.user?.role === 'STAFF' ? auth.user.airport : null,
);

// Estado del envío del formulario
const sending = ref(false);
const createdCode = ref<string | null>(null);
const submitError = ref<string | null>(null);

function resetForm(): void {
  form.origin = '';
  form.destination = '';
  form.weightKg = null;
  form.ownerEmail = '';
  form.description = '';
}

async function onSubmit(): Promise<void> {
  if (sending.value || form.weightKg === null) return;

  const body: CreateManualShipmentRequest = {
    ownerEmail: form.ownerEmail.trim(),
    description: form.description.trim(),
    weightKg: form.weightKg,
    destination: form.destination.trim().toUpperCase(),
  };
  // Solo el Admin elige el origen; para el Staff el backend usa su aeropuerto
  if (auth.user?.role === 'ADMIN') body.origin = form.origin.trim().toUpperCase();

  sending.value = true;
  createdCode.value = null;
  submitError.value = null;
  try {
    const shipment = await createManualShipment(body);
    createdCode.value = shipment.trackingCode;
    resetForm();
  } catch (e: unknown) {
    submitError.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado';
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <main class="staff-page">
    <div class="staff-wrap">
      <!-- Formulario de envío manual -->
      <section class="sheet card" aria-labelledby="form-title">
        <h2 id="form-title">Crear envío</h2>

        <form class="form" @submit.prevent="onSubmit">
          <div class="field">
            <label class="label" for="owner-email">Email del Cliente</label>
            <input id="owner-email" v-model="form.ownerEmail" type="email" placeholder="Email" maxlength="50" required />
          </div>

          <div class="field">
            <label class="label" for="description">Descripción</label>
            <input
              id="description"
              v-model="form.description"
              type="text"
              placeholder="Descripción del artículo"
              maxlength="200"
              required
            />
          </div>

          <div class="field">
            <label class="label" for="weight">Peso</label>
            <input
              id="weight"
              v-model.number="form.weightKg"
              type="number"
              min="0.01"
              max="999999.99"
              step="0.01"
              placeholder="Peso en Kg"
              required
            />
          </div>

          <div class="field">
            <label class="label" :for="staffAirport ? undefined : 'origin'">Origen</label>
            <span v-if="staffAirport" class="fixed-origin">
              {{ staffAirport.iataCode }} · {{ staffAirport.name }}
            </span>
            <input v-else id="origin" v-model="form.origin" type="text" placeholder="Origen (IATA)" maxlength="3" required />
          </div>

          <div class="field">
            <label class="label" for="destination">Destino</label>
            <input
              id="destination"
              v-model="form.destination"
              type="text"
              placeholder="Destino (IATA)"
              maxlength="3"
              required
            />
          </div>

          <p v-if="createdCode" class="success" role="status">
            Envío creado con el código {{ createdCode }}.
            <RouterLink :to="`/envio/${createdCode}`">Ver seguimiento</RouterLink>
          </p>
          <p v-if="submitError" class="error" role="alert">{{ submitError }}</p>

          <button type="submit" class="primary" :disabled="sending">
            {{ sending ? 'Creando...' : 'Crear' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* Mobile-first: la página hace scroll por dentro porque el body no tiene scroll */
.staff-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}
.staff-wrap {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
}
.card {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 13px;
  color: var(--text-2);
}
input,
.fixed-origin {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.fixed-origin {
  padding: 10px 12px;
  background: var(--surface-2);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.success,
.error {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.success {
  background: var(--surface-2);
  color: var(--green);
  font-weight: 600;
}
.success a {
  color: inherit;
}
.error {
  border: 1px solid var(--danger-line);
  background: var(--danger-bg);
  color: var(--danger);
}
.primary {
  min-height: 44px;
  margin-top: 4px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: var(--text);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.primary:disabled {
  opacity: 0.6;
  cursor: progress;
}

@media (min-width: 768px) {
  .staff-page {
    padding: 24px;
  }
  .card {
    padding: 28px;
  }
}
</style>
