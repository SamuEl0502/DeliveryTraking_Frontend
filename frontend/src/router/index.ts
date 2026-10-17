import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'map', component: () => import('../views/MapView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
