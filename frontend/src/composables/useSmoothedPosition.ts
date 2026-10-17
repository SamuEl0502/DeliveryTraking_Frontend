import { onUnmounted } from 'vue';
import type { AircraftState } from '../types/aircraft';

/** Pasado este tiempo sin datos se deja de extrapolar ("señal perdida") */
export const SIGNAL_LOST_S = 120;
const CORRECTION_MS = 1000;
const EARTH_RADIUS_M = 6_371_000;
const DEG = 180 / Math.PI;

export interface LatLng {
  lat: number;
  lng: number;
}

export function secondsSince(a: AircraftState, nowMs: number): number {
  return Math.max(0, nowMs / 1000 - a.ts);
}

export function isSignalLost(a: AircraftState, nowMs: number): boolean {
  return secondsSince(a, nowMs) > SIGNAL_LOST_S;
}

/**
 * Posición estimada "ahora": avanza desde el último punto la distancia velocidad × tiempo
 * en la dirección del rumbo. Aproximación plana, válida para distancias cortas (pocos km).
 */
export function extrapolate(a: AircraftState, nowMs: number): LatLng {
  if (a.onGround || a.spd === null || a.hdg === null) return { lat: a.lat, lng: a.lng };
  const seconds = Math.min(secondsSince(a, nowMs), SIGNAL_LOST_S); // se congela al perder señal
  const distance = a.spd * seconds; // metros
  const heading = a.hdg / DEG; // radianes; 0 = norte, sentido horario
  const north = distance * Math.cos(heading);
  const east = distance * Math.sin(heading);
  return {
    lat: a.lat + (north / EARTH_RADIUS_M) * DEG,
    // un grado de longitud mide menos cuanto más lejos del ecuador: se divide por cos(lat)
    lng: a.lng + (east / (EARTH_RADIUS_M * Math.cos(a.lat / DEG))) * DEG,
  };
}

function lerp(from: LatLng, to: LatLng, t: number): LatLng {
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}

interface Track {
  state: AircraftState;
  from: LatLng; // dónde estaba dibujado cuando llegó el último dato
  correctionStart: number;
  last: LatLng; // última posición dibujada
}

/**
 * Anima varios aviones con un único bucle de requestAnimationFrame.
 * `draw` recibe la posición suavizada de cada avión en cada fotograma.
 */
export function useSmoothedPosition(draw: (icao24: string, pos: LatLng) => void) {
  const tracks = new Map<string, Track>();
  let frameId: number | null = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(): void {
    const now = Date.now();
    for (const [id, track] of tracks) {
      const target = extrapolate(track.state, now);
      const t = reduceMotion ? 1 : Math.min(1, (now - track.correctionStart) / CORRECTION_MS);
      const pos = t >= 1 ? target : lerp(track.from, target, t);
      track.last = pos;
      draw(id, pos);
    }
    frameId = tracks.size > 0 ? requestAnimationFrame(frame) : null;
  }

  /** Registra o actualiza un avión. `current` es donde está dibujado hoy su marcador. */
  function setState(state: AircraftState, current: LatLng): void {
    const track = tracks.get(state.icao24);
    if (!track) {
      tracks.set(state.icao24, { state, from: current, last: current, correctionStart: Date.now() });
    } else {
      // El backend cachea 30 s: si el dato es el mismo (mismo ts) no se reinicia la corrección
      if (track.state.ts !== state.ts) {
        track.from = track.last;
        track.correctionStart = Date.now();
      }
      track.state = state;
    }
    if (frameId === null) frameId = requestAnimationFrame(frame);
  }

  function remove(icao24: string): void {
    tracks.delete(icao24);
  }

  onUnmounted(() => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    tracks.clear();
  });

  return { setState, remove };
}
