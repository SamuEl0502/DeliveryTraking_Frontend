<script setup lang="ts">
import * as L from 'leaflet';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { extrapolate, isSignalLost, useSmoothedPosition } from '../composables/useSmoothedPosition';
import { useAircraftStore } from '../store/aircraft';
import { fetchAircraftTrack } from '../services/api';
import type { AircraftState, TrackPoint } from '../types/aircraft';
import { type AircraftClass, classOf } from '../utils/aircraftClass';
import { ALT_BANDS, altColor } from '../utils/altitude';
import { greatCircle } from '../utils/greatCircle';

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

// Siluetas propias vistas desde arriba, apuntando al norte; se rotan con CSS según el rumbo.
// El tamaño de cada clase está en main.css (.c-light, .c-jumbo...)
const AIRLINER = 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z';
const WIDE = 'M12 1c-.9 0-1.6.8-1.6 1.8V9L1 14v2.2l9.4-2.6V19l-2.6 2v1.5l3.2-1 3.2 1V21l-2.6-2v-5.4l9.4 2.6V14l-9.4-5V2.8C13.6 1.8 12.9 1 12 1z';
const SHAPES: Record<AircraftClass | 'generic', string> = {
  generic: AIRLINER,
  narrow: AIRLINER,
  wide: WIDE,
  // Ancho como el wide, con cuatro motores
  jumbo: `${WIDE}M6.2 11.6h1.6v2.4H6.2zM16.2 11.6h1.6v2.4h-1.6zM3 13.4h1.4v2H3zM19.6 13.4H21v2h-1.4z`,
  regional: 'M12 2c-.7 0-1.2.6-1.2 1.4V10L2 12.5v1.8l8.8-1.2V19l-2.3 1.6V22l3.5-.8 3.5.8v-1.4L13.2 19v-5.9l8.8 1.2v-1.8L13.2 10V3.4C13.2 2.6 12.7 2 12 2z',
  business: 'M12 2c-.6 0-1 .7-1 1.6V11l-6 4v1.4l6-1.6V19l-2 1.4V22l3-.8 3 .8v-1.6L13 19v-4.2l6 1.6V15l-6-4V3.6C13 2.7 12.6 2 12 2z',
  // Ala alta y recta de avioneta
  light: 'M11 3h2v5h9v2.2h-9V18h3.5v2h-9v-2H11v-7.8H2V8h9z',
  // Cabina y cola más el rotor en X
  heli: 'M12 4a1.8 1.8 0 0 1 1.8 1.8V11a1.8 1.8 0 0 1-1 1.6V20h2v1.4H9.2V20h2v-7.4a1.8 1.8 0 0 1-1-1.6V5.8A1.8 1.8 0 0 1 12 4zM3.6 2.2l18.2 18.2-1.4 1.4L2.2 3.6zM20.4 2.2l1.4 1.4L3.6 21.8l-1.4-1.4z',
};

// Un divIcon por clase, creado una vez: 400 marcadores comparten 8 iconos. Los estados son clases CSS
const icons = Object.fromEntries(
  Object.entries(SHAPES).map(([cls, d]) => [
    cls,
    L.divIcon({
      className: 'plane-marker',
      html: `<div class="plane c-${cls}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></div>`,
      iconSize: [40, 40], // área de toque; el avión visible es más pequeño
      iconAnchor: [20, 20],
    }),
  ]),
) as Record<AircraftClass | 'generic', L.DivIcon>;
const iconFor = (a: AircraftState) => icons[classOf(a.type) ?? 'generic'];

function applyState(marker: L.Marker, a: AircraftState, isSelected: boolean, lost: boolean): void {
  const el = marker.getElement();
  if (!el) return;
  const plane = el.firstElementChild;
  if (plane instanceof HTMLElement) plane.style.transform = `rotate(${a.hdg ?? 0}deg)`;
  el.classList.toggle('is-selected', isSelected);
  el.classList.toggle('is-ground', a.onGround);
  el.classList.toggle('is-stale', lost);
  // Color por altitud; la selección y la señal perdida lo tapan desde el CSS
  el.style.setProperty('--alt-color', altColor(a.alt, a.onGround) ?? '');
}

// Ruta y estela del avión seguido. Las líneas van en overlayPane, debajo de los marcadores
const TRACK_REFRESH_MS = 60_000;
const LIVE_MAX = 500;
let overlay: L.LayerGroup | null = null;
// Estela = recorrido de OpenSky desde el despegue (/track) + posiciones reales del polling.
// Solo posiciones reales con su ts: la suavizada haría zigzags al corregirse
let track: TrackPoint[] = [];
let live: TrackPoint[] = [];
let trackTimer: ReturnType<typeof setInterval> | null = null;
let trackController: AbortController | null = null;

function stopTrack(): void {
  if (trackTimer !== null) clearInterval(trackTimer);
  trackTimer = null;
  trackController?.abort();
  trackController = null;
  track = [];
  live = [];
}

/** Al seleccionar: pide el recorrido una vez y luego cada 60 s; si falla (404 TRACK_NOT_FOUND), solo la estela en vivo */
function startTrack(icao24: string): void {
  stopTrack();
  const load = () => {
    trackController?.abort();
    const controller = (trackController = new AbortController());
    fetchAircraftTrack(icao24, controller.signal)
      .then((t) => {
        if (controller.signal.aborted) return;
        track = t.path;
        const lastTs = track.at(-1)?.ts ?? 0;
        live = live.filter((p) => p.ts > lastTs);
        drawOverlay();
      })
      .catch(() => {}); // sin recorrido se dibuja solo lo que llega en vivo
  };
  load();
  trackTimer = setInterval(load, TRACK_REFRESH_MS);
}

function drawOverlay(): void {
  if (!overlay) return;
  overlay.clearLayers();
  const a = store.selected;
  const pos = a ? markers.get(a.icao24)?.getLatLng() : undefined;
  if (!a || !pos) return;

  // Punto real nuevo solo cuando cambia ts
  const lastTs = (live.at(-1) ?? track.at(-1))?.ts ?? 0;
  if (a.ts > lastTs) {
    live.push({ ts: a.ts, lat: a.lat, lng: a.lng, alt: a.alt, hdg: a.hdg, onGround: a.onGround });
    if (live.length > LIVE_MAX) live.shift();
  }

  // Segmentos coloreados por la altitud de cada punto, agrupados en rachas del mismo color
  const path = [...track, ...live];
  const colorOf = (p: TrackPoint) => altColor(p.alt, p.onGround) ?? '#1f6feb'; // sin altitud: azul de selección
  let start = 0;
  for (let i = 1; i <= path.length; i++) {
    if (i === path.length || colorOf(path[i]!) !== colorOf(path[start]!)) {
      const pts = path.slice(start, Math.min(i + 1, path.length)).map((p) => [p.lat, p.lng] as L.LatLngTuple);
      if (pts.length > 1) L.polyline(pts, { color: colorOf(path[start]!), weight: 3, interactive: false }).addTo(overlay);
      start = i;
    }
  }
  for (const p of path) {
    L.circleMarker([p.lat, p.lng], { radius: 2, stroke: false, fillColor: colorOf(p), fillOpacity: 1, interactive: false }).addTo(
      overlay,
    );
  }
  // Del último punto real al icono suavizado: línea fina, no se guarda
  const last = path.at(-1);
  if (last) L.polyline([[last.lat, last.lng], pos], { color: colorOf(last), weight: 1.5, interactive: false }).addTo(overlay);

  const route = store.selectedRoute;
  if (!route) return;
  const here = { lat: pos.lat, lng: pos.lng };
  L.polyline(greatCircle(route.origin, here), { className: 'route-done', interactive: false }).addTo(overlay);
  L.polyline(greatCircle(here, route.destination), { className: 'route-left', dashArray: '6 8', interactive: false }).addTo(
    overlay,
  );
  for (const ap of [route.origin, route.destination]) {
    L.circleMarker([ap.lat, ap.lng], { radius: 5, className: 'route-airport' })
      .bindTooltip(ap.iata ?? ap.icao, { direction: 'top', className: 'airport-label' })
      .addTo(overlay);
  }
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
    const icon = iconFor(a);
    if (!marker) {
      const start = extrapolate(a, now);
      marker = L.marker([start.lat, start.lng], { icon, keyboard: false });
      marker.on('click', () => store.select(id));
      marker.addTo(layer);
      markers.set(id, marker);
    } else if (marker.options.icon !== icon) {
      marker.setIcon(icon); // el tipo llegó o cambió: raro, solo entonces se rehace el elemento
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
  drawOverlay();
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
  // Mictronics publica la base de tipos con licencia ODC-By, que exige citar la fuente
  map.attributionControl.addAttribution(
    'Tipos de aeronave: <a href="https://www.mictronics.de/aircraft-database/">Mictronics</a>',
  );
  overlay = L.layerGroup().addTo(map);
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
watch(
  () => store.selectedIcao24,
  (id) => (id ? startTrack(id) : stopTrack()),
  { immediate: true },
);
watch(() => store.selectedLabel, syncLabel);
watch(() => store.selectedRoute, drawOverlay);

onUnmounted(() => {
  if (staleTimer !== null) clearInterval(staleTimer);
  stopTrack();
  map?.remove();
  map = null;
  layer = null;
  overlay = null;
  markers.clear();
});
</script>

<template>
  <div ref="mapEl" class="map" />
  <!-- Leyenda: el color no puede ser la única forma de saber la altitud -->
  <details class="sheet legend">
    <summary>Altitud</summary>
    <ul>
      <li v-for="b in ALT_BANDS" :key="b.color"><span :style="{ background: b.color }" />{{ b.label }}</li>
      <li><span style="background: #55575c" />En tierra</li>
    </ul>
  </details>
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
/* Abajo a la izquierda, junto al zoom; plegada por defecto para no tapar el mapa en móvil */
.legend {
  position: absolute;
  left: 72px;
  bottom: 20px;
  z-index: 999;
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 12px;
  max-width: calc(100% - 88px);
}
.legend summary {
  cursor: pointer;
  font-weight: 700;
  min-height: 24px;
  line-height: 24px;
}
.legend ul {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 20px;
  white-space: nowrap;
}
.legend li span {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
</style>
