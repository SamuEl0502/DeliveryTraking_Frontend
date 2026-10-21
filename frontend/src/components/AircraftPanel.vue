<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { SIGNAL_LOST_S } from '../composables/useSmoothedPosition';
import { ApiError, fetchAircraftDetails, fetchAircraftSchedule } from '../services/api';
import { useAircraftStore } from '../store/aircraft';
import type { AircraftState } from '../types/aircraft';
import type { AircraftDetails, Airport, FlightSchedule, FlightTimes } from '../types/flightDetails';

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

// Ruta y avión: una petición por avión seleccionado, no por ciclo de polling (el backend
// cachea 6 h). Al cambiar de avión o cerrar el panel se aborta la anterior para no mezclar datos.
const details = shallowRef<AircraftDetails | null>(null);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);

// Horarios: SOLO con el botón. Aviationstack da 100 peticiones al mes
const schedule = shallowRef<FlightSchedule | null>(null);
const scheduleLoading = ref(false);
const scheduleError = ref<string | null>(null);
let scheduleController: AbortController | null = null;

function resetSchedule(): void {
  scheduleController?.abort();
  scheduleController = null;
  schedule.value = null;
  scheduleError.value = null;
  scheduleLoading.value = false;
}

async function loadSchedule(): Promise<void> {
  resetSchedule();
  const controller = (scheduleController = new AbortController());
  scheduleLoading.value = true;
  try {
    schedule.value = await fetchAircraftSchedule(props.aircraft.icao24, controller.signal);
  } catch (e: unknown) {
    if (controller.signal.aborted) return;
    const code = e instanceof ApiError ? e.code : null;
    scheduleError.value =
      code === 'SCHEDULE_NOT_FOUND'
        ? 'Sin vuelo activo para este indicativo'
        : 'Horarios no disponibles por ahora'; // cupo agotado, servicio apagado o cualquier otro fallo
  } finally {
    if (!controller.signal.aborted) scheduleLoading.value = false;
  }
}

const STATUS_ES: Record<string, string> = {
  scheduled: 'Programado',
  active: 'En vuelo',
  landed: 'Aterrizó',
  cancelled: 'Cancelado',
  incident: 'Incidente',
  diverted: 'Desviado',
};
const scheduleStatus = computed(() =>
  schedule.value ? (STATUS_ES[schedule.value.status] ?? schedule.value.status) : null,
);
// Las horas llegan en UTC; se muestran en la hora local de quien mira
const clockFmt = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const atTime = (iso: string | null) => (iso ? clockFmt.format(new Date(iso)) : '—');

// Mejor hora disponible: real, si no estimada, si no programada
function bestTime(t: FlightTimes): { label: string; iso: string } | null {
  if (t.actual) return { label: 'Real', iso: t.actual };
  if (t.estimated) return { label: 'Estimada', iso: t.estimated };
  if (t.scheduled) return { label: 'Programada', iso: t.scheduled };
  return null;
}

watch(
  () => props.aircraft.icao24,
  (icao24, _old, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => {
      controller.abort();
      resetSchedule();
    });
    details.value = null;
    detailsError.value = null;
    detailsLoading.value = true;
    fetchAircraftDetails(icao24, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) details.value = d;
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) detailsError.value = e instanceof ApiError ? e.message : 'Error inesperado';
      })
      .finally(() => {
        if (!controller.signal.aborted) detailsLoading.value = false;
      });
  },
  { immediate: true },
);

// La ruta de /schedule es la del tramo que vuela ahora: si llega, reemplaza a la de /details
const route = computed(() => schedule.value?.route ?? details.value?.route ?? null);
const progress = computed(() =>
  schedule.value?.route ? schedule.value.progress : (details.value?.progress ?? null),
);
const info = computed(() => details.value?.aircraft ?? null);

const callsign = computed(
  () =>
    route.value?.flightNumber ??
    schedule.value?.flightNumber ??
    (props.aircraft.callsign?.trim() || 'Sin callsign'),
);
// Etiqueta del mapa: número comercial si ya llegó; si no, callsign; si no, icao24
const store = useAircraftStore();
watch(
  () =>
    schedule.value?.flightNumber ??
    route.value?.flightNumber ??
    (props.aircraft.callsign?.trim() || props.aircraft.icao24.toUpperCase()),
  (label) => (store.selectedLabel = label),
  { immediate: true },
);
// Ruta para dibujar en el mapa: la de /schedule, o la de /details solo si está verificada
watch(
  route,
  (r) =>
    (store.selectedRoute =
      r && (schedule.value?.route || r.verified) ? { origin: r.origin, destination: r.destination } : null),
  { immediate: true },
);
onUnmounted(() => {
  store.selectedLabel = null;
  store.selectedRoute = null;
});

const airline = computed(() => route.value?.airline?.name ?? schedule.value?.airline ?? null);
const airportCode = (a: Airport) => a.iata ?? a.icao;
const airportCity = (a: Airport) => a.city ?? a.name;

const eta = computed(() => {
  const m = progress.value?.etaMinutes;
  if (m == null) return null;
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h} h ${min} min` : `${min} min`;
});

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
    <p v-if="airline" class="airline">{{ airline }}</p>
    <p v-if="signalLost" class="status is-lost" role="status">
      <span class="dot" />
      Señal perdida{{ hasTs ? ` hace ${lostMinutes} min` : '' }}
    </p>
    <p v-else class="status" :class="aircraft.onGround ? 'is-ground' : 'is-air'">
      <span class="dot" />
      {{ aircraft.onGround ? 'En tierra' : 'En el aire' }}
    </p>

    <!-- Ruta y avión: si fallan, solo un aviso; los datos en vivo siguen abajo -->
    <p v-if="detailsLoading" class="note">Cargando ruta…</p>
    <template v-else>
      <p v-if="detailsError && !route" class="note is-warn">No se pudo cargar la ruta. {{ detailsError }}</p>
      <section v-if="route" class="route" aria-label="Ruta">
        <div class="airports">
          <div>
            <span class="iata mono">{{ airportCode(route.origin) }}</span>
            <span class="city">{{ airportCity(route.origin) }}</span>
          </div>
          <span class="arrow" aria-hidden="true">→</span>
          <div class="end">
            <span class="iata mono">{{ airportCode(route.destination) }}</span>
            <span class="city">{{ airportCity(route.destination) }}</span>
          </div>
        </div>
        <p v-if="!route.verified" class="note is-warn">Ruta no verificada</p>
        <div v-if="progress" class="progress">
          <div
            class="bar"
            role="progressbar"
            :aria-label="`Progreso del vuelo: ${Math.round(progress.percent)} %`"
            :aria-valuenow="Math.round(progress.percent)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span :style="{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }" />
          </div>
          <p class="progress-km">
            <span>{{ num.format(Math.round(progress.flownKm)) }} km recorridos</span>
            <span>{{ num.format(Math.round(progress.remainingKm)) }} km restantes</span>
          </p>
          <p v-if="eta" class="eta">Llega en ~{{ eta }}</p>
        </div>
      </section>
      <p v-else-if="details" class="note">Ruta no disponible</p>

      <section v-if="info" class="plane" aria-label="Avión">
        <figure v-if="info.photoUrl ?? info.photoThumbnailUrl" class="photo">
          <component
            :is="info.photoLink ? 'a' : 'div'"
            v-bind="info.photoLink ? { href: info.photoLink, target: '_blank', rel: 'noopener' } : {}"
          >
            <img
              :src="info.photoUrl ?? info.photoThumbnailUrl ?? undefined"
              :alt="`Foto del avión ${[info.registration, info.model].filter(Boolean).join(' ')}`"
              loading="lazy"
            />
          </component>
          <!-- Planespotters exige el crédito del fotógrafo con enlace a la foto -->
          <figcaption v-if="info.photographer" class="credit">
            Foto:
            <a v-if="info.photoLink" :href="info.photoLink" target="_blank" rel="noopener">{{ info.photographer }} / Planespotters</a>
            <template v-else>{{ info.photographer }} / Planespotters</template>
          </figcaption>
        </figure>
        <div>
          <p class="model">{{ info.model ?? info.icaoType ?? 'Modelo desconocido' }}</p>
          <p class="reg">
            <span v-if="info.registration" class="mono">{{ info.registration }}</span>
            <span v-if="info.owner"> · {{ info.owner }}</span>
          </p>
        </div>
      </section>

      <!-- Aviationstack busca por indicativo: el botón sale aunque /details no diera ruta -->
      <section v-if="aircraft.callsign" class="schedule" aria-label="Horarios">
        <button
          v-if="!schedule && !scheduleError"
          type="button"
          class="schedule-btn"
          :disabled="scheduleLoading"
          @click="loadSchedule()"
        >
          {{ scheduleLoading ? 'Cargando horarios…' : 'Ver horarios' }}
        </button>
        <p v-else-if="scheduleError" class="note is-warn" role="status">{{ scheduleError }}</p>
        <template v-else-if="schedule">
          <p class="schedule-status">{{ scheduleStatus }}</p>
          <div class="times">
            <div v-for="leg in [
              { label: 'Salida', t: schedule.departure },
              { label: 'Llegada', t: schedule.arrival },
            ]" :key="leg.label">
              <p class="leg">
                {{ leg.label }}
                <span v-if="leg.t.airport" class="mono">{{ leg.t.airport.iata ?? leg.t.airport.icao }}</span>
              </p>
              <template v-for="best in [bestTime(leg.t)]" :key="leg.label">
                <p class="time">
                  {{ best ? atTime(best.iso) : '—' }}
                  <span v-if="leg.t.delayMinutes && leg.t.delayMinutes > 0" class="delay">
                    +{{ leg.t.delayMinutes }} min
                  </span>
                </p>
                <p v-if="best" class="sub">{{ best.label }}</p>
                <p v-if="best && best.label !== 'Programada' && leg.t.scheduled" class="sub">
                  Programada {{ atTime(leg.t.scheduled) }}
                </p>
              </template>
              <p class="sub">
                Terminal {{ leg.t.terminal ?? '—' }} · Puerta {{ leg.t.gate ?? '—' }}
              </p>
            </div>
          </div>
        </template>
        <p class="source">Horarios: {{ schedule?.source ?? 'Aviationstack' }}</p>
      </section>
    </template>

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
.airline {
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--text-2);
}
.note {
  margin: 0 0 14px;
  font-size: 14px;
  color: var(--text-2);
}
.note.is-warn {
  color: var(--warning);
}
.route {
  margin: 0 0 16px;
}
.airports {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.airports > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.airports .end {
  text-align: right;
}
.iata {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.city {
  font-size: 13px;
  color: var(--text-2);
  overflow-wrap: anywhere;
}
.arrow {
  font-size: 22px;
  color: var(--text-2);
}
.bar {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--plane-selected);
}
.progress-km {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.eta {
  margin: 6px 0 0;
  font-weight: 700;
}
.plane {
  margin: 0 0 16px;
}
/* Foto arriba y a todo el ancho del panel, 3:2 como la de Planespotters (420×280) */
.photo {
  margin: 0 0 10px;
}
.photo img {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: 14px;
  background: var(--surface-2);
}
.credit {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-2);
}
.credit a {
  color: inherit;
}
.model {
  margin: 0;
  font-weight: 700;
}
.reg {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.schedule {
  margin: 0 0 16px;
}
.schedule-btn {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.schedule-btn:hover {
  background: var(--line);
}
.schedule-btn:disabled {
  opacity: 0.6;
  cursor: progress;
}
.schedule-status {
  margin: 0 0 8px;
  font-weight: 700;
}
.times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.times p {
  margin: 0;
}
.leg {
  font-size: 13px;
  color: var(--text-2);
}
.time {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.delay {
  white-space: nowrap;
  font-size: 14px;
  color: var(--danger);
}
.source {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-2);
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
