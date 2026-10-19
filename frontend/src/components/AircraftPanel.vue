<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { SIGNAL_LOST_S } from '../composables/useSmoothedPosition';
import type { AircraftState } from '../types/aircraft';

const props = defineProps<{ aircraft: AircraftState }>();
const emit = defineEmits<{ close: [] }>();

// Reloj de 1 s solo para el texto "hace X s"
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => (clock = setInterval(() => (now.value = Date.now()), 1000)));
onUnmounted(() => {
  if (clock !== null) clearInterval(clock);
});

const timeFmt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const callsign = computed(() => props.aircraft.callsign?.trim() || 'Sin callsign');

// OpenSky entrega m/s y metros; se muestran también nudos y pies (unidades de aviación)
const speed = computed(() => {
  const s = props.aircraft.spd;
  return s === null ? null : { kmh: Math.round(s * 3.6), kt: Math.round(s * 1.94384) };
});
const altitude = computed(() => {
  const m = props.aircraft.alt;
  return m === null ? null : { m: Math.round(m), ft: Math.round(m * 3.28084) };
});

// ts = 0: OpenSky no mandó ninguna hora; no se muestra 1970
const hasTs = computed(() => props.aircraft.ts > 0);
const positionTime = computed(() => (hasTs.value ? timeFmt.format(props.aircraft.ts * 1000) : 'sin hora'));
const ageSeconds = computed(() => Math.max(0, Math.round(now.value / 1000 - props.aircraft.ts)));
const ageText = computed(() =>
  ageSeconds.value < 60 ? `hace ${ageSeconds.value} s` : `hace ${Math.floor(ageSeconds.value / 60)} min`,
);

const signalLost = computed(() => ageSeconds.value > SIGNAL_LOST_S);
const lostMinutes = computed(() => Math.floor(ageSeconds.value / 60));

const num = new Intl.NumberFormat('es');
</script>

<template>
  <aside class="sheet panel" aria-label="Avión seguido">
    <header class="panel-head">
      <div class="chips">
        <span class="chip mono">{{ aircraft.icao24.toUpperCase() }}</span>
        <span class="chip mono">{{ positionTime }}</span>
      </div>
      <button class="close" type="button" aria-label="Cerrar panel" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </header>

    <h2 class="callsign">{{ callsign }}</h2>
    <p v-if="signalLost" class="status is-lost" role="status">
      <span class="dot" />
      Señal perdida{{ hasTs ? ` hace ${lostMinutes} min` : '' }}
    </p>
    <p v-else class="status" :class="aircraft.onGround ? 'is-ground' : 'is-air'">
      <span class="dot" />
      {{ aircraft.onGround ? 'En tierra' : 'En el aire' }}
    </p>

    <dl class="stats">
      <div>
        <dt>Velocidad</dt>
        <dd v-if="speed">{{ num.format(speed.kmh) }} <small>km/h</small></dd>
        <dd v-else class="muted">—</dd>
        <span v-if="speed" class="sub">{{ num.format(speed.kt) }} kt</span>
      </div>
      <div>
        <dt>Altitud</dt>
        <dd v-if="altitude">{{ num.format(altitude.m) }} <small>m</small></dd>
        <dd v-else class="muted">—</dd>
        <span v-if="altitude" class="sub">{{ num.format(altitude.ft) }} ft</span>
      </div>
      <div>
        <dt>Rumbo</dt>
        <dd v-if="aircraft.hdg !== null">{{ Math.round(aircraft.hdg) }}<small>°</small></dd>
        <dd v-else class="muted">—</dd>
      </div>
      <div>
        <dt>Posición</dt>
        <dd class="coords">{{ aircraft.lat.toFixed(3) }}, {{ aircraft.lng.toFixed(3) }}</dd>
      </div>
    </dl>

    <p class="updated">Última posición a las <strong>{{ positionTime }}</strong><template v-if="hasTs"> · {{ ageText }}</template></p>
  </aside>
</template>

<style scoped>
/* Móvil (base): hoja inferior como en Flighty */
.panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  max-height: 70dvh;
  overflow-y: auto;
  border-radius: 28px 28px 0 0;
  padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
}
/* Escritorio: panel lateral derecho */
@media (min-width: 768px) {
  .panel {
    left: auto;
    top: 16px;
    right: 16px;
    bottom: auto;
    width: 380px;
    max-height: calc(100dvh - 32px);
    border-radius: 24px;
    padding: 20px 22px 22px;
  }
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 13px;
  color: var(--text-2);
}
.mono {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}
.close {
  flex: none;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.close svg {
  width: 20px;
  height: 20px;
  stroke: var(--text);
  stroke-width: 2.4;
  stroke-linecap: round;
}
.close:hover {
  background: var(--line);
}
.callsign {
  margin: 10px 0 2px;
  font-size: 28px;
  overflow-wrap: anywhere;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  font-weight: 600;
  font-size: 15px;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: currentColor;
}
.is-air {
  color: var(--green);
}
.is-ground {
  color: var(--text-2);
}
.is-lost {
  color: var(--warning);
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 18px;
  margin: 0;
  padding: 16px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.stats > div {
  border-left: 3px solid var(--line);
  padding-left: 10px;
}
dt {
  font-size: 13px;
  color: var(--text-2);
}
dd {
  margin: 2px 0 0;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
dd small {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
}
dd.coords {
  font-size: 16px;
  padding-top: 6px;
}
.sub {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.muted {
  color: var(--text-2);
}
.updated {
  margin: 14px 0 0;
  font-size: 14px;
  color: var(--text-2);
}
.updated strong {
  color: var(--text);
  font-weight: 600;
}

@media (min-width: 768px) {
  .callsign {
    font-size: 34px;
  }
}
</style>
