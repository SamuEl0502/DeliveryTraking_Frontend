<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
</script>

<template>
  <div class="app">
    <AppHeader />
    <!-- El resto de la pantalla (100dvh menos la cabecera) es para la vista -->
    <div class="app-main">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.app-main {
  flex: 1;
  min-height: 0; /* sin esto el mapa empuja la columna y aparece scroll */
}
</style>
