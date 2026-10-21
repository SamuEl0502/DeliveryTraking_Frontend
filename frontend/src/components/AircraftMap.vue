<script setup lang="ts">
import * as L from 'leaflet';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { extrapolate, isSignalLost, useSmoothedPosition } from '../composables/useSmoothedPosition';
import { useAircraftStore } from '../store/aircraft';
import type { AircraftState } from '../types/aircraft';

const MAX_MARKERS = 400;
const MAX_ANIMATED = 60; // además del avión seguido
const STALE_CHECK_MS = 5000;
const US_CENTER: L.LatLngTuple = [39.5, -98.35];

const emit = defineEmits<{ rendered: [count: number] }>();

const store = useAircraftStore();
const mapEl = ref<HTMLDivElement | null>(null);

// Instancias de Leaflet fuera de la reactividad de Vue (no necesitan proxies y serían más lentas)
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;
let staleTimer: ReturnType<typeof setInterval> | null = null;
const markers = new Map<string, L.Marker>();

// Cada fotograma, el composable entrega la posición suavizada y aquí se mueve el marcador
const smooth = useSmoothedPosition((id, pos) => markers.get(id)?.setLatLng([pos.lat, pos.lng]));

// Un único icono compartido: avión SVG apuntando al norte; se rota con CSS según el rumbo
const planeIcon = L.divIcon({
  className: 'plane-marker',
  html: '<div class="plane"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg></div>',
  iconSize: [40, 40], // área de toque; el SVG visible es de 22 px
  iconAnchor: [20, 20],
});

function applyState(marker: L.Marker, a: AircraftState, isSelected: boolean, lost: boolean): void {
  const el = marker.getElement();
  if (!el) return;
  const plane = el.firstElementChild;
  if (plane instanceof HTMLElement) plane.style.transform = `rotate(${a.hdg ?? 0}deg)`;
  el.classList.toggle('is-selected', isSelected);
  el.classList.toggle('is-ground', a.onGround);
  el.classList.toggle('is-stale', lost);
}

// Una sola etiqueta con el número de vuelo, ligada al marcador seguido (estilo FlightRadar24)
const label = L.tooltip({ permanent: true, direction: 'top', className: 'flight-label', offset: [0, -14] });
let labelOn: L.Marker | null = null;

function syncLabel(): void {
  const marker = store.selectedIcao24 ? markers.get(store.selectedIcao24) : undefined;
  const text = marker ? store.selectedLabel : null;
  if (labelOn && (labelOn !== marker || !text)) {
    labelOn.unbindTooltip();
    labelOn = null;
  }
  if (!marker || !text) return;
  label.setContent(text);
  if (labelOn !== marker) {
    marker.bindTooltip(label).openTooltip();
    labelOn = marker;
  }
  label.getElement()?.setAttribute('aria-hidden', 'true'); // decorativa: el panel ya lo dice
}

/** Solo vale la pena animar lo que se mueve y tiene señal reciente */
function canAnimate(a: AircraftState, now: number): boolean {
  return !a.onGround && a.spd !== null && a.hdg !== null && !isSignalLost(a, now);
}

/** Elige qué aviones dibujar y sincroniza los marcadores (crea, mueve o quita) */
function render(): void {
  if (!map || !layer) return;
  const now = Date.now();
  const bounds = map.getBounds().pad(0.05);
  const selectedId = store.selectedIcao24;

  const visible: AircraftState[] = [];
  // El avión seguido va primero y se dibuja siempre, aunque esté en tierra o fuera de la vista
  if (store.selected) visible.push(store.selected);
  for (const a of store.airborne) {
    if (visible.length >= MAX_MARKERS) break;
    if (a.icao24 !== selectedId && bounds.contains([a.lat, a.lng])) visible.push(a);
  }

  const keep = new Set<string>();
  let animated = 0;
  for (const a of visible) {
    const id = a.icao24;
    const isSelected = id === selectedId;
    keep.add(id);

    let marker = markers.get(id);
    if (!marker) {
      const start = extrapolate(a, now);
      marker = L.marker([start.lat, start.lng], { icon: planeIcon, keyboard: false });
      marker.on('click', () => store.select(id));
      marker.addTo(layer);
      markers.set(id, marker);
    }

    // El seguido siempre pasa por el composable (así también se suaviza su corrección)
    if (isSelected || (animated < MAX_ANIMATED && canAnimate(a, now))) {
      if (!isSelected) animated += 1;
      smooth.setState(a, marker.getLatLng());
    } else {
      smooth.remove(id);
      const pos = extrapolate(a, now); // sin animación: un solo cálculo por render
      marker.setLatLng([pos.lat, pos.lng]);
    }
    applyState(marker, a, isSelected, isSignalLost(a, now));
  }

  for (const [id, marker] of markers) {
    if (!keep.has(id)) {
      layer.removeLayer(marker);
      markers.delete(id);
      smooth.remove(id);
    }
  }

  syncLabel();
  emit('rendered', visible.length);
}

onMounted(() => {
  if (!mapEl.value) return;
  map = L.map(mapEl.value, { zoomControl: false }).setView(US_CENTER, 4);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  layer = L.layerGroup().addTo(map);

  map.on('moveend', render); // también se dispara al hacer zoom
  map.on('click', () => store.clearSelection()); // clic en zona vacía deja de seguir
  // La "señal perdida" depende del reloj, no solo de datos nuevos: se revisa cada 5 s
  staleTimer = setInterval(render, STALE_CHECK_MS);
  render();
});

/** Centra el mapa en un avión (lo usa el buscador); acerca hasta zoom 8 si se está más lejos */
function focus(a: AircraftState): void {
  const pos = extrapolate(a, Date.now());
  map?.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 8), { duration: 1 });
}
defineExpose({ focus });

watch(() => store.byIcao, render);
watch(() => store.selectedIcao24, render);
watch(() => store.selectedLabel, syncLabel);

onUnmounted(() => {
  if (staleTimer !== null) clearInterval(staleTimer);
  map?.remove();
  map = null;
  layer = null;
  markers.clear();
});
</script>

<template>
  <div ref="mapEl" class="map" />
</template>

<style scoped>
/* Leaflet necesita un contenedor con altura explícita */
.map {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  background: var(--map-bg);
}
</style>
