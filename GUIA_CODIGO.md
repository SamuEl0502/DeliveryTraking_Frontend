# Guía del código (frontend)

Guía para explicar el código de este repositorio. Este repo es **solo el frontend**; el backend (Express + OpenSky) vive en otro repo y aquí solo aparece como "la API".

**Recorrido general de un dato en el frontend:**
`API (backend) -> services/api.ts -> store/aircraft.ts -> views/MapView.vue -> components/AircraftMap.vue -> mapa (Leaflet)`
y, si haces clic en un avión, `-> components/AircraftPanel.vue`.

---

## Parte 1. Archivos de configuración

### `frontend/package.json`
**Para qué existe:** define el proyecto para npm: nombre, scripts y librerías.
**Dónde encaja:** fuera del recorrido; se usa al instalar (`npm install`) y al arrancar (`npm run dev`).

- `"type": "module"`: los archivos `.js`/`.ts` usan `import`/`export` (módulos ES).
- `scripts`:
  - `dev` → `vite`: servidor de desarrollo con recarga automática (puerto 5173).
  - `build` → `vue-tsc -b && vite build`: primero revisa tipos y, si pasan, genera la versión de producción en `dist/`.
  - `preview` → `vite preview`: sirve localmente lo que quedó en `dist/`.
  - `typecheck` → `vue-tsc -b`: solo revisa tipos (también dentro de los `.vue`). Deja un archivo de caché `tsconfig.tsbuildinfo`, ignorado por Git.
- `dependencies` (van al navegador): `vue` (interfaz), `vue-router` (rutas), `pinia` (estado global), `axios` (peticiones HTTP), `leaflet` (mapa).
- `devDependencies` (solo para desarrollar): `vite` y `@vitejs/plugin-vue` (servidor/empaquetador), `typescript` fijado en `~5.9.3` (la versión 7 no funciona con `vue-tsc`), `vue-tsc` (TypeScript para `.vue`), `@vue/tsconfig` (configuración base recomendada), `@types/leaflet` (tipos de Leaflet).

### `frontend/tsconfig.json`
**Para qué existe:** le dice a TypeScript qué revisar y con qué nivel de exigencia.
**Dónde encaja:** fuera del recorrido; lo usan `vue-tsc` y el editor.

- `extends: "@vue/tsconfig/tsconfig.dom.json"`: parte de la configuración oficial de Vue para navegador (módulos ES, `moduleResolution: bundler`, `verbatimModuleSyntax`, etc.).
- `strict: true`: activa todos los chequeos estrictos (por ejemplo, no permite `null` donde se espera un valor).
- `noUncheckedIndexedAccess`: al leer `lista[i]` o `objeto[clave]`, TypeScript avisa de que podría ser `undefined`.
- `noUnusedLocals` / `noUnusedParameters`: error si hay variables o parámetros sin usar.
- `noFallthroughCasesInSwitch`: error si un `case` de un `switch` cae al siguiente sin `break`.
- `noImplicitOverride`: obliga a escribir `override` al sobrescribir métodos de una clase.
- `include`: revisa todo `src/` (`.ts` y `.vue`) y `vite.config.ts`.

### `frontend/vite.config.ts`
**Para qué existe:** configura Vite.
- `plugins: [vue()]`: permite que Vite entienda archivos `.vue`.
- `server: { port: 5173 }`: puerto del servidor de desarrollo.

### `frontend/.env.example`
**Para qué existe:** plantilla de variables de entorno, sin secretos. Se copia a `frontend/.env`.
- `VITE_API_URL`: URL base del backend. Vite solo expone al navegador las variables que empiezan por `VITE_`.

### `.gitignore` (raíz)
**Para qué existe:** lista lo que Git no debe subir.
- `node_modules/`, `dist/`: librerías instaladas y build; se regeneran.
- `.env`, `.env.*` con la excepción `!.env.example`: los secretos no se suben, la plantilla sí.
- `*.log`, `*.tsbuildinfo`: archivos generados.

### `frontend/index.html`
**Para qué existe:** la única página HTML de la app (SPA).
**Dónde encaja:** es lo primero que carga el navegador.
- `<meta name="viewport" ...>`: hace que en móvil la página use el ancho real del teléfono.
- `<div id="app">`: donde Vue monta la aplicación.
- `<script type="module" src="/src/main.ts">`: arranca el código.

### `frontend/src/vite-env.d.ts`
**Para qué existe:** solo tipos (no genera código). Le dice a TypeScript que `import.meta.env.VITE_API_URL` existe y es `string` opcional.
**Dónde encaja:** lo usa `services/api.ts` al leer la URL del backend.

---

## Parte 2. Archivos de código

### `frontend/src/main.ts`
**Para qué existe:** punto de entrada; arma y monta la aplicación.
**Dónde encaja:** inicio de todo: `index.html -> main.ts -> App.vue -> router -> MapView`.

- No define funciones. Una sola línea encadenada:
  `createApp(App)` crea la app → `.use(createPinia())` activa las tiendas → `.use(router)` activa las rutas → `.mount('#app')` la dibuja en el `<div id="app">`.
- Importa también `leaflet/dist/leaflet.css` (estilos que Leaflet necesita para dibujar bien el mapa) y `assets/main.css` (estilos globales).

### `frontend/src/App.vue`
**Para qué existe:** componente raíz.
**Dónde encaja:** `main.ts -> App.vue -> <RouterView />`.

- **Componente `App`**: no recibe props ni emite eventos. Solo contiene `<RouterView />`, el hueco donde el router pinta la vista de la ruta actual.

### `frontend/src/router/index.ts`
**Para qué existe:** define qué vista se ve en cada URL.
**Dónde encaja:** `App.vue -> router -> MapView.vue`.

- **`router`** (constante exportada, creada con `createRouter`). La usa `main.ts`.
  - `createWebHistory()`: URLs limpias, sin `#`.
  - Ruta `/` (nombre `map`) → `MapView.vue`, cargada con `() => import(...)` (carga diferida: el código del mapa se descarga cuando se necesita).
  - Ruta `/:pathMatch(.*)*` → cualquier otra URL redirige a `/`.
- Aún no hay *navigation guards*; llegan con la autenticación.

### `frontend/src/types/aircraft.ts`
**Para qué existe:** el contrato de datos con el backend (mismo tipo en ambos lados).
**Dónde encaja:** lo usan casi todos: `api.ts`, el store, los composables y los componentes.

- **`AircraftState`** (interfaz): un avión. Campos: `icao24` (id del avión), `callsign` (indicativo o `null`), `lat`, `lng`, `hdg` (rumbo en grados desde el norte o `null`), `spd` (velocidad en m/s o `null`), `alt` (altitud en metros o `null`), `onGround` (en tierra sí/no), `ts` (hora de la posición, Unix en segundos).
- **`AircraftSnapshot`** (interfaz): un lote de aviones: `time` (hora del lote según OpenSky) y `aircraft` (lista).
- **`AircraftListResponse`** (interfaz): respuesta de `GET /api/aircraft`. Es un `AircraftSnapshot` más `count` (total). La usa `fetchAircraft()`.

### `frontend/src/services/api.ts`
**Para qué existe:** la única puerta de salida hacia el backend; centraliza Axios y el manejo de errores.
**Dónde encaja:** `store -> api.ts -> backend` y la respuesta vuelve `backend -> api.ts -> store`.

- **Clase `ApiError`** (extiende `Error`): recibe `message` (texto) y `status` (código HTTP o `null`). Es el único tipo de error que ve el resto de la app. La crea el interceptor y la revisa `loadAircraft()` del store.
- **`api`** (instancia de Axios): `baseURL` sale de `VITE_API_URL` o, si falta, `http://localhost:3000`; `timeout` de 8 s. La usa `fetchAircraft()`.
- **Interceptor de respuesta** (función anónima en `api.interceptors.response.use`): si la respuesta es buena la deja pasar. Si falla, la convierte en `ApiError`:
  - tiempo agotado (`ECONNABORTED`) → "El servidor tardó demasiado en responder";
  - sin respuesta (backend apagado, sin red o CORS) → "No se pudo conectar con el servidor";
  - con respuesta de error (4xx/5xx) → "El servidor respondió con error N" con su `status`;
  - cualquier otra cosa → "Error inesperado".
  Lo ejecuta Axios automáticamente en cada respuesta.
- **`fetchAircraft()`**: no recibe nada; devuelve `Promise<AircraftListResponse>`. Hace `GET /api/aircraft` y devuelve solo el cuerpo (`data`). La llama `loadAircraft()` del store.

### `frontend/src/store/aircraft.ts`
**Para qué existe:** tienda Pinia; única fuente de verdad sobre los aviones, la carga, el error y el avión seguido.
**Dónde encaja:** `api.ts -> store -> MapView / AircraftMap / AircraftPanel`.

- **`useAircraftStore`** (tienda creada con `defineStore('aircraft', ...)`, estilo *setup*). La usan `MapView.vue` y `AircraftMap.vue`.

**Estado:**
- `byIcao`: `Map` de `icao24 → AircraftState` (datos normalizados: buscar un avión por id es directo). Es `shallowRef`: Vue no vigila cada uno de los miles de objetos, solo el reemplazo del `Map` completo.
- `loading`: `true` mientras hay una petición en curso.
- `error`: mensaje del último error o `null`.
- `lastUpdated`: `Date.now()` de la última carga exitosa o `null`.
- `selectedIcao24`: id del avión seguido o `null`.

**Getters (`computed`):**
- `total`: cantidad de aviones en `byIcao`. *Hoy no lo usa ningún componente.*
- `airborne`: lista de aviones con `onGround = false`. La usan `MapView` (contador) y `AircraftMap` (qué dibujar).
- `selected`: el `AircraftState` del avión seguido o `null`. Lo usan `MapView` (mostrar el panel) y `AircraftMap`.
- `hasData`: `true` si ya hubo al menos una carga exitosa. Lo usa `MapView`.

**Acciones:**
- **`loadAircraft()`**: no recibe nada; devuelve `Promise<void>`. Si ya hay una petición en curso, no hace nada. Si no, llama a `fetchAircraft()`, construye un `Map` nuevo y lo guarda en `byIcao`; si el avión seguido no vino en este lote, conserva su último estado. Actualiza `lastUpdated` y borra `error`. Si falla, guarda el mensaje en `error` y **no borra los datos anteriores**. La llaman `usePolling` (cada 10 s) y el botón "Reintentar" de `MapView`.
- **`select(icao24)`**: recibe un id; no devuelve nada. Marca ese avión como seguido. La llama el clic en un marcador (`AircraftMap`).
- **`clearSelection()`**: no recibe nada; no devuelve nada. Deja de seguir el avión. La llaman el botón X del panel (vía `MapView`) y el clic en zona vacía del mapa (`AircraftMap`).

### `frontend/src/composables/usePolling.ts`
**Para qué existe:** repetir una tarea cada cierto tiempo, de forma reutilizable y segura.
**Dónde encaja:** `MapView -> usePolling -> store.loadAircraft() -> api.ts`.

- **`usePolling(task, intervalMs)`**: recibe una función asíncrona `task` y un intervalo en milisegundos; no devuelve nada. Al montar el componente ejecuta `task` y, cuando termina, programa la siguiente con `setTimeout`. Se pausa si la pestaña se oculta y vuelve a ejecutar al mostrarse. Se limpia al desmontar. La llama `MapView.vue` con `store.loadAircraft` y `10_000`.
  - **`tick(myRound)`** (interna): ejecuta `task` y, si sigue activa la misma "ronda", programa el siguiente `tick`. La llaman `start()` y el propio `setTimeout`.
  - **`start()`** (interna): si no estaba activo, abre una ronda nueva y ejecuta `tick` de inmediato. La llaman `onMounted` y `onVisibilityChange`.
  - **`stop()`** (interna): marca inactivo y cancela el `setTimeout` pendiente. La llaman `onVisibilityChange` y `onUnmounted`.
  - **`onVisibilityChange()`** (interna): pestaña oculta → `stop()`; visible → `start()`. La llama el navegador con el evento `visibilitychange`.
  - El contador `round` evita que, si ocultas y muestras la pestaña mientras una petición está en curso, queden dos cadenas de polling a la vez.

### `frontend/src/composables/useSmoothedPosition.ts`
**Para qué existe:** que los aviones se muevan suave entre actualizaciones del backend (cada 30 s por la caché) en vez de saltar.
**Dónde encaja:** `store -> AircraftMap -> useSmoothedPosition -> marcador de Leaflet` (en cada fotograma).

**Constantes:** `SIGNAL_LOST_S = 120` (2 min sin datos = señal perdida; exportada), `CORRECTION_MS = 1000` (duración de la corrección), `EARTH_RADIUS_M = 6 371 000` (radio de la Tierra), `DEG` (factor radianes ↔ grados).

**Tipos:** `LatLng` (`{ lat, lng }`, exportado) y `Track` (interno: estado del avión, desde dónde corrige, cuándo empezó la corrección y última posición dibujada).

**Funciones exportadas (puras, sin estado):**
- **`secondsSince(a, nowMs)`**: recibe un avión y la hora actual en ms; devuelve los segundos desde su `ts` (nunca negativo). La usan `isSignalLost` y `extrapolate`.
- **`isSignalLost(a, nowMs)`**: devuelve `true` si pasaron más de 120 s desde el último dato. La usa `AircraftMap` (atenuar marcador y decidir si animar).
- **`extrapolate(a, nowMs)`**: devuelve un `LatLng` con la posición estimada *ahora*: avanza `velocidad × tiempo` en la dirección del rumbo. Si está en tierra o falta velocidad o rumbo, devuelve la posición tal cual. El tiempo se limita a 120 s (el avión se congela al perder señal). La usan `frame()` y `AircraftMap` (marcadores no animados y marcadores nuevos).

**Función interna:**
- **`lerp(from, to, t)`**: recibe dos posiciones y un `t` entre 0 y 1; devuelve el punto intermedio. La usa `frame()`.

**Composable:**
- **`useSmoothedPosition(draw)`**: recibe una función `draw(icao24, pos)` que mueve un marcador; devuelve `{ setState, remove }`. Mantiene una lista de aviones animados y un único bucle `requestAnimationFrame`. Lo llama `AircraftMap.vue`.
  - **`frame()`** (interna): en cada fotograma, para cada avión calcula `extrapolate(...)`; si está dentro del segundo de corrección, mezcla con `lerp` desde donde estaba dibujado; llama a `draw`. Se reprograma mientras haya aviones. La llama el navegador vía `requestAnimationFrame`.
  - **`setState(state, current)`**: recibe el estado nuevo de un avión y dónde está dibujado su marcador; no devuelve nada. Si el avión es nuevo, lo registra; si ya existía y el `ts` cambió, inicia una corrección de 1 s desde la última posición dibujada (si el `ts` es igual, no reinicia nada). Arranca el bucle si estaba detenido. La llama `render()` de `AircraftMap`.
  - **`remove(icao24)`**: deja de animar ese avión. La llama `render()` de `AircraftMap`.
  - Al desmontar el componente, cancela el bucle (`cancelAnimationFrame`) y vacía la lista.
  - Si el sistema tiene activado "reducir movimiento" (`prefers-reduced-motion`), la corrección es inmediata.

### `frontend/src/views/MapView.vue`
**Para qué existe:** la pantalla principal; reúne todas las piezas.
**Dónde encaja:** `router -> MapView -> (AircraftMap, AircraftPanel)`; arranca el polling.

- **Componente `MapView`**: no recibe props.
  - `POLL_INTERVAL_MS = 10_000`: cada cuánto se piden aviones.
  - Llama a `usePolling(store.loadAircraft, POLL_INTERVAL_MS)`.
  - `onScreen` (ref): cuántos aviones dibuja el mapa; se actualiza con el evento `rendered` de `AircraftMap`.
  - `updatedAt` (computed): `lastUpdated` formateado como hora (`hh:mm:ss`), o `null`.
  - `firstLoad` (computed): `true` si está cargando y aún no hay datos (muestra "Cargando aviones…").
- **Plantilla:**
  - `<AircraftMap>`: el mapa.
  - Tarjeta resumen: "En el aire", número de aviones en el aire y en pantalla, y hora de actualización con un spinner mientras carga.
  - Banner de error (si `store.error`): mensaje, hora de los últimos datos y botón "Reintentar" (llama a `store.loadAircraft()`).
  - Indicador de primera carga.
  - `<AircraftPanel>` solo si hay avión seguido; su evento `close` llama a `store.clearSelection()`.
- **Estilos:** mobile-first; desde 768 px la tarjeta y el banner pasan a una columna a la izquierda.

### `frontend/src/components/AircraftMap.vue`
**Para qué existe:** dibujar el mapa y mantener sincronizados los marcadores con el store, con buen rendimiento.
**Dónde encaja:** `store -> AircraftMap -> Leaflet`; también `clic en marcador -> store.select()`.

- **Componente `AircraftMap`**: no recibe props. Emite `rendered(count)` con cuántos aviones dibujó (lo escucha `MapView`).
- **Constantes:** `MAX_MARKERS = 400` (tope de marcadores), `MAX_ANIMATED = 60` (tope de animados, además del seguido), `STALE_CHECK_MS = 5000` (cada cuánto se revisa la señal perdida), `US_CENTER` (centro inicial del mapa).
- **Variables internas:** `map`, `layer` (grupo de marcadores), `staleTimer` y `markers` (`Map` de `icao24 → marcador`). Se guardan fuera de la reactividad de Vue a propósito (más rápido).
- **`smooth`**: resultado de `useSmoothedPosition`, con un `draw` que busca el marcador y le hace `setLatLng`.
- **`planeIcon`**: un único icono `divIcon` compartido: SVG de avión apuntando al norte, de 40×40 px (área de toque) aunque el dibujo mide 22 px.

**Funciones:**
- **`applyState(marker, a, isSelected, lost)`**: recibe un marcador, su avión y dos banderas; no devuelve nada. Rota el SVG según `hdg` y pone/quita las clases CSS `is-selected`, `is-ground` e `is-stale`. La llama `render()`.
- **`canAnimate(a, now)`**: devuelve `true` si el avión está en el aire, tiene velocidad y rumbo, y no perdió señal. La llama `render()`.
- **`render()`**: no recibe ni devuelve nada. Es el corazón del mapa:
  1. Arma la lista de visibles: primero el avión seguido (siempre), luego aviones de `store.airborne` dentro de la zona visible (con un margen del 5 %) hasta 400.
  2. Para cada visible: si no tiene marcador lo crea (con clic → `store.select`); si es el seguido o cabe entre los 60 animados, se lo pasa a `smooth.setState`; si no, lo coloca con una sola `extrapolate`. Luego `applyState`.
  3. Quita los marcadores que ya no están en la lista (y los saca de la animación).
  4. Emite `rendered`.
  La llaman: al montar, el evento `moveend` del mapa (mover o hacer zoom), los `watch` de `store.byIcao` y `store.selectedIcao24`, y el temporizador de 5 s.
- **`onMounted`**: crea el mapa centrado en EE. UU. (zoom 4), el control de zoom abajo a la izquierda, los tiles de OpenStreetMap y el grupo de marcadores; registra `moveend`, el clic en zona vacía (→ `store.clearSelection()`) y el temporizador; hace el primer `render()`.
- **`onUnmounted`**: detiene el temporizador y destruye el mapa (`map.remove()`).

### `frontend/src/components/AircraftPanel.vue`
**Para qué existe:** mostrar los datos del avión seguido.
**Dónde encaja:** `store.selected -> MapView -> AircraftPanel`; su botón X emite `close` → `MapView` → `store.clearSelection()`.

- **Componente `AircraftPanel`**: recibe la prop `aircraft: AircraftState`; emite `close`.
- `now` + `clock`: un reloj que se actualiza cada 1 s (solo para el texto "hace X s"); se limpia al desmontar.
- **Computeds:**
  - `callsign`: el callsign sin espacios o "Sin callsign".
  - `speed`: `{ kmh, kt }` a partir de m/s (× 3.6 y × 1.94384) o `null`.
  - `altitude`: `{ m, ft }` a partir de metros (× 3.28084) o `null`.
  - `positionTime`: hora de `ts` formateada.
  - `ageSeconds` / `ageText`: antigüedad del dato ("hace 12 s" o "hace 3 min").
  - `signalLost` / `lostMinutes`: si pasaron más de `SIGNAL_LOST_S` (120 s) y cuántos minutos.
- **Plantilla:** chips con ICAO24 y hora, botón X circular de 44 px, callsign grande, estado ("En el aire" verde, "En tierra" gris o "Señal perdida hace X min" ámbar), cuadrícula con velocidad, altitud, rumbo y posición, y línea de "Última posición".
- **Estilos:** en móvil es una hoja inferior (bottom sheet); desde 768 px pasa a panel lateral derecho.

### `frontend/src/assets/main.css`
**Para qué existe:** estilos globales.
**Dónde encaja:** lo importa `main.ts`; afecta a toda la app.

- `:root`: variables de color (tokens), por ejemplo `--green`, `--danger`, `--warning`, `--plane`, `--plane-selected`, `--plane-ground`.
- `html, body` con `overflow: hidden` y `#app` con `height: 100dvh`: el mapa ocupa toda la pantalla sin scroll.
- `.sheet`: la tarjeta blanca de esquinas grandes (estilo Flighty) usada en resumen, banner y panel.
- `.plane-marker` y variantes `.is-selected`, `.is-ground`, `.is-stale`: aspecto de los aviones. Son globales porque Leaflet crea esos elementos fuera de los componentes de Vue.
- `.leaflet-bar a`: botones de zoom de 44 px.

---

## Parte 3. Recorrido de un dato de punta a punta

1. El navegador carga `index.html`, que ejecuta `main.ts`: se crea la app con Pinia y el router.
2. El router ve la URL `/` y carga `MapView.vue`.
3. `MapView` se monta: `AircraftMap` crea el mapa y `usePolling` llama a `store.loadAircraft()`.
4. `loadAircraft()` pone `loading = true` y llama a `fetchAircraft()`.
5. `fetchAircraft()` hace `GET {VITE_API_URL}/api/aircraft` con Axios.
6. El backend responde `{ time, count, aircraft: [...] }`. (Si falla, el interceptor crea un `ApiError` y el store guarda el mensaje en `error`; `MapView` muestra el banner.)
7. El store guarda los aviones en un `Map` nuevo por `icao24`, actualiza `lastUpdated` y pone `loading = false`.
8. Como `byIcao` cambió, el `watch` de `AircraftMap` llama a `render()`.
9. `render()` toma de `store.airborne` los aviones dentro de la zona visible (máx. 400), crea o reutiliza sus marcadores y los rota según su rumbo.
10. El avión seguido y hasta 60 más pasan a `useSmoothedPosition`; su bucle `requestAnimationFrame` los mueve en cada fotograma (extrapolación + corrección con lerp).
11. Al hacer clic en un avión, `store.select(icao24)` cambia `selectedIcao24`; `MapView` muestra `AircraftPanel` con `store.selected`.
12. 10 s después de terminar la petición, `usePolling` repite desde el paso 4 (si la pestaña está visible).

---

## Parte 4. Glosario

| Término | Significado |
|---|---|
| **SPA** | Aplicación de una sola página: el HTML carga una vez y Vue cambia el contenido sin recargar. |
| **Componente** | Pieza de interfaz reutilizable en un archivo `.vue` (script + plantilla + estilos). |
| **Props / emits** | Datos que un componente recibe de su padre / eventos que le envía al padre. |
| **Reactividad (`ref`, `computed`)** | `ref` guarda un valor que, al cambiar, actualiza la pantalla; `computed` es un valor derivado que se recalcula solo. |
| **`shallowRef`** | `ref` que solo reacciona cuando se reemplaza el valor completo, no cuando cambia algo interno. |
| **Pinia / store** | Librería de estado global: datos compartidos por varios componentes en un solo lugar. |
| **Estado normalizado** | Guardar los elementos por su id (`Map` de `icao24 → avión`) en vez de una lista, para buscar rápido. |
| **Composable** | Función reutilizable (`useAlgo`) que agrupa lógica con estado y ciclo de vida de Vue. |
| **Axios / interceptor** | Librería para peticiones HTTP / función que se ejecuta en cada respuesta para tratarla de forma común. |
| **Polling** | Pedir datos al servidor cada cierto tiempo (aquí, 10 s). |
| **Leaflet / tiles** | Librería de mapas / imágenes cuadradas del mapa (aquí, de OpenStreetMap). |
| **Extrapolación** | Estimar la posición actual a partir de la última, la velocidad y el rumbo. |
| **Lerp** | Interpolación lineal: punto intermedio entre A y B según un valor `t` de 0 a 1. |
| **`requestAnimationFrame`** | Pide al navegador ejecutar una función antes del próximo fotograma (~60 por segundo). |
| **icao24** | Identificador único del transpondedor del avión, usado como id. |

---

## Parte 5. Si el profesor pide X, dónde toco

| Si piden… | Archivo | Qué cambiar |
|---|---|---|
| Cambiar cada cuánto se piden los aviones | `src/views/MapView.vue` | `POLL_INTERVAL_MS` (y el texto "Se reintenta cada 10 s" del banner). |
| Cambiar la URL del backend | `frontend/.env` (desde `.env.example`) | `VITE_API_URL`. |
| Cambiar el tiempo de espera de las peticiones | `src/services/api.ts` | `timeout: 8000`. |
| Cambiar los mensajes de error | `src/services/api.ts` | Textos dentro del interceptor. |
| Validar un parámetro de ruta | En este repo no hay rutas con parámetros. En el backend se hace con Zod (otro repo). En el frontend iría en `src/router/index.ts` (ruta con `:icao24` y un guard `beforeEnter`). *Por confirmar con el equipo.* |
| Validar la respuesta del backend | `src/services/api.ts`, en `fetchAircraft()` | Hoy se confía en el tipo; se podría validar con Zod antes de devolver `data`. |
| Agregar un campo al avión | `src/types/aircraft.ts` (y el mismo tipo en el backend) | Añadir el campo a `AircraftState`; luego mostrarlo en `AircraftPanel.vue`. |
| Cambiar qué muestra el panel | `src/components/AircraftPanel.vue` | Plantilla (`<dl class="stats">`) y sus `computed`. |
| Panel lateral más ancho o en otro lado | `src/components/AircraftPanel.vue` | `.panel` dentro de `@media (min-width: 768px)`. |
| Cambiar un color | `src/assets/main.css` | Variables en `:root` (por ejemplo `--plane-selected`, `--green`). |
| Cambiar el tamaño o forma del avión | `src/components/AircraftMap.vue` (`planeIcon`) y `src/assets/main.css` (`.plane-marker .plane`) | SVG y tamaños. |
| Dibujar más o menos aviones | `src/components/AircraftMap.vue` | `MAX_MARKERS`. |
| Animar más o menos aviones | `src/components/AircraftMap.vue` | `MAX_ANIMATED`. |
| Cambiar el tiempo de "señal perdida" | `src/composables/useSmoothedPosition.ts` | `SIGNAL_LOST_S` (lo usan el mapa y el panel). |
| Corrección más lenta o rápida | `src/composables/useSmoothedPosition.ts` | `CORRECTION_MS`. |
| Cambiar el centro o zoom inicial del mapa | `src/components/AircraftMap.vue` | `US_CENTER` y el `4` de `setView`. |
| Cambiar el mapa base (tiles) | `src/components/AircraftMap.vue` | URL de `L.tileLayer` (respetando la atribución). |
| Agregar una pantalla nueva | `src/views/` + `src/router/index.ts` | Crear la vista y añadir su ruta. |
| Cambiar el punto de corte responsive | Estilos de `MapView.vue` y `AircraftPanel.vue` | Los `@media (min-width: 768px)`. |

---

## Por confirmar

- **Reloj del navegador vs. hora de OpenSky:** la extrapolación y el "hace X s" comparan `Date.now()` del navegador con `ts` (hora de OpenSky). Si el reloj del equipo está desfasado, las estimaciones se desvían. No se ha medido cuánto.
- **Cobertura de la respuesta:** el texto "aviones sobre EE. UU." asume que el backend filtra por la caja geográfica de EE. UU.; el frontend no lo verifica.
- **Caché de 30 s del backend:** el valor viene del backend (otro repo); si cambia allí, el frontend sigue funcionando, pero la explicación del suavizado cambiaría.
