<script setup lang="ts">
import * as L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { OSM_ATTRIBUTION, OSM_TILES, PROTOMAPS_STYLE } from '../utils/basemap';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { LivePosition } from '../types/tracking';

interface MapAirport {
  iataCode: string;
  city: string;
  lat: number;
  lng: number;
}

const props = defineProps<{
  origin: MapAirport | null;
  destination: MapAirport | null;
  live: LivePosition | null;
}>();

const mapEl = ref<HTMLDivElement | null>(null);

// Instancias de Leaflet fuera de la reactividad de Vue
let map: L.Map | null = null;
let routeLayer: L.LayerGroup | null = null;
let plane: L.Marker | null = null;

// Sin origen y destino no hay mapa
const hasRoute = computed(() => props.origin !== null && props.destination !== null);
// Cambia solo si cambia la ruta (no en cada actualización de la posición)
const routeKey = computed(() =>
  props.origin && props.destination
    ? `${props.origin.iataCode}-${props.destination.iataCode}-${props.origin.lat}-${props.destination.lat}`
    : '',
);

// Silueta simple del avión, con la nariz al norte
const PLANE_PATH = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z';

function createMap(el: HTMLDivElement): void {
  // Sin zoom con la rueda: la página hace scroll y el mapa lo estorbaría
  map = L.map(el, { zoomControl: false, scrollWheelZoom: false });
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  // Fondo de Protomaps (2D: este mapa es pequeño y no necesita inclinarse); sin llave, OpenStreetMap
  if (PROTOMAPS_STYLE) maplibreGL({ style: PROTOMAPS_STYLE }).addTo(map);
  else L.tileLayer(OSM_TILES, { maxZoom: 18, attribution: OSM_ATTRIBUTION }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
}

// Origen, destino y la línea entre ellos
function drawRoute(): void {
  if (!routeLayer) return;
  routeLayer.clearLayers();
  const { origin, destination } = props;
  if (!origin || !destination) return;
  L.polyline(
    [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ],
    { color: '#1f6feb', weight: 3, dashArray: '6 8', interactive: false },
  ).addTo(routeLayer);
  for (const ap of [origin, destination]) {
    L.circleMarker([ap.lat, ap.lng], { radius: 6, className: 'route-airport' })
      .bindTooltip(ap.iataCode, { permanent: true, direction: 'top', className: 'airport-label' })
      .addTo(routeLayer);
  }
}

function planeIcon(live: LivePosition): L.DivIcon {
  return L.divIcon({
    className: live.onGround ? 'plane-marker is-ground' : 'plane-marker',
    html: `<div class="plane" style="--size:26px;transform:rotate(${live.hdg ?? 0}deg)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLANE_PATH}"/></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
  });
}

// Solo números y fechas, no hay texto de usuarios dentro del HTML
function popupHtml(live: LivePosition): string {
  const alt = live.alt !== null ? `${Math.round(live.alt)} m` : 'No disponible';
  const spd = live.spd !== null ? `${Math.round(live.spd * 3.6)} km/h` : 'No disponible';
  const time = new Date(live.ts * 1000).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' });
  return `<strong>Avión</strong><br>Altitud: ${alt}<br>Velocidad: ${spd}<br>Hora: ${time}`;
}

function removePlane(): void {
  plane?.remove();
  plane = null;
}

// Crea el marcador la primera vez y después solo lo mueve
function drawPlane(): void {
  const live = props.live;
  if (!map || !live || !hasRoute.value) {
    removePlane();
    return;
  }
  if (!plane) {
    plane = L.marker([live.lat, live.lng], { icon: planeIcon(live), keyboard: false })
      .bindPopup(popupHtml(live))
      .addTo(map);
  } else {
    plane.setLatLng([live.lat, live.lng]);
    plane.setIcon(planeIcon(live));
    plane.setPopupContent(popupHtml(live));
  }
}

// Zoom para que se vean los dos aeropuertos y el avión
function fit(): void {
  const { origin, destination, live } = props;
  if (!map || !origin || !destination) return;
  const points: L.LatLngTuple[] = [
    [origin.lat, origin.lng],
    [destination.lat, destination.lng],
  ];
  if (live) points.push([live.lat, live.lng]);
  map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 8 });
}

// Se ejecuta al montar y cuando cambia la ruta
async function syncRoute(): Promise<void> {
  await nextTick(); // espera a que el contenedor ya se vea
  if (!mapEl.value) return;
  if (!hasRoute.value) {
    routeLayer?.clearLayers();
    removePlane();
    return;
  }
  if (!map) createMap(mapEl.value);
  map?.invalidateSize();
  drawRoute();
  drawPlane();
  fit();
}

onMounted(syncRoute);
watch(routeKey, syncRoute);

// Cada actualización mueve el avión; el zoom solo se ajusta cuando el avión aparece
watch(
  () => props.live,
  () => {
    const wasHidden = plane === null;
    drawPlane();
    if (wasHidden && plane) fit();
  },
);

onUnmounted(() => {
  map?.remove();
  map = null;
  routeLayer = null;
  plane = null;
});
</script>

<template>
  <div v-show="hasRoute" ref="mapEl" class="sheet map" role="region" aria-label="Mapa del envío" />
</template>

<style scoped>
/* Leaflet necesita un contenedor con altura explícita */
.map {
  position: relative;
  isolation: isolate; /* los z-index internos de Leaflet no pasan por encima de la cabecera */
  width: 100%;
  height: 280px;
  overflow: hidden;
  background: var(--map-bg);
}

@media (min-width: 768px) {
  .map {
    height: 360px;
  }
}
</style>
