<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAircraftStore } from '../store/aircraft';
import type { AircraftState } from '../types/aircraft';
import { airlineName, searchFlights } from '../utils/flightSearch';

const emit = defineEmits<{ pick: [aircraft: AircraftState] }>();

const store = useAircraftStore();
const query = ref('');
const open = ref(false);
const active = ref(-1);

// Filtra en el cliente toda la lista de EE. UU. del store: no gasta API
const results = computed(() => searchFlights(store.airborne, query.value));
const showList = computed(() => open.value && query.value.trim() !== '');
watch(query, () => {
  open.value = true;
  active.value = -1;
});

function pick(a: AircraftState): void {
  emit('pick', a);
  query.value = '';
  open.value = false;
}

function onKey(e: KeyboardEvent): void {
  const n = results.value.length;
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault();
    open.value = true;
    active.value = (active.value + 1) % n;
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault();
    active.value = (active.value - 1 + n) % n;
  } else if (e.key === 'Enter') {
    // Con un solo resultado, Enter lo abre directo
    const a = results.value[active.value] ?? (n === 1 ? results.value[0] : undefined);
    if (a) pick(a);
  } else if (e.key === 'Escape') {
    open.value = false;
  }
}
</script>

<template>
  <div class="search">
    <label for="flight-search" class="sr-only">Buscar vuelo por número</label>
    <input
      id="flight-search"
      v-model="query"
      type="search"
      placeholder="Buscar vuelo (WN590, UAL1855)"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-autocomplete="list"
      aria-controls="flight-search-list"
      :aria-expanded="showList"
      :aria-activedescendant="active >= 0 ? `flight-opt-${active}` : undefined"
      @keydown="onKey"
      @focus="open = true"
      @blur="open = false"
    />
    <ul v-show="showList" id="flight-search-list" class="list" role="listbox" aria-label="Vuelos encontrados">
      <li
        v-for="(a, i) in results"
        :id="`flight-opt-${i}`"
        :key="a.icao24"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
        @mousedown.prevent="pick(a)"
      >
        <span class="mono">{{ a.callsign }}</span>
        <span v-if="airlineName(a.callsign!)" class="airline">{{ airlineName(a.callsign!) }}</span>
      </li>
      <li v-if="!results.length" class="empty" role="status">No hay vuelos en el aire con ese número</li>
    </ul>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  margin-top: 10px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 16px;
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  font-size: 16px; /* 16 px evita el zoom automático de iOS al enfocar */
}
input:focus {
  outline: 2px solid var(--plane-selected);
  outline-offset: 1px;
}
.list {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 1;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: var(--shadow);
}
li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  border-radius: 10px;
  cursor: pointer;
}
li.active,
li:not(.empty):hover {
  background: var(--surface-2);
}
.mono {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-weight: 700;
}
.airline {
  font-size: 13px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  color: var(--text-2);
  cursor: default;
}
</style>
