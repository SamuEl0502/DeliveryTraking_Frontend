import { onMounted, onUnmounted } from 'vue';

/**
 * Ejecuta `task` al montar el componente y luego cada `intervalMs`.
 * Usa setTimeout encadenado (no setInterval): el siguiente ciclo se programa
 * cuando termina el anterior, así una respuesta lenta no acumula peticiones.
 */
export function usePolling(task: () => Promise<void>, intervalMs: number): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  // Cada start() abre una "ronda"; un tick de una ronda vieja no reprograma (evita cadenas dobles)
  let round = 0;

  async function tick(myRound: number): Promise<void> {
    await task();
    if (active && myRound === round) timer = setTimeout(() => void tick(myRound), intervalMs);
  }

  function start(): void {
    if (active) return;
    active = true;
    round += 1;
    void tick(round);
  }

  function stop(): void {
    active = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  // Pestaña oculta: no se gasta red ni cupo de OpenSky. Al volver, refresca de inmediato.
  function onVisibilityChange(): void {
    if (document.hidden) stop();
    else start();
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) start();
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stop();
  });
}
