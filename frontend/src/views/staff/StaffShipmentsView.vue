<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { ApiError } from '../../services/api';
import { assignShipment, fetchFlights, fetchShipments, unassignShipment } from '../../services/assignmentApi';
import type { AssignFlight, Pagination, StaffShipment } from '../../types/assignment';
import type { ShipmentStatus } from '../../types/shipment';

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  RECEIVED: 'Recibido',
  LOADED: 'Cargado',
  IN_FLIGHT: 'En vuelo',
  UNLOADED: 'Descargado',
  DELIVERED: 'Entregado',
};
const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as ShipmentStatus[];

// Mensaje en español para cada código de error del backend
const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Los datos enviados no son válidos.',
  UNAUTHORIZED: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  FORBIDDEN_AIRPORT: 'Tu usuario no tiene un aeropuerto asignado. Pide a un administrador que te asigne uno.',
  SHIPMENT_NOT_FOUND: 'No se encontró el envío.',
  FLIGHT_NOT_FOUND: 'No se encontró el vuelo.',
  VERSION_CONFLICT: 'El vuelo cambió mientras lo veías. Ya recargamos los vuelos; revisa y vuelve a intentar.',
  FLIGHT_NOT_AVAILABLE: 'El vuelo ya no está disponible para asignar envíos.',
  ROUTE_MISMATCH: 'La ruta del vuelo no coincide con la del envío.',
  SHIPMENT_NOT_ASSIGNABLE: 'Este envío ya no se puede asignar a un vuelo.',
  ALREADY_ASSIGNED: 'El envío ya está asignado a ese vuelo.',
  INSUFFICIENT_CAPACITY: 'El vuelo no tiene capacidad suficiente para el peso de este envío.',
  SHIPMENT_NOT_ASSIGNED: 'El envío no tenía un vuelo asignado.',
};

function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Ocurrió un error inesperado';
  if (e.code && ERROR_MESSAGES[e.code]) return ERROR_MESSAGES[e.code] ?? e.message;
  return e.message;
}

const LIMIT = 20;

// Lista de envíos
const statusFilter = ref<ShipmentStatus>('RECEIVED');
const page = ref(1);
const shipments = ref<StaffShipment[]>([]);
const pagination = ref<Pagination | null>(null);
const loadingList = ref(true);
const listError = ref<string | null>(null);
const noAirport = ref(false); // FORBIDDEN_AIRPORT: no tiene sentido reintentar

// Envío elegido y sus vuelos
const selected = ref<StaffShipment | null>(null);
const flights = ref<AssignFlight[]>([]);
const loadingFlights = ref(false);
const flightsError = ref<string | null>(null);
const flightsSection = ref<HTMLElement | null>(null);

// Acciones (asignar / quitar)
const busy = ref(false);
const busyFlightId = ref<string | null>(null);
const notice = ref<string | null>(null);
const actionError = ref<string | null>(null);

// Para ignorar respuestas viejas si el usuario cambia de página o de envío
let listLoad = 0;
let flightsLoad = 0;

const canPrev = computed(() => page.value > 1);
const canNext = computed(() => pagination.value !== null && page.value < pagination.value.totalPages);

async function loadShipments(): Promise<void> {
  const thisLoad = ++listLoad;
  loadingList.value = true;
  listError.value = null;
  noAirport.value = false;
  try {
    const res = await fetchShipments({ status: statusFilter.value, page: page.value, limit: LIMIT });
    if (thisLoad !== listLoad) return;
    shipments.value = res.shipments;
    pagination.value = res.pagination;
    // Si el envío elegido sigue en la lista, se actualiza su información
    if (selected.value) {
      const id = selected.value.id;
      selected.value = res.shipments.find((s) => s.id === id) ?? selected.value;
    }
  } catch (e: unknown) {
    if (thisLoad !== listLoad) return;
    shipments.value = [];
    pagination.value = null;
    noAirport.value = e instanceof ApiError && e.code === 'FORBIDDEN_AIRPORT';
    listError.value = errorText(e);
  } finally {
    if (thisLoad === listLoad) loadingList.value = false;
  }
}

async function loadFlights(): Promise<void> {
  const shipment = selected.value;
  if (!shipment) return;
  const thisLoad = ++flightsLoad;
  loadingFlights.value = true;
  flightsError.value = null;
  try {
    const res = await fetchFlights({
      origin: shipment.origin.iataCode,
      destination: shipment.destination.iataCode,
      minCapacityKg: shipment.weightKg,
      limit: 50,
    });
    if (thisLoad !== flightsLoad) return;
    // Solo los programados que todavía no han salido
    const now = Date.now();
    flights.value = res.flights.filter((f) => f.status === 'SCHEDULED' && Date.parse(f.scheduledDeparture) > now);
  } catch (e: unknown) {
    if (thisLoad !== flightsLoad) return;
    flights.value = [];
    flightsError.value = errorText(e);
  } finally {
    if (thisLoad === flightsLoad) loadingFlights.value = false;
  }
}

function onFilterChange(): void {
  page.value = 1;
  selected.value = null;
  flights.value = [];
  notice.value = null;
  actionError.value = null;
  void loadShipments();
}

function goToPage(next: number): void {
  page.value = next;
  void loadShipments();
}

async function selectShipment(shipment: StaffShipment): Promise<void> {
  if (busy.value) return;
  selected.value = shipment;
  notice.value = null;
  actionError.value = null;
  flights.value = [];
  void loadFlights();
  // En el celular los vuelos quedan debajo de la lista: se baja hasta ellos
  await nextTick();
  flightsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function onAssign(flight: AssignFlight): Promise<void> {
  const shipment = selected.value;
  if (!shipment || busy.value) return;
  const wasReassign = shipment.hasFlight;
  busy.value = true;
  busyFlightId.value = flight.id;
  notice.value = null;
  actionError.value = null;
  try {
    await assignShipment({
      shipmentId: shipment.id,
      flightId: flight.id,
      expectedFlightVersion: flight.version,
    });
    notice.value = wasReassign
      ? `Envío ${shipment.trackingCode} reasignado al vuelo ${flight.flightNumber}.`
      : `Envío ${shipment.trackingCode} asignado al vuelo ${flight.flightNumber}.`;
    selected.value = { ...shipment, hasFlight: true };
    await Promise.all([loadShipments(), loadFlights()]);
  } catch (e: unknown) {
    actionError.value = errorText(e);
    // El vuelo cambió: se recarga para ver la version nueva
    if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') await loadFlights();
  } finally {
    busy.value = false;
    busyFlightId.value = null;
  }
}

async function onUnassign(): Promise<void> {
  const shipment = selected.value;
  if (!shipment || busy.value) return;
  busy.value = true;
  notice.value = null;
  actionError.value = null;
  try {
    await unassignShipment(shipment.id);
    notice.value = `Se quitó el vuelo del envío ${shipment.trackingCode}.`;
    selected.value = { ...shipment, hasFlight: false };
    await Promise.all([loadShipments(), loadFlights()]);
  } catch (e: unknown) {
    actionError.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

// Hora local del aeropuerto, en formato es-CO
function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });
}

onMounted(loadShipments);
</script>

<template>
  <main class="staff-page">
    <div class="staff-wrap">
      <h1>Envíos por asignar</h1>

      <!-- Lista de envíos -->
      <section class="sheet card" aria-labelledby="list-title">
        <h2 id="list-title">Envíos</h2>

        <label class="field">
          <span class="label">Estado</span>
          <select v-model="statusFilter" :disabled="loadingList || busy" @change="onFilterChange">
            <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
          </select>
        </label>

        <p v-if="loadingList" class="state" aria-busy="true"><span class="spinner" aria-hidden="true" /> Cargando envíos…</p>

        <template v-else-if="listError">
          <p class="error" role="alert">{{ listError }}</p>
          <button v-if="!noAirport" type="button" class="secondary" @click="loadShipments">Reintentar</button>
        </template>

        <p v-else-if="shipments.length === 0" class="muted">No hay envíos con estado «{{ STATUS_LABELS[statusFilter] }}».</p>

        <template v-else>
          <ul class="list">
            <li v-for="s in shipments" :key="s.id">
              <button
                type="button"
                class="item"
                :class="{ active: selected?.id === s.id }"
                :disabled="busy"
                :aria-pressed="selected?.id === s.id"
                @click="selectShipment(s)"
              >
                <span class="item-top">
                  <strong class="code">{{ s.trackingCode }}</strong>
                  <span class="badge" :class="s.hasFlight ? 'with' : 'without'">
                    {{ s.hasFlight ? 'Con vuelo' : 'Sin vuelo' }}
                  </span>
                </span>
                <span class="item-route">{{ s.origin.iataCode }} → {{ s.destination.iataCode }} · {{ s.weightKg }} kg</span>
              </button>
            </li>
          </ul>

          <div v-if="pagination && pagination.totalPages > 1" class="pager">
            <button type="button" class="secondary" :disabled="!canPrev || loadingList" @click="goToPage(page - 1)">
              Anterior
            </button>
            <span class="muted">Página {{ pagination.page }} de {{ pagination.totalPages }}</span>
            <button type="button" class="secondary" :disabled="!canNext || loadingList" @click="goToPage(page + 1)">
              Siguiente
            </button>
          </div>
        </template>
      </section>

      <!-- Vuelos del envío elegido -->
      <section ref="flightsSection" class="sheet card" aria-labelledby="flights-title">
        <h2 id="flights-title">Vuelos disponibles</h2>

        <p v-if="!selected" class="muted">Elige un envío de la lista para ver los vuelos de su ruta.</p>

        <template v-else>
          <p class="route">
            {{ selected.trackingCode }}: {{ selected.origin.city }} ({{ selected.origin.iataCode }}) →
            {{ selected.destination.city }} ({{ selected.destination.iataCode }}) · {{ selected.weightKg }} kg
          </p>

          <p v-if="notice" class="success" role="status">{{ notice }}</p>
          <p v-if="actionError" class="error" role="alert">{{ actionError }}</p>

          <button v-if="selected.hasFlight" type="button" class="danger" :disabled="busy" @click="onUnassign">
            {{ busy && busyFlightId === null ? 'Quitando…' : 'Quitar vuelo' }}
          </button>

          <p v-if="loadingFlights" class="state" aria-busy="true"><span class="spinner" aria-hidden="true" /> Buscando vuelos…</p>

          <template v-else-if="flightsError">
            <p class="error" role="alert">{{ flightsError }}</p>
            <button type="button" class="secondary" @click="loadFlights">Reintentar</button>
          </template>

          <p v-else-if="flights.length === 0" class="muted">
            No hay vuelos programados con capacidad suficiente para esta ruta.
          </p>

          <ul v-else class="list">
            <li v-for="f in flights" :key="f.id" class="flight">
              <div class="flight-top">
                <strong class="code">{{ f.flightNumber }}</strong>
                <span class="muted">Quedan {{ f.remainingCapacityKg }} kg</span>
              </div>
              <dl class="data">
                <div class="row">
                  <dt>Salida ({{ f.origin.iataCode }})</dt>
                  <dd>{{ formatTime(f.scheduledDeparture, f.origin.timezone) }}</dd>
                </div>
                <div class="row">
                  <dt>Llegada ({{ f.destination.iataCode }})</dt>
                  <dd>{{ formatTime(f.scheduledArrival, f.destination.timezone) }}</dd>
                </div>
              </dl>
              <button type="button" class="primary" :disabled="busy" @click="onAssign(f)">
                {{ busyFlightId === f.id ? 'Enviando…' : selected.hasFlight ? 'Reasignar' : 'Asignar' }}
              </button>
            </li>
          </ul>
        </template>
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
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
.label {
  font-size: 13px;
  color: var(--text-2);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.muted {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}
.route {
  margin: 0;
  font-size: 15px;
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
.success {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface-2);
  color: var(--green);
  font-size: 14px;
  font-weight: 600;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}
.item.active {
  border-color: var(--plane-selected);
  box-shadow: 0 0 0 1px var(--plane-selected);
}
.item:disabled {
  opacity: 0.6;
  cursor: progress;
}
.item-top,
.flight-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.item-route {
  font-size: 14px;
  color: var(--text-2);
}
.code {
  font-size: 16px;
  overflow-wrap: anywhere;
}
.badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.badge.with {
  color: var(--green);
}
.badge.without {
  color: var(--warning);
}
.flight {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.data {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.row {
  padding: 6px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
dt {
  font-size: 13px;
  color: var(--text-2);
}
dd {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.primary,
.secondary,
.danger {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.primary {
  border: 0;
  background: var(--text);
  color: #fff;
}
.secondary {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
}
.danger {
  border: 1px solid var(--danger-line);
  background: var(--danger-bg);
  color: var(--danger);
}
.primary:disabled,
.secondary:disabled,
.danger:disabled {
  opacity: 0.6;
  cursor: progress;
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
  .staff-page {
    padding: 24px;
  }
  .card {
    padding: 28px;
  }
  /* En escritorio la lista y los vuelos van lado a lado */
  .staff-wrap {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
  h1 {
    grid-column: 1 / -1;
  }
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
