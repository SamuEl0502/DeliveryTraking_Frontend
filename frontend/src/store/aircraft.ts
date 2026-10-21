import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { ApiError, fetchAircraft } from '../services/api';
import type { AircraftState } from '../types/aircraft';

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

  const total = computed(() => byIcao.value.size);
  const airborne = computed(() => [...byIcao.value.values()].filter((a) => !a.onGround));
  const selected = computed(() =>
    selectedIcao24.value ? (byIcao.value.get(selectedIcao24.value) ?? null) : null,
  );
  const hasData = computed(() => lastUpdated.value !== null);

  async function loadAircraft(): Promise<void> {
    if (loading.value) return; // evita peticiones solapadas
    loading.value = true;
    try {
      const { aircraft } = await fetchAircraft();
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
    total,
    airborne,
    selected,
    hasData,
    loadAircraft,
    select,
    clearSelection,
  };
});
