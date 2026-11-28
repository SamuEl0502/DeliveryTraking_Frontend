import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { ApiError, fetchAircraft } from '../services/api';
import { fetchFlights } from '../services/flightApi';
import type { AircraftState } from '../types/aircraft';
import type { Airport } from '../types/flightDetails';
import type { Flight } from '../types/flights';

const normalizeIcao24 = (value: string) => value.trim().toLowerCase();
const normalizeCallsign = (value: string) => value.trim().toUpperCase();

export const useAircraftStore = defineStore('aircraft', () => {
  // Normalizado por icao24. shallowRef: Vue no envuelve en proxies los ~4400 objetos,
  // solo reacciona cuando se reemplaza el Map completo (una vez por ciclo de polling).
  const byIcao = shallowRef<ReadonlyMap<string, AircraftState>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<number | null>(null); // Date.now() del último éxito
  const selectedIcao24 = ref<string | null>(null);
  // Número de vuelo que muestra el panel; el mapa lo usa para la etiqueta del avión seguido
  const selectedLabel = ref<string | null>(null);
  // Ruta confirmada del avión seguido (la pone el panel); destination null = solo se conoce el despegue
  const selectedRoute = shallowRef<{ origin: Airport; destination: Airport | null } | null>(null);
  // Filtro de aerolínea: 'FDX' para FedEx, null para todos
  const airline = ref<string | null>(null);

  const total = computed(() => byIcao.value.size);
  const airborne = computed(() => [...byIcao.value.values()].filter((a) => !a.onGround));
  const selected = computed(() =>
    selectedIcao24.value ? (byIcao.value.get(selectedIcao24.value) ?? null) : null,
  );
  const hasData = computed(() => lastUpdated.value !== null);

  // Vuelos con envíos nuestros; null mientras no haya llegado la primera respuesta
  const shipmentFlights = shallowRef<Flight[] | null>(null);
  const loadingShipmentFlights = ref(false);
  const shipmentFlightsError = ref<string | null>(null);
  const onlyOurs = ref(true); // casilla "Solo envíos nuestros"
  // Si la carga de vuelos falló no se filtra: se ven todos los aviones
  const filterActive = computed(() => onlyOurs.value && shipmentFlightsError.value === null);

  // Claves para reconocer un avión nuestro: icao24 o callsign de alguno de esos vuelos
  const ourKeys = computed(() => {
    const icao24s = new Set<string>();
    const callsigns = new Set<string>();
    for (const f of shipmentFlights.value ?? []) {
      if (f.aircraftIcao24) icao24s.add(normalizeIcao24(f.aircraftIcao24));
      const callsign = f.callsign ? normalizeCallsign(f.callsign) : '';
      if (callsign) callsigns.add(callsign);
    }
    return { icao24s, callsigns };
  });

  function isOurs(a: AircraftState): boolean {
    const { icao24s, callsigns } = ourKeys.value;
    if (icao24s.has(normalizeIcao24(a.icao24))) return true;
    return a.callsign !== null && callsigns.has(normalizeCallsign(a.callsign));
  }

  // Solo para mostrar (mapa y buscador): byIcao y airborne conservan todos los aviones
  const visibleAirborne = computed(() =>
    filterActive.value ? airborne.value.filter(isOurs) : airborne.value,
  );

  // Si el avión seguido queda oculto por el filtro, se deja de seguir
  watch(
    () => filterActive.value && selected.value !== null && !isOurs(selected.value),
    (hidden) => {
      if (hidden) clearSelection();
    },
  );

  async function loadShipmentFlights(): Promise<void> {
    if (loadingShipmentFlights.value) return;
    loadingShipmentFlights.value = true;
    try {
      const { flights } = await fetchFlights({ withShipments: true, limit: 100 });
      shipmentFlights.value = flights;
      shipmentFlightsError.value = null;
    } catch (e: unknown) {
      shipmentFlightsError.value = e instanceof ApiError ? e.message : 'Error inesperado';
    } finally {
      loadingShipmentFlights.value = false;
    }
  }

  async function loadAircraft(): Promise<void> {
    if (loading.value) return; // evita peticiones solapadas
    loading.value = true;
    try {
      const { aircraft } = await fetchAircraft(airline.value ?? undefined);
      const next = new Map<string, AircraftState>();
      for (const a of aircraft) next.set(a.icao24, a);
      // Si el avión seguido no vino en este lote, se conserva su último estado conocido
      const followed = selectedIcao24.value;
      const previous = followed ? byIcao.value.get(followed) : undefined;
      if (followed && previous && !next.has(followed)) next.set(followed, previous);
      byIcao.value = next;
      lastUpdated.value = Date.now();
      error.value = null;
    } catch (e: unknown) {
      // Se conservan los últimos datos: la pantalla sigue mostrando el mapa
      error.value = e instanceof ApiError ? e.message : 'Error inesperado';
    } finally {
      loading.value = false;
    }
  }

  function toggleAirline(code: string | null): void {
    airline.value = airline.value === code ? null : code;
    void loadAircraft();
  }

  function select(icao24: string): void {
    selectedIcao24.value = icao24;
  }

  function clearSelection(): void {
    selectedIcao24.value = null;
  }

  return {
    byIcao,
    loading,
    error,
    lastUpdated,
    selectedIcao24,
    selectedLabel,
    selectedRoute,
    airline,
    total,
    airborne,
    selected,
    hasData,
    shipmentFlights,
    loadingShipmentFlights,
    shipmentFlightsError,
    onlyOurs,
    filterActive,
    visibleAirborne,
    loadShipmentFlights,
    loadAircraft,
    select,
    clearSelection,
    toggleAirline,
  };
});
