<script setup lang="ts">
import { computed, ref } from 'vue';
import AircraftMap from '../components/AircraftMap.vue';
import AircraftPanel from '../components/AircraftPanel.vue';
import FlightSearch from '../components/FlightSearch.vue';
import { usePolling } from '../composables/usePolling';
import { useAircraftStore } from '../store/aircraft';
import type { AircraftState } from '../types/aircraft';

const POLL_INTERVAL_MS = 10_000;

const store = useAircraftStore();
const onScreen = ref(0);
const mapRef = ref<InstanceType<typeof AircraftMap> | null>(null);

function followFlight(a: AircraftState): void {
  store.select(a.icao24);
  mapRef.value?.focus(a);
}

usePolling(store.loadAircraft, POLL_INTERVAL_MS);

const num = new Intl.NumberFormat('es');
const timeFmt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const updatedAt = computed(() =>
  store.lastUpdated === null ? null : timeFmt.format(store.lastUpdated),
);
const firstLoad = computed(() => store.loading && !store.hasData);
</script>

<template>
  <main class="map-view">
    <AircraftMap ref="mapRef" @rendered="onScreen = $event" />

    <!-- Columna superior: resumen con buscador y, debajo, el aviso de error -->
    <div class="top">
    <section class="sheet summary">
      <h1>En el aire</h1>
      <p class="subtitle">
        <template v-if="store.hasData">
          <strong>{{ num.format(store.airborne.length) }}</strong> aviones sobre EE. UU. ·
          <strong>{{ num.format(onScreen) }}</strong> en pantalla
        </template>
        <template v-else>Aviones en vivo desde OpenSky</template>
      </p>
      <p class="meta">
        <span v-if="store.loading" class="spinner" aria-hidden="true" />
        <span v-if="updatedAt">Actualizado {{ updatedAt }}</span>
        <span v-else-if="!store.loading">Sin datos todavía</span>
        <span v-else>Cargando…</span>
      </p>
      <FlightSearch v-if="store.hasData" @pick="followFlight" />
    </section>

    <div v-if="store.error" class="sheet banner" role="alert">
      <div>
        <p class="banner-title">Sin conexión con el servidor</p>
        <p class="banner-text">
          {{ store.error }}.
          <template v-if="updatedAt">Mostrando datos de las {{ updatedAt }}.</template>
          Se reintenta cada 10 s.
        </p>
      </div>
      <button type="button" class="retry" :disabled="store.loading" @click="store.loadAircraft()">
        Reintentar
      </button>
    </div>
    </div>

    <div v-if="firstLoad" class="sheet loading" role="status">
      <span class="spinner" aria-hidden="true" />
      Cargando aviones…
    </div>

    <AircraftPanel v-if="store.selected" :aircraft="store.selected" @close="store.clearSelection()" />
  </main>
</template>

<style scoped>
/* Mobile-first: estilos base para móvil, ajustes de escritorio desde 768 px */
.map-view {
  position: relative;
  height: 100%;
  overflow: hidden;
}
.top {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.summary {
  padding: 14px 18px;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.subtitle {
  margin: 2px 0 6px;
  font-size: 14px;
  color: var(--text-2);
}
.subtitle strong {
  color: var(--text);
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  color: var(--green);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-line);
}
.banner > div {
  flex: 1 1 200px;
  min-width: 0;
}
.banner-title {
  margin: 0;
  font-weight: 700;
  color: var(--danger);
}
.banner-text {
  margin: 2px 0 0;
  font-size: 14px;
  color: var(--text-2);
}
.retry {
  flex: none;
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  padding: 0 18px;
  background: var(--danger);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.retry:disabled {
  opacity: 0.6;
  cursor: progress;
}
.loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 999px;
  font-weight: 600;
  white-space: nowrap;
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
  .top {
    top: 16px;
    left: 16px;
    right: auto;
    width: 360px;
  }
  .summary {
    padding: 16px 20px;
  }
  h1 {
    font-size: 30px;
  }
  .subtitle {
    font-size: 15px;
  }
}
</style>
