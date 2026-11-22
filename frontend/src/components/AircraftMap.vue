<script setup lang="ts">
import { type GeoJSONSource, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { extrapolate, isSignalLost, useSmoothedPosition } from '../composables/useSmoothedPosition';
import { useAircraftStore } from '../store/aircraft';
import { fetchAircraftTrack } from '../services/api';
import type { AircraftState, TrackPoint } from '../types/aircraft';
import { type AircraftFamily, familyOf, sizePx } from '../utils/aircraftFamily';
import { ALT_BANDS, altColor } from '../utils/altitude';
import { OSM_STYLE, PROTOMAPS_STYLE } from '../utils/basemap';

const MAX_MARKERS = 400;
const MAX_ANIMATED = 60; // además del avión seguido
const STALE_CHECK_MS = 5000;
const US_CENTER: [lng: number, lat: number] = [-98.35, 39.5];
// Los tiles de MapLibre miden 512 px: su zoom 3.3 equivale al zoom 4 que tenía Leaflet
const START_ZOOM = 3.3;
const FOCUS_ZOOM = 7;

const emit = defineEmits<{ rendered: [count: number] }>();

const store = useAircraftStore();
const mapEl = ref<HTMLDivElement | null>(null);

// Instancias de MapLibre fuera de la reactividad de Vue (no necesitan proxies y serían más lentas)
let map: MapLibreMap | null = null;
let styleReady = false; // hasta que carga el estilo no se pueden añadir fuentes ni capas
let staleTimer: ReturnType<typeof setInterval> | null = null;
const markers = new Map<string, Marker>();

// Cada fotograma, el composable entrega la posición suavizada y aquí se mueve el marcador
const smooth = useSmoothedPosition((id, pos) => {
  markers.get(id)?.setLngLat([pos.lng, pos.lat]);
  if (id === store.selectedIcao24) labelMarker?.setLngLat([pos.lng, pos.lat]);
});

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

/** Familia y tamaño del icono: si cambian (llegó el tipo), se rehace el SVG del marcador */
function iconKey(a: AircraftState): string {
  const family = familyOf(a.type);
  return `${family}-${sizePx(a.type, family)}`;
}

function planeHtml(a: AircraftState): string {
  const family = familyOf(a.type);
  return `<div class="plane" style="--size:${sizePx(a.type, family)}px"><svg viewBox="0 0 24 24" aria-hidden="true">${family === 'heli' ? ROTOR : ''}<path d="${SHAPES[family]}"/></svg></div>`;
}

/** Marcador HTML de 40x40 (área de toque); el avión dibujado puede ser más pequeño o más grande */
function createMarker(id: string, a: AircraftState, now: number): Marker {
  const el = document.createElement('div');
  el.className = 'plane-marker';
  el.dataset.icon = iconKey(a);
  el.innerHTML = planeHtml(a);
  el.addEventListener('click', (e) => {
    e.stopPropagation(); // si no, el clic llega al mapa y deselecciona
    store.select(id);
  });
  const start = extrapolate(a, now);
  // Acostado sobre el mapa: se inclina y gira con él, como una sombra del avión en el suelo
  return new Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
    .setLngLat([start.lng, start.lat])
    .addTo(map!);
}

/** Rumbo respecto al norte del mapa: el giro del mapa ya lo aplica MapLibre al marcador */
function orient(marker: Marker, hdg: number | null): void {
  const plane = marker.getElement().firstElementChild;
  if (plane instanceof HTMLElement) plane.style.transform = `rotate(${hdg ?? 0}deg)`;
}

/** Separación de la sombra (px) según la altitud: de 1 px en tierra a 8 px a 12 000 m o más */
function lift(a: AircraftState): number {
  return a.onGround ? 1 : 2 + Math.round(Math.min(Math.max(a.alt ?? 0, 0), 12000) / 2000);
}

function applyState(marker: Marker, a: AircraftState, isSelected: boolean, lost: boolean): void {
  const el = marker.getElement();
  const key = iconKey(a);
  if (el.dataset.icon !== key) {
    el.dataset.icon = key; // el tipo llegó o cambió de familia: raro, solo entonces se rehace el SVG
    el.innerHTML = planeHtml(a);
  }
  orient(marker, a.hdg);
  el.style.setProperty('--lift', `${lift(a)}px`);
  el.classList.toggle('is-selected', isSelected);
  el.classList.toggle('is-ground', a.onGround);
  el.classList.toggle('is-stale', lost);
}

// Estela y aeropuertos del avión seguido. La estela es una capa del mapa, debajo de los marcadores HTML
const TRACK_REFRESH_MS = 60_000;
const LIVE_MAX = 500;
const TRAIL_SOURCE = 'trail';
let airportMarkers: Marker[] = [];
let drawnRoute: unknown = null;
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

type TrailFeature = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point, { color: string; width: number }>;

function drawOverlay(): void {
  const source = styleReady ? map?.getSource<GeoJSONSource>(TRAIL_SOURCE) : undefined;
  if (!source) return;
  drawAirports();
  const a = store.selected;
  const pos = a ? markers.get(a.icao24)?.getLngLat() : undefined;
  if (!a || !pos) {
    source.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  // Punto real nuevo solo cuando cambia ts
  const lastTs = (live.at(-1) ?? track.at(-1))?.ts ?? 0;
  if (a.ts > lastTs) {
    live.push({ ts: a.ts, lat: a.lat, lng: a.lng, alt: a.alt, hdg: a.hdg, onGround: a.onGround });
    if (live.length > LIVE_MAX) live.shift();
  }

  // Segmentos coloreados por la altitud de cada punto, agrupados en rachas del mismo color
  const path = [...track, ...live];
  const colorOf = (p: TrackPoint) => altColor(p.alt, p.onGround) ?? '#1f6feb'; // sin altitud: azul de selección
  const line = (coords: [number, number][], color: string, width: number): TrailFeature => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: { color, width },
  });
  const features: TrailFeature[] = [];
  let start = 0;
  for (let i = 1; i <= path.length; i++) {
    if (i === path.length || colorOf(path[i]!) !== colorOf(path[start]!)) {
      const pts = path.slice(start, Math.min(i + 1, path.length)).map((p): [number, number] => [p.lng, p.lat]);
      if (pts.length > 1) features.push(line(pts, colorOf(path[start]!), 3));
      start = i;
    }
  }
  for (const p of path) {
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { color: colorOf(p), width: 0 } });
  }
  // Del último punto real al icono suavizado: línea fina, no se guarda
  const last = path.at(-1);
  if (last) features.push(line([[last.lng, last.lat], [pos.lng, pos.lat]], colorOf(last), 1.5));
  source.setData({ type: 'FeatureCollection', features });
}

/** Aeropuertos de la ruta del avión seguido: marcadores HTML con su código; solo se rehacen si cambia la ruta */
function drawAirports(): void {
  const route = store.selected ? store.selectedRoute : null;
  if (route === drawnRoute) return;
  drawnRoute = route;
  for (const m of airportMarkers) m.remove();
  airportMarkers = [];
  if (!route || !map) return;
  for (const ap of route.destination ? [route.origin, route.destination] : [route.origin]) {
    const el = document.createElement('div');
    el.className = 'airport-marker';
    el.setAttribute('aria-hidden', 'true'); // el panel ya muestra la ruta
    const code = document.createElement('span');
    code.className = 'airport-label';
    code.textContent = ap.iata ?? ap.icao;
    el.append(code);
    airportMarkers.push(new Marker({ element: el }).setLngLat([ap.lng, ap.lat]).addTo(map));
  }
}

// Una sola etiqueta con el número de vuelo sobre el avión seguido (estilo FlightRadar24).
// Es un marcador aparte para que quede de pie y legible aunque el mapa esté inclinado
const label = document.createElement('span');
label.className = 'flight-label';
label.setAttribute('aria-hidden', 'true'); // decorativa: el panel ya lo dice
let labelMarker: Marker | null = null;

function syncLabel(): void {
  const marker = store.selectedIcao24 ? markers.get(store.selectedIcao24) : undefined;
  const text = marker ? store.selectedLabel : null;
  if (!marker || !text || !map) {
    labelMarker?.remove();
    labelMarker = null;
    return;
  }
  label.textContent = text;
  if (!labelMarker) labelMarker = new Marker({ element: label, anchor: 'bottom', offset: [0, -16] }).setLngLat(marker.getLngLat()).addTo(map);
  else labelMarker.setLngLat(marker.getLngLat());
}

/** Solo vale la pena animar lo que se mueve y tiene señal reciente */
function canAnimate(a: AircraftState, now: number): boolean {
  return !a.onGround && a.spd !== null && a.hdg !== null && !isSignalLost(a, now);
}

/** Elige qué aviones dibujar y sincroniza los marcadores (crea, mueve o quita) */
function render(): void {
  if (!map) return;
  const now = Date.now();
  const bounds = map.getBounds();
  const selectedId = store.selectedIcao24;

  const visible: AircraftState[] = [];
  // El avión seguido va primero y se dibuja siempre, aunque esté en tierra o fuera de la vista
  if (store.selected) visible.push(store.selected);
  for (const a of store.airborne) {
    if (visible.length >= MAX_MARKERS) break;
    if (a.icao24 !== selectedId && bounds.contains([a.lng, a.lat])) visible.push(a);
  }

  const keep = new Set<string>();
  let animated = 0;
  for (const a of visible) {
    const id = a.icao24;
    const isSelected = id === selectedId;
    keep.add(id);

    let marker = markers.get(id);
    if (!marker) {
      marker = createMarker(id, a, now);
      markers.set(id, marker);
    }

    // El seguido siempre pasa por el composable (así también se suaviza su corrección)
    if (isSelected || (animated < MAX_ANIMATED && canAnimate(a, now))) {
      if (!isSelected) animated += 1;
      smooth.setState(a, marker.getLngLat());
    } else {
      smooth.remove(id);
      const pos = extrapolate(a, now); // sin animación: un solo cálculo por render
      marker.setLngLat([pos.lng, pos.lat]);
    }
    applyState(marker, a, isSelected, isSignalLost(a, now));
  }

  for (const [id, marker] of markers) {
    if (!keep.has(id)) {
      marker.remove();
      markers.delete(id);
      smooth.remove(id);
    }
  }

  syncLabel();
  drawOverlay();
  emit('rendered', visible.length);
}

/** Globo terráqueo al alejarse, edificios en 3D al acercarse y la capa de la estela */
function setup3d(): void {
  if (!map) return;
  map.setProjection({ type: 'globe' });
  // Los edificios de Protomaps traen su altura en metros; sin dato, una altura baja
  if (map.getSource('protomaps')) {
    const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    map.addLayer(
      {
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 14,
        filter: ['match', ['get', 'kind'], ['building', 'building_part'], true, false],
        paint: {
          'fill-extrusion-color': '#d4d4d8',
          'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      },
      firstLabel,
    );
  }
  map.addSource(TRAIL_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'trail-line',
    type: 'line',
    source: TRAIL_SOURCE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] },
  });
  map.addLayer({
    id: 'trail-dots',
    type: 'circle',
    source: TRAIL_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 2, 'circle-color': ['get', 'color'] },
  });
  styleReady = true;
  drawOverlay();
}

onMounted(() => {
  if (!mapEl.value) return;
  map = new MapLibreMap({
    container: mapEl.value,
    style: PROTOMAPS_STYLE ?? OSM_STYLE,
    center: US_CENTER,
    zoom: START_ZOOM,
    maxPitch: 70,
    // Mictronics publica la base de tipos con licencia ODC-By, que exige citar la fuente
    attributionControl: {
      compact: false,
      customAttribution: 'Tipos de aeronave: <a href="https://www.mictronics.de/aircraft-database/">Mictronics</a>',
    },
  });
  // Zoom y brújula: la brújula muestra la inclinación y al pulsarla vuelve el mapa al norte y en plano
  map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-left');
  map.on('style.load', setup3d);

  // Iconos más grandes de cerca, para que se note la forma
  const setZoomScale = () => {
    const z = map!.getZoom();
    mapEl.value?.style.setProperty('--zoom-scale', String(z <= 4 ? 0.85 : z >= 7 ? 1.3 : 1));
  };
  map.on('zoomend', setZoomScale);
  setZoomScale();
  map.on('moveend', render); // también se dispara al hacer zoom, girar o inclinar
  map.on('click', () => store.clearSelection()); // clic en zona vacía deja de seguir
  // La "señal perdida" depende del reloj, no solo de datos nuevos: se revisa cada 5 s
  staleTimer = setInterval(render, STALE_CHECK_MS);
  render();
});

/** Centra el mapa en un avión (lo usa el buscador); acerca hasta zoom 7 si se está más lejos */
function focus(a: AircraftState): void {
  const pos = extrapolate(a, Date.now());
  map?.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), FOCUS_ZOOM), duration: 1000 });
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
  map?.remove(); // también quita los marcadores
  map = null;
  styleReady = false;
  markers.clear();
  airportMarkers = [];
  drawnRoute = null;
  labelMarker = null;
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
/* MapLibre necesita un contenedor con altura explícita */
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
