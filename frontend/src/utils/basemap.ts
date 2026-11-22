// Mapa base compartido: AircraftMap (MapLibre GL, 3D) y ShipmentMap (Leaflet + maplibre-gl-leaflet)
import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre busca su worker junto a su propio archivo, que Vite mueve al empaquetar: se le da la URL ya empaquetada
setWorkerUrl(workerUrl);

const key = import.meta.env.VITE_PROTOMAPS_KEY;

/** Estilo vectorial de Protomaps (trae su atribución); null si no hay llave en .env */
export const PROTOMAPS_STYLE: string | null = key
  ? `https://api.protomaps.com/styles/v5/light/en.json?key=${encodeURIComponent(key)}`
  : null;

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Sin llave: los mismos tiles de OpenStreetMap de antes, como estilo de MapLibre (sin edificios 3D) */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: 'raster', tiles: [OSM_TILES], tileSize: 256, maxzoom: 19, attribution: OSM_ATTRIBUTION },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};
