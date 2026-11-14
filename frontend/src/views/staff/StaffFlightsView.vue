<template>
  <div class="staff-flights">
    <h1>Vuelos</h1>

    <!-- Banner de error -->
    <div v-if="error" class="error-banner">
      <p>{{ error }}</p>
      <button @click="clearError">Descartar</button>
    </div>

    <!-- Indicador de carga inicial -->
    <div v-if="loading && flights.length === 0" class="loading">Cargando vuelos…</div>

    <!-- Filtros (opcional, básico) -->
    <div class="filters">
      <input v-model="filters.originIata" type="text" placeholder="Origen (IATA)" maxlength="3" />
      <input v-model="filters.destinationIata" type="text" placeholder="Destino (IATA)" maxlength="3" />
      <button @click="loadFlights" :disabled="loading">Filtrar</button>
    </div>

    <!-- Listado de vuelos -->
    <div class="flights-list">
      <div v-for="flight in flights" :key="flight.id" class="flight-card">
        <div class="flight-header">
          <h3>{{ flight.callsign }}</h3>
          <span :class="['status', flight.status]">{{ flight.status }}</span>
        </div>

        <div class="flight-details">
          <p><strong>Ruta:</strong> {{ flight.origin.iata || flight.origin.icao }} → {{ flight.destination.iata || flight.destination.icao }}</p>
          <p><strong>Salida:</strong> {{ formatTime(flight.departureTime) }}</p>
          <p><strong>Llegada:</strong> {{ formatTime(flight.arrivalTime) }}</p>
          <p><strong>Capacidad:</strong> {{ flight.capacityRemaining }} / {{ flight.totalCapacity }} disponible</p>
          <p v-if="flight.aircraftIcao24"><strong>Avión:</strong> {{ flight.aircraftIcao24 }}</p>
          <p v-else><strong>Avión:</strong> Sin asignar</p>
        </div>

        <!-- Formulario de asignación de avión -->
        <div class="assign-section">
          <h4>Asignar avión</h4>
          <div class="assign-form">
            <input
              :value="assignForms[flight.id]?.icao24 || ''"
              type="text"
              placeholder="Ingresa icao24"
              :disabled="assigningFlight === flight.id"
              @input="updateAssignForm(flight.id, 'icao24', ($event.target as HTMLInputElement).value)"
            />
            <button
              @click="assignAircraft(flight)"
              :disabled="!canAssign(flight)"
            >
              {{ assigningFlight === flight.id ? 'Asignando…' : 'Asignar' }}
            </button>
          </div>
          <div v-if="assignErrors[flight.id]" class="assign-error">
            {{ assignErrors[flight.id] }}
          </div>
        </div>
      </div>

      <div v-if="!loading && flights.length === 0" class="no-flights">
        No hay vuelos disponibles.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ApiError } from '../../services/api';
import * as flightApi from '../../services/flightApi';
import type { Flight } from '../../types/flights';

interface AssignForm {
  icao24: string;
}

const flights = ref<Flight[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const assigningFlight = ref<string | null>(null);
const assignForms = reactive<Record<string, AssignForm>>({});
const assignErrors = reactive<Record<string, string>>({});

const filters = reactive({
  originIata: '',
  destinationIata: '',
});

const canAssign = computed(() => (flight: Flight) => {
  const form = assignForms[flight.id];
  return form?.icao24?.trim().length === 6 && assigningFlight.value === null;
});

function updateAssignForm(flightId: string, key: string, value: string) {
  if (!assignForms[flightId]) assignForms[flightId] = { icao24: '' };
  if (key === 'icao24') assignForms[flightId]!.icao24 = value;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function loadFlights() {
  loading.value = true;
  error.value = null;
  try {
    const filtersObj = {
      originIata: filters.originIata || undefined,
      destinationIata: filters.destinationIata || undefined,
    };
    const response = await flightApi.fetchFlights(filtersObj);
    flights.value = response.flights;
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      error.value = e.message;
    } else {
      error.value = 'Error al cargar los vuelos';
    }
  } finally {
    loading.value = false;
  }
}

async function assignAircraft(flight: Flight) {
  const form = assignForms[flight.id];
  if (!form || !form.icao24) return;

  assigningFlight.value = flight.id;
  assignErrors[flight.id] = '';

  try {
    const updated = await flightApi.assignAircraftToFlight(flight.id, {
      icao24: form.icao24.toUpperCase(),
      expectedVersion: flight.expectedVersion,
    });

    const idx = flights.value.findIndex((f) => f.id === flight.id);
    if (idx !== -1) {
      flights.value[idx] = updated;
    }
    if (assignForms[flight.id]) {
      assignForms[flight.id]!.icao24 = '';
    }
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      if (e.code === 'VERSION_CONFLICT') {
        assignErrors[flight.id] = 'El vuelo fue modificado. Recarga para ver los cambios.';
      } else if (e.code === 'INVALID_AIRPORT') {
        assignErrors[flight.id] = 'El avión no está en un aeropuerto válido para este vuelo.';
      } else if (e.code === 'AIRCRAFT_NOT_FOUND') {
        assignErrors[flight.id] = 'Avión no encontrado.';
      } else {
        assignErrors[flight.id] = e.message;
      }
    } else {
      assignErrors[flight.id] = 'Error al asignar el avión';
    }
  } finally {
    assigningFlight.value = null;
  }
}

function clearError() {
  error.value = null;
}

onMounted(() => {
  loadFlights();
});
</script>

<style scoped>
.staff-flights {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1.5rem;
}

.error-banner {
  background: #fee;
  border: 1px solid #f88;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner button {
  background: #f88;
  color: white;
  border: none;
  border-radius: 0.25rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.loading {
  text-align: center;
  color: #666;
  padding: 2rem;
}

.filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.filters input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 0.25rem;
  font-size: 0.9rem;
}

.filters button {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.filters button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.flights-list {
  display: grid;
  gap: 1rem;
}

.flight-card {
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 1rem;
  background: white;
}

.flight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.flight-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status.scheduled {
  background: #e3f2fd;
  color: #1976d2;
}

.status.active {
  background: #f3e5f5;
  color: #7b1fa2;
}

.status.completed {
  background: #e8f5e9;
  color: #388e3c;
}

.status.cancelled {
  background: #ffebee;
  color: #d32f2f;
}

.flight-details {
  margin-bottom: 1rem;
}

.flight-details p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: #555;
}

.assign-section {
  border-top: 1px solid #eee;
  padding-top: 1rem;
}

.assign-section h4 {
  margin-top: 0;
  font-size: 0.95rem;
  color: #333;
}

.assign-form {
  display: flex;
  gap: 0.5rem;
}

.assign-form input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 0.25rem;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.assign-form button {
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.assign-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.assign-error {
  color: #d32f2f;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.no-flights {
  text-align: center;
  color: #999;
  padding: 2rem;
}
</style>
