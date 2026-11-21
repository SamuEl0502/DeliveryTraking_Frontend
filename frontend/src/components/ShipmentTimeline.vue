<script setup lang="ts">
import type { ShipmentEvent, TrackingEventType } from '../types/shipment';

defineProps<{ events: ShipmentEvent[] }>();

// Nombre en español de cada tipo de evento
const EVENT_LABELS: Record<TrackingEventType, string> = {
  RECEIVED: 'Recibido',
  LOADED: 'Cargado en el avión',
  TOOK_OFF: 'El avión despegó',
  LANDED: 'El avión aterrizó',
  UNLOADED: 'Descargado',
  DELIVERED: 'Entregado',
  ALERT: 'Alerta',
  ASSIGNED: 'Vuelo asignado',
  REASSIGNED: 'Vuelo reasignado',
  UNASSIGNED: 'Vuelo desasignado',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}
</script>

<template>
  <!-- Los eventos ya vienen del más reciente al más antiguo -->
  <p v-if="events.length === 0" class="empty">Todavía no hay movimientos registrados.</p>

  <ol v-else class="timeline">
    <li v-for="(event, index) in events" :key="event.id" class="item" :class="{ first: index === 0 }">
      <span class="dot" aria-hidden="true" />
      <div class="body">
        <p class="title">{{ EVENT_LABELS[event.type] }}</p>
        <p class="date">{{ formatDate(event.occurredAt) }}</p>
        <p v-if="event.airport" class="place">{{ event.airport.name }} · {{ event.airport.city }}</p>
        <p v-if="event.note" class="note">{{ event.note }}</p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.empty {
  margin: 0;
  font-size: 14px;
  color: var(--text-2);
}
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
}
/* Línea vertical que une los puntos */
.item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: var(--line);
}
.dot {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--line);
}
/* El evento más reciente se resalta */
.first .dot {
  background: var(--green);
}
.body {
  min-width: 0;
}
.body p {
  margin: 0;
}
.title {
  font-size: 15px;
  font-weight: 600;
}
.date,
.place {
  font-size: 13px;
  color: var(--text-2);
}
.note {
  margin-top: 2px;
  font-size: 14px;
  overflow-wrap: anywhere;
}
</style>
