<template>
  <section class="schedule-lookup">
    <button type="button" class="lookup-btn" :disabled="!canSearch" @click="search">
      {{ loading ? 'Consultando…' : 'Ver salidas reales (próximos 40 min)' }}
    </button>
    <p class="credits-note">Cada consulta usa créditos de la API</p>

    <p v-if="loading" class="state" role="status">Buscando salidas…</p>

    <p v-else-if="error" class="state error" role="alert">{{ error }}</p>

    <div v-else-if="result" class="result">
      <div class="meta">
        <strong>{{ result.origin }} → {{ result.destination }}</strong>
        <span :class="['source', result.source]">{{ SOURCE_LABELS[result.source] }}</span>
      </div>
      <p class="meta-line">Consultas usadas hoy: {{ result.queriesToday }}</p>

      <p v-if="result.departures.length === 0" class="state">
        No hay salidas programadas en los próximos 40 minutos para esta ruta
      </p>

      <template v-else>
        <p class="count">
          {{ result.departures.length }}
          {{ result.departures.length === 1 ? 'salida' : 'salidas' }}
        </p>
        <ul class="departures">
          <li v-for="dep in result.departures" :key="dep.flightIata + dep.scheduledDeparture">
            <div class="dep-main">
              <strong>{{ dep.flightIata }}</strong>
              <span class="time">{{ formatTime(dep.scheduledDeparture) }}</span>
            </div>
            <div class="dep-sub">
              <span>Aerolínea: {{ dep.airlineIata ?? 'Sin dato' }}</span>
              <span>{{ statusText(dep) }}</span>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ApiError } from '../services/api';
import { fetchSchedule } from '../services/scheduleApi';
import type { ScheduleDeparture, ScheduleResponse, ScheduleSource } from '../types/schedule';

const props = defineProps<{
  origin: string;
  destination: string;
}>();

const WINDOW_MINUTES = 120;
const IATA_REGEX = /^[A-Za-z]{3}$/;

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<ScheduleResponse | null>(null);

const SOURCE_LABELS: Record<ScheduleSource, string> = {
  airlabs: 'Consulta nueva',
  cache: 'Guardada hace un momento',
  fixture: 'Datos de ejemplo',
};

// Mensaje en español para cada código del backend
const ERROR_MESSAGES: Record<string, string> = {
  SCHEDULE_NOT_CONFIGURED: 'La consulta de horarios no está configurada en el servidor.',
  SCHEDULE_UPSTREAM_ERROR: 'El proveedor de horarios no respondió. Intenta más tarde.',
  SCHEDULE_QUOTA: 'Se agotaron las consultas disponibles. Intenta más tarde.',
  VALIDATION_ERROR: 'Origen y destino deben ser códigos IATA de 3 letras.',
  UNAUTHORIZED: 'Debes iniciar sesión para consultar las salidas.',
  SESSION_EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  FORBIDDEN: 'Solo el personal o un administrador puede consultar las salidas.',
};

// Estados conocidos del proveedor; si llega otro, se muestra tal cual
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programado',
  active: 'En vuelo',
  landed: 'Aterrizado',
  cancelled: 'Cancelado',
  diverted: 'Desviado',
};

// Habilitado solo con dos IATA válidos y sin consulta en curso
const canSearch = computed(
  () => IATA_REGEX.test(props.origin) && IATA_REGEX.test(props.destination) && !loading.value,
);

// Única forma de consultar: el clic del botón
async function search() {
  if (!canSearch.value) return;
  loading.value = true;
  error.value = null;
  try {
    result.value = await fetchSchedule(props.origin, props.destination, WINDOW_MINUTES);
  } catch (e: unknown) {
    result.value = null;
    if (e instanceof ApiError) {
      error.value = (e.code && ERROR_MESSAGES[e.code]) || e.message;
    } else {
      error.value = 'No se pudieron consultar las salidas.';
    }
  } finally {
    loading.value = false;
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

// Si hay retraso se prioriza; si no, el estado
function statusText(dep: ScheduleDeparture): string {
  if (dep.delayMinutes !== null && dep.delayMinutes > 0) {
    return `Retraso de ${dep.delayMinutes} min`;
  }
  if (dep.status) return STATUS_LABELS[dep.status.toLowerCase()] ?? dep.status;
  return 'Sin estado';
}
</script>

<style scoped>
.schedule-lookup {
  margin-bottom: 1.5rem;
}

.lookup-btn {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 1rem;
  background: #0d6e6e;
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.95rem;
  cursor: pointer;
}

.lookup-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.credits-note {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: #888;
}

.state {
  margin: 0.75rem 0 0;
  color: #666;
  font-size: 0.9rem;
}

.state.error {
  color: #d32f2f;
}

.result {
  margin-top: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: white;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.meta-line,
.count {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #555;
}

.source {
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.source.airlabs {
  background: #e8f5e9;
  color: #388e3c;
}

.source.cache {
  background: #e3f2fd;
  color: #1976d2;
}

.source.fixture {
  background: #fff3e0;
  color: #e65100;
}

.departures {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}

.departures li {
  padding: 0.5rem 0;
  border-top: 1px solid #eee;
}

.dep-main,
.dep-sub {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.dep-sub {
  font-size: 0.85rem;
  color: #555;
}

/* En pantallas anchas el botón no ocupa todo */
@media (min-width: 600px) {
  .lookup-btn {
    width: auto;
  }
}
</style>
