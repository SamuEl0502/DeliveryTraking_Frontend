<template>
  <section class="schedule-lookup">
    <button type="button" class="lookup-btn" :disabled="!canSearch" @click="search">
      {{ loading ? 'Consultando…' : 'Actualizar vuelos' }}
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

        <!-- Guardar como vuelos: no tiene sentido con datos de ejemplo -->
        <div v-if="result.source !== 'fixture'" class="import">
          <button type="button" class="save-btn" :disabled="saving" @click="saveFlights">
            {{ saving ? 'Guardando…' : 'Guardar estas salidas como vuelos' }}
          </button>
          <p class="credits-note">Guarda las salidas como vuelos para poder asignarles paquetes</p>
          <p v-if="importMessage" class="state success" role="status">{{ importMessage }}</p>
          <p v-if="importError" class="state error" role="alert">{{ importError }}</p>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ApiError } from '../services/api';
import { fetchSchedule, importSchedule } from '../services/scheduleApi';
import type { ScheduleDeparture, ScheduleResponse, ScheduleSource } from '../types/schedule';

const props = defineProps<{
  origin: string;
  destination: string;
}>();

// Avisa al padre que se guardaron vuelos, para que recargue su lista
const emit = defineEmits<{
  saved: [];
}>();

const WINDOW_MINUTES = 120;
const IATA_REGEX = /^[A-Za-z]{3}$/;

const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<ScheduleResponse | null>(null);

// Estado de "Guardar como vuelos"
const saving = ref(false);
const importError = ref<string | null>(null);
const importMessage = ref<string | null>(null);

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

// Mensajes en español para los errores de guardar
const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  IMPORT_NOT_AVAILABLE: 'El servidor está en modo de ejemplo: no se pueden guardar salidas reales.',
  AIRPORT_NOT_SUPPORTED: 'Alguno de los aeropuertos de esta ruta no está disponible en el sistema.',
  FORBIDDEN_AIRPORT: 'No tienes permiso para guardar vuelos de este aeropuerto.',
  SCHEDULE_QUOTA: 'Se agotaron las consultas disponibles. Intenta más tarde.',
  SCHEDULE_UPSTREAM_ERROR: 'El proveedor de horarios no respondió. Intenta más tarde.',
  SCHEDULE_NOT_CONFIGURED: 'La consulta de horarios no está configurada en el servidor.',
  VALIDATION_ERROR: 'Origen y destino deben ser códigos IATA de 3 letras.',
  UNAUTHORIZED: 'Debes iniciar sesión para guardar las salidas.',
  SESSION_EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  FORBIDDEN: 'Solo el personal o un administrador puede guardar las salidas.',
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
  importError.value = null;
  importMessage.value = null;
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

// Guarda las salidas mostradas como vuelos (usa la ruta del resultado, no la de los inputs)
async function saveFlights() {
  if (!result.value || saving.value) return;
  saving.value = true;
  importError.value = null;
  importMessage.value = null;
  try {
    const res = await importSchedule(result.value.origin, result.value.destination, WINDOW_MINUTES);
    const nuevos = `${res.newFlight} ${res.newFlight === 1 ? 'vuelo nuevo' : 'vuelos nuevos'}`;
    const existentes = res.existFlight === 1 ? '1 ya estaba' : `${res.existFlight} ya estaban`;
    importMessage.value = `Se guardaron ${nuevos}; ${existentes}`;
    emit('saved');
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      importError.value = (e.code && IMPORT_ERROR_MESSAGES[e.code]) || e.message;
    } else {
      importError.value = 'No se pudieron guardar las salidas.';
    }
  } finally {
    saving.value = false;
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

.state.success {
  color: #388e3c;
}

.import {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #eee;
}

.save-btn {
  width: 100%;
  min-height: 44px;
  padding: 0.5rem 1rem;
  background: white;
  color: #0d6e6e;
  border: 1px solid #0d6e6e;
  border-radius: 0.25rem;
  font-size: 0.95rem;
  cursor: pointer;
}

.save-btn:disabled {
  color: #999;
  border-color: #ccc;
  cursor: not-allowed;
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
  .lookup-btn,
  .save-btn {
    width: auto;
  }
}
</style>
