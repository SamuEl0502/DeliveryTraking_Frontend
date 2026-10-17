<script setup lang="ts">
import * as L from 'leaflet';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useAircraftStore } from '../store/aircraft';
import type { AircraftState } from '../types/aircraft';

const MAX_MARKERS = 400;
const US_CENTER: L.LatLngTuple = [39.5, -98.35];

const emit = defineEmits<{ rendered: [count: number] }>();

const store = useAircraftStore();
const mapEl = ref<HTMLDivElement | null>(null);

// Instancias de Leaflet fuera de la reactividad de Vue (no necesitan proxies y serían más lentas)
let map: L.Map | null = null;
let layer: L.LayerGroup | null = null;
const markers = new Map<string, L.Marker>();

// Un único icono compartido: avión SVG apuntando al norte; se rota con CSS según el rumbo
const planeIcon = L.divIcon({
  className: 'plane-marker',
  html: '<div class="plane"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg></div>',
  iconSize: [40, 40], // área de toque; el SVG visible es de 22 px
  iconAnchor: [20, 20],
});

function applyState(marker: L.Marker, a: AircraftState, isSelected: boolean): void {
  const el = marker.getElement();
  if (!el) return;
  const plane = el.firstElementChild;
  if (plane instanceof HTMLElement) plane.style.transform = `rotate(${a.hdg ?? 0}deg)`;
  el.classList.toggle('is-selected', isSelected);
  el.classList.toggle('is-ground', a.onGround);
}

/** Elige qué aviones dibujar y sincroniza los marcadores (crea, mueve o quita) */
function render(): void {
  if (!map || !layer) return;
  const bounds = map.getBounds().pad(0.05);
  const selectedId = store.selectedIcao24;

  const visible: AircraftState[] = [];
  for (const a of store.airborne) {
    if (visible.length >= MAX_MARKERS) break;
    if (a.icao24 !== selectedId && bounds.contains([a.lat, a.lng])) visible.push(a);
  }
  // El avión seguido se dibuja siempre, aunque esté en tierra o fuera de la vista
  if (store.selected) visible.push(store.selected);

  const keep = new Set<string>();
  for (const a of visible) {
    keep.add(a.icao24);
    let marker = markers.get(a.icao24);
    if (marker) {
      marker.setLatLng([a.lat, a.lng]);
    } else {
      const id = a.icao24;
      marker = L.marker([a.lat, a.lng], { icon: planeIcon, keyboard: false });
      marker.on('click', () => store.select(id));
      marker.addTo(layer);
      markers.set(id, marker);
    }
    applyState(marker, a, a.icao24 === selectedId);
  }

  for (const [id, marker] of markers) {
    if (!keep.has(id)) {
      layer.removeLayer(marker);
      markers.delete(id);
    }
  }

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
  render();
});

watch(() => store.byIcao, render);
watch(() => store.selectedIcao24, render);

onUnmounted(() => {
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
