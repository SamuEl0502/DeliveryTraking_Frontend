<script setup lang="ts">
import * as L from 'leaflet';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { extrapolate, isSignalLost, useSmoothedPosition } from '../composables/useSmoothedPosition';
import { useAircraftStore } from '../store/aircraft';
import { fetchAircraftTrack } from '../services/api';
import type { AircraftState, TrackPoint } from '../types/aircraft';
import { type AircraftFamily, familyOf, sizePx } from '../utils/aircraftFamily';
import { ALT_BANDS, altColor } from '../utils/altitude';

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

// Siluetas propias vistas desde arriba, con la nariz al norte, en un viewBox de 24 (no copiadas de
// tar1090, dump1090-fa ni FlightRadar24). Proporciones de envergadura y largo reales; se rotan con CSS según el rumbo.
type Pt = [x: number, y: number];
/** Medio contorno derecho (x ≥ 12) de la nariz a la cola; se refleja en el eje para cerrar la silueta */
const sym = (half: Pt[]) =>
  `M${[...half, ...[...half].reverse().map(([x, y]): Pt => [24 - x, y])].map(([x, y]) => `${x} ${y}`).join('L')}Z`;
/** Par de motores o góndolas: un rectángulo a cada lado del eje, en el mismo sentido para que se sumen al relleno */
const pods = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y}h${w}v${h}h${-w}zM${24 - x - w} ${y}h${w}v${h}h${-w}z`;

const SHAPES: Record<AircraftFamily, string> = {
  generic: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
  // Ala alta y recta, adelantada
  'cessna-high': sym([[12, 3.7], [12.9, 4.3], [13, 5.6], [13, 7], [23, 7], [23, 9.6], [13, 9.6], [12.8, 17], [16, 17.4], [16, 19.8], [12.3, 20.3]]),
  // Ala baja con estrechamiento hacia la punta
  'piston-low': sym([[12, 4.5], [12.9, 5.1], [13.1, 6.6], [13.1, 9], [23, 9.6], [23, 11.4], [13.1, 12], [12.7, 17.4], [16, 17.7], [16, 19.2], [12.3, 19.5]]),
  'piston-twin':
    sym([[12, 4.2], [12.8, 4.9], [13, 6.2], [13, 9.8], [23, 10.2], [23, 11.7], [13, 12], [13, 17.2], [16.6, 17.8], [16.6, 19.6], [12.4, 19.9]]) +
    pods(15, 8.3, 1.5, 4.6),
  // Nariz larga
  'turboprop-single': sym([[12, 2.3], [12.8, 3.1], [13.1, 4.8], [13.1, 9.8], [23, 10.6], [23, 11.9], [13.1, 13.2], [13.1, 18.8], [16.8, 19.8], [16.8, 21.4], [12.4, 21.7]]),
  // Bimotor turbohélice con cola en T
  kingair:
    sym([[12, 3.2], [12.8, 3.9], [13, 5.2], [13, 9.4], [23, 9.9], [23, 11.4], [13, 11.8], [13, 18.6], [16.4, 19.9], [16.4, 20.8], [12.3, 20.8]]) +
    pods(14.8, 7.6, 1.5, 5.2),
  // Motores atrás, junto al fuselaje, y cola en T
  'bizjet-light':
    sym([[12, 1.5], [12.8, 2.4], [13, 4], [13, 10], [23, 12.6], [23, 13.6], [13, 13.6], [13, 20.6], [16.4, 21.6], [16.4, 22.5], [12.3, 22.5]]) +
    pods(13.2, 15.2, 1.4, 3.2),
  'bizjet-large':
    sym([[12, 1], [12.9, 1.9], [13.2, 3.6], [13.2, 9.4], [23, 13.8], [23, 14.8], [13.2, 13.6], [13.2, 20.4], [16.8, 21.8], [16.8, 22.8], [12.3, 23]]) +
    pods(13.4, 15.2, 1.6, 3.4),
  // Fuselaje largo y fino, ala atrasada, motores atrás y cola en T
  'regional-rear':
    sym([[12, 1], [12.7, 1.8], [13, 3.3], [13, 10.5], [19.6, 14.6], [19.6, 15.4], [13, 13.6], [13, 20.2], [16, 21.8], [16, 22.7], [12.3, 23]]) +
    pods(13.2, 16.3, 1.4, 3.4),
  // De aquí en adelante, motores bajo el ala
  ejet:
    sym([[12, 1], [12.8, 1.8], [13.1, 3.3], [13.1, 9.6], [21, 14.3], [21, 15.2], [13.1, 13.2], [13.1, 19], [16.4, 21.4], [16.4, 22.4], [12.3, 23]]) +
    pods(14.6, 9.6, 1.3, 2.4),
  a220:
    sym([[12, 1], [12.7, 1.8], [13, 3.2], [13, 9.2], [22, 14.4], [22, 15.3], [13, 13], [13, 19.2], [16.2, 21.5], [16.2, 22.4], [12.3, 23]]) +
    pods(14.7, 9.2, 1.6, 2.8),
  a320:
    sym([[12, 1], [12.9, 1.8], [13.2, 3.2], [13.2, 9], [22.5, 14.2], [22.5, 15.2], [13.2, 13], [13.2, 19], [16.6, 21.4], [16.6, 22.4], [12.3, 23]]) +
    pods(15, 9.3, 1.4, 2.6),
  b737:
    sym([[12, 1], [12.8, 1.7], [13.1, 3], [13.1, 9.5], [22, 14.3], [22, 15.2], [13.1, 13.2], [13.1, 19.3], [16.3, 21.6], [16.3, 22.5], [12.3, 23]]) +
    pods(14.5, 9.2, 1.4, 2.4),
  'b757-767':
    sym([[12, 1], [13, 1.8], [13.4, 3.2], [13.4, 9.2], [21.5, 14.6], [21.5, 15.5], [13.4, 13.4], [13.4, 19.3], [17, 21.5], [17, 22.5], [12.3, 23]]) +
    pods(15.3, 9.9, 1.5, 2.8),
  'b777-787':
    sym([[12, 1], [13.2, 1.9], [13.6, 3.4], [13.6, 8.8], [21.6, 14.6], [21.6, 15.4], [13.6, 13.2], [13.6, 19.2], [17.4, 21.5], [17.4, 22.5], [12.3, 23]]) +
    pods(15.5, 9.4, 1.9, 3.2),
  'a330-a350':
    sym([[12, 1], [13.1, 1.9], [13.5, 3.4], [13.5, 8.6], [22.7, 14.4], [22.7, 15.3], [13.5, 13], [13.5, 19.2], [17.3, 21.5], [17.3, 22.5], [12.3, 23]]) +
    pods(15.6, 9.4, 1.8, 3),
  // Cuatro motores
  jumbo:
    sym([[12, 1], [13.3, 2], [13.7, 3.6], [13.7, 8.6], [22, 14.6], [22, 15.5], [13.7, 13.2], [13.7, 19.2], [17.6, 21.5], [17.6, 22.5], [12.3, 23]]) +
    pods(15.2, 9.4, 1.6, 2.8) +
    pods(18.4, 11.4, 1.5, 2.6),
  // Ala alta y recta, góndolas de hélice que sobresalen por delante, cola en T
  'turboprop-regional':
    sym([[12, 1], [12.8, 1.8], [13.1, 3.3], [13.1, 7.4], [23, 7.8], [23, 9.6], [13.1, 10], [13.1, 19.8], [16.5, 21.6], [16.5, 22.6], [12.3, 23]]) +
    pods(15.4, 5.6, 1.4, 5.6),
  // Cabina, botalón de cola y dos palas en X; el disco del rotor va aparte (ROTOR), semitransparente
  heli:
    sym([[12, 3.6], [13.6, 4.2], [14.2, 6.4], [14, 11.4], [12.6, 13.6], [12.6, 19.4], [14.6, 19.6], [14.6, 20.6], [12.6, 20.8], [12.5, 22.6], [12.2, 22.8]]) +
    'M6.73 2.55L18.05 13.87L17.27 14.65L5.95 3.33ZM18.05 3.33L6.73 14.65L5.95 13.87L17.27 2.55Z',
  // Cabina en tándem y ala con estrechamiento
  'military-trainer': sym([[12, 1], [12.9, 2], [13.1, 4], [13.2, 9.4], [23, 11.2], [23, 12.8], [13.2, 14], [12.8, 19.6], [16.6, 20.6], [16.6, 22.4], [12.3, 23]]),
};

const ROTOR = '<circle class="rotor" cx="12" cy="8.6" r="8.2"/>';

// Un divIcon por familia y tamaño, creado la primera vez que hace falta: los 400 marcadores comparten
// unas decenas. El tamaño va en --size; los estados son clases CSS
const icons = new Map<string, L.DivIcon>();
function iconFor(a: AircraftState): L.DivIcon {
  const family = familyOf(a.type);
  const px = sizePx(a.type, family);
  const key = `${family}-${px}`;
  let icon = icons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'plane-marker',
      html: `<div class="plane" style="--size:${px}px"><svg viewBox="0 0 24 24" aria-hidden="true">${family === 'heli' ? ROTOR : ''}<path d="${SHAPES[family]}"/></svg></div>`,
      iconSize: [40, 40], // área de toque; el avión visible puede ser más pequeño o más grande
      iconAnchor: [20, 20],
    });
    icons.set(key, icon);
  }
  return icon;
}

function applyState(marker: L.Marker, a: AircraftState, isSelected: boolean, lost: boolean): void {
  const el = marker.getElement();
  if (!el) return;
  const plane = el.firstElementChild;
  if (plane instanceof HTMLElement) plane.style.transform = `rotate(${a.hdg ?? 0}deg)`;
  el.classList.toggle('is-selected', isSelected);
  el.classList.toggle('is-ground', a.onGround);
  el.classList.toggle('is-stale', lost);
}

// Estela y aeropuertos del avión seguido. Las líneas van en overlayPane, debajo de los marcadores
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
  for (const ap of route.destination ? [route.origin, route.destination] : [route.origin]) {
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
      marker.setIcon(icon); // el tipo llegó o cambió de familia: raro, solo entonces se rehace el elemento
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
  // Iconos más grandes de cerca, para que se note la forma
  const setZoomScale = () => {
    const z = map!.getZoom();
    mapEl.value?.style.setProperty('--zoom-scale', String(z <= 5 ? 0.85 : z >= 8 ? 1.3 : 1));
  };
  map.on('zoomend', setZoomScale);
  setZoomScale();
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
  <!-- Leyenda de la estela: el color no puede ser la única forma de saber la altitud -->
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
