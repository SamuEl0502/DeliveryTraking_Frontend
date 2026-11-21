<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import ShipmentMap from '../components/ShipmentMap.vue';
import ShipmentTimeline from '../components/ShipmentTimeline.vue';
import { usePolling } from '../composables/usePolling';
import { ApiError } from '../services/api';
import { fetchShipment, fetchTracking } from '../services/shipmentApi';
import type { ShipmentDetail, ShipmentStatus } from '../types/shipment';
import type { NoPositionReason, TrackingResponse } from '../types/tracking';

const route = useRoute();

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  RECEIVED: 'Recibido',
  LOADED: 'Cargado',
  IN_FLIGHT: 'En vuelo',
  UNLOADED: 'Descargado',
  DELIVERED: 'Entregado',
};

// Mensaje cuando no hay posición del avión
const REASON_MESSAGES: Record<NoPositionReason, string> = {
  no_flight: 'Este envío todavía no tiene un vuelo asignado.',
  no_aircraft: 'Aún no detectamos el avión de este vuelo. Aparece cuando empieza a transmitir su señal, unos minutos antes de despegar.',
  no_position: 'El avión no está transmitiendo en este momento. Puede estar en tierra o fuera de cobertura.',
  source_unavailable: 'El servicio de posiciones no responde en este momento. Intenta de nuevo más tarde.',
};

const code = computed(() => String(route.params.codigo ?? '').trim().toUpperCase());

const shipment = ref<ShipmentDetail | null>(null);
const tracking = ref<TrackingResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const trackingFailed = ref(false);

// Para ignorar respuestas viejas si el código cambia mientras se carga
let currentLoad = 0;

function errorText(e: unknown, notFoundText: string): string {
  if (!(e instanceof ApiError)) return 'Ocurrió un error inesperado';
  if (e.status === 404) return notFoundText;
  if (e.status === 429) return 'Hiciste muchas consultas seguidas. Espera un momento y vuelve a intentar.';
  if (e.status === null) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  return e.message;
}

async function load(): Promise<void> {
  const thisLoad = ++currentLoad;
  loading.value = true;
  error.value = null;
  trackingFailed.value = false;
  shipment.value = null;
  tracking.value = null;

  // Las dos peticiones salen a la vez
  const [shipmentResult, trackingResult] = await Promise.allSettled([
    fetchShipment(code.value),
    fetchTracking(code.value),
  ]);
  if (thisLoad !== currentLoad) return;

  if (shipmentResult.status === 'rejected') {
    error.value = errorText(shipmentResult.reason, `No encontramos ningún envío con el código ${code.value}.`);
  } else {
    shipment.value = shipmentResult.value;
    // Si falla solo el seguimiento, igual se muestra el envío
    if (trackingResult.status === 'fulfilled') tracking.value = trackingResult.value;
    else trackingFailed.value = true;
  }
  loading.value = false;
}

watch(code, load, { immediate: true });

// Cada 15 s se vuelve a pedir el seguimiento para mover el avión en el mapa
const POLL_MS = 15_000;

async function refreshTracking(): Promise<void> {
  // La primera carga la hace load(); sin envío no hay nada que actualizar
  if (loading.value || !shipment.value) return;
  const thisLoad = currentLoad;
  try {
    const data = await fetchTracking(code.value);
    if (thisLoad !== currentLoad) return; // cambió de envío mientras se pedía
    tracking.value = data;
    trackingFailed.value = false;
  } catch {
    // Si falla, se conserva la última posición y no se muestra error
  }
}

// Se detiene sola al salir de la pantalla y cuando la pestaña está oculta
usePolling(refreshTracking, POLL_MS);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

// ts viene en segundos
function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' });
}

// La velocidad llega en m/s: se pasa a km/h
function toKmh(ms: number): string {
  return `${Math.round(ms * 3.6)} km/h`;
}
</script>

<template>
  <main class="track-page">
    <div class="track-wrap">
      <RouterLink to="/" class="back">← Buscar otro envío</RouterLink>

      <!-- Cargando -->
      <section v-if="loading" class="sheet card" aria-busy="true">
        <p class="state"><span class="spinner" aria-hidden="true" /> Buscando el envío {{ code }}…</p>
      </section>

      <!-- Error -->
      <section v-else-if="error" class="sheet card">
        <p class="error" role="alert">{{ error }}</p>
        <button type="button" class="retry" @click="load">Reintentar</button>
      </section>

      <template v-else-if="shipment">
        <!-- Datos del envío -->
        <section class="sheet card">
          <p class="label">Código de seguimiento</p>
          <h1>{{ shipment.trackingCode }}</h1>
          <p class="status">{{ STATUS_LABELS[shipment.status] }}</p>

          <dl class="data">
            <div class="row">
              <dt>Descripción</dt>
              <dd>{{ shipment.description }}</dd>
            </div>
            <div class="row">
              <dt>Peso</dt>
              <dd>{{ shipment.weightKg }} kg</dd>
            </div>
          </dl>
        </section>

        <!-- Vuelo -->
        <section class="sheet card">
          <h2>Vuelo</h2>
          <template v-if="shipment.flight">
            <p class="route">
              {{ shipment.flight.origin.city }} ({{ shipment.flight.origin.iataCode }}) →
              {{ shipment.flight.destination.city }} ({{ shipment.flight.destination.iataCode }})
            </p>
            <dl class="data">
              <div class="row">
                <dt>Número de vuelo</dt>
                <dd>{{ shipment.flight.flightNumber }}</dd>
              </div>
              <div class="row">
                <dt>Salida</dt>
                <dd>{{ formatDate(shipment.flight.scheduledDeparture) }}</dd>
              </div>
              <div class="row">
                <dt>Llegada</dt>
                <dd>{{ formatDate(shipment.flight.scheduledArrival) }}</dd>
              </div>
            </dl>
          </template>
          <p v-else class="muted">Aún sin vuelo asignado</p>
        </section>

        <!-- Mapa: solo si el envío tiene vuelo -->
        <ShipmentMap
          v-if="shipment.flight"
          :origin="shipment.flight.origin"
          :destination="shipment.flight.destination"
          :live="tracking?.live ?? null"
        />

        <!-- Posición del avión -->
        <section class="sheet card">
          <h2>Posición del avión</h2>
          <p v-if="trackingFailed" class="muted">No se pudo consultar la posición del avión ahora.</p>
          <template v-else-if="tracking">
            <dl v-if="tracking.live" class="data">
              <div class="row">
                <dt>Latitud</dt>
                <dd>{{ tracking.live.lat.toFixed(4) }}</dd>
              </div>
              <div class="row">
                <dt>Longitud</dt>
                <dd>{{ tracking.live.lng.toFixed(4) }}</dd>
              </div>
              <div class="row">
                <dt>Altitud</dt>
                <dd>{{ tracking.live.alt !== null ? `${Math.round(tracking.live.alt)} m` : 'No disponible' }}</dd>
              </div>
              <div class="row">
                <dt>Velocidad</dt>
                <dd>{{ tracking.live.spd !== null ? toKmh(tracking.live.spd) : 'No disponible' }}</dd>
              </div>
              <div class="row">
                <dt>Hora de la posición</dt>
                <dd>{{ formatTs(tracking.live.ts) }}</dd>
              </div>
            </dl>
            <p v-else-if="tracking.reason" class="muted">{{ REASON_MESSAGES[tracking.reason] }}</p>
          </template>
        </section>

        <!-- Línea de tiempo -->
        <section class="sheet card">
          <h2>Historial</h2>
          <ShipmentTimeline :events="shipment.events" />
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
/* Mobile-first: la página hace scroll por dentro porque el body no tiene scroll */
.track-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}
.track-wrap {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.back {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--plane-selected);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
.label {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
}
.status {
  align-self: flex-start;
  margin: 0;
  padding: 2px 12px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--green);
  font-size: 14px;
  font-weight: 600;
}
.route {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.muted {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}
.data {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.row {
  padding: 10px 0;
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
  overflow-wrap: anywhere;
}
.state {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-2);
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
.retry {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: var(--text);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
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
  .track-page {
    padding: 24px;
  }
  .card {
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
