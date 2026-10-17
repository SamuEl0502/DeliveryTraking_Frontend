# Explicación del frontend (Bloque 3: mapa con aviones)

## 1. Qué hace cada archivo

| Archivo | Qué hace |
|---|---|
| `index.html` | Única página HTML: tiene el `<div id="app">`, la etiqueta `viewport` para móvil y carga `src/main.ts`. |
| `package.json` | Lista dependencias y scripts (`npm run dev`, `npm run build`, `npm run typecheck`). |
| `vite.config.ts` | Configura Vite (servidor de desarrollo y empaquetador) con el plugin de Vue. |
| `tsconfig.json` | TypeScript en modo estricto (`strict`, `noUncheckedIndexedAccess`, etc.). |
| `.env.example` | Muestra la variable `VITE_API_URL` (URL del backend) sin secretos. |
| `src/vite-env.d.ts` | Le dice a TypeScript qué variables de entorno existen. |
| `src/main.ts` | Punto de entrada: crea la app, conecta Pinia y el router, carga CSS y monta en `#app`. |
| `src/App.vue` | Componente raíz; solo muestra la vista actual con `<RouterView />`. |
| `src/router/index.ts` | Rutas: `/` muestra el mapa; cualquier otra ruta redirige a `/`. |
| `src/types/aircraft.ts` | Contrato de datos: `AircraftState` y la respuesta de `/api/aircraft`. Igual que en el backend. |
| `src/services/api.ts` | Axios con `baseURL` desde `.env`, interceptor que convierte errores en mensajes claros y `fetchAircraft()`. |
| `src/store/aircraft.ts` | Tienda Pinia: aviones (por `icao24`), `loading`, `error`, `lastUpdated`, `selectedIcao24`. |
| `src/composables/usePolling.ts` | Repite una tarea cada 10 s y se pausa cuando la pestaña está oculta. |
| `src/composables/useSmoothedPosition.ts` | Suavizado (Bloque 4): extrapola la posición con velocidad y rumbo y corrige con lerp en 1 s, en un solo bucle `requestAnimationFrame`. |
| `src/views/MapView.vue` | Pantalla principal: une mapa, resumen, carga, banner de error y panel; arranca el polling. |
| `src/components/AircraftMap.vue` | Mapa Leaflet: dibuja solo aviones en el aire y visibles (máx. 400) y reutiliza marcadores. |
| `src/components/AircraftPanel.vue` | Panel del avión seguido: callsign, velocidad, altitud, aire/tierra y hora. Lateral en escritorio, hoja inferior en móvil. |
| `src/assets/main.css` | Colores (variables), tarjeta `.sheet` estilo Flighty, estilos de los marcadores y altura `100dvh`. |

## 2. Cómo llega un avión desde el backend hasta el mapa

1. **Polling:** al abrir `MapView`, `usePolling` llama a `store.loadAircraft()` y la repite 10 s después de que termine cada respuesta.
2. **Petición:** la tienda llama a `fetchAircraft()` en `services/api.ts`, que hace `GET http://localhost:3000/api/aircraft` con Axios.
3. **Respuesta tipada:** Axios devuelve `{ time, count, aircraft }` con el tipo `AircraftListResponse`. Si falla, el interceptor lo convierte en `ApiError` con un mensaje en español.
4. **Tienda:** Pinia guarda los aviones en un `Map` por `icao24` (normalizado), actualiza `lastUpdated` y limpia `error`. Si hubo error, guarda el mensaje y **conserva los datos anteriores**.
5. **Filtro:** el getter `airborne` deja solo los aviones con `onGround = false`.
6. **Reacción:** `AircraftMap` vigila (`watch`) los datos. Cuando cambian, toma los aviones en el aire que están dentro de la zona visible del mapa, hasta 400.
7. **Marcadores:** si el avión ya tenía marcador, solo lo mueve (`setLatLng`) y lo gira según su rumbo. Si es nuevo, lo crea. Los que salieron de la vista se quitan.
8. **Clic:** al tocar un avión, `store.select(icao24)` lo marca como seguido y aparece `AircraftPanel` con sus datos. La X o un clic en zona vacía lo cierran.

## 3. Preguntas probables del profesor

1. **¿Por qué no dibujas los 4400 aviones?**
   Porque miles de elementos en el DOM vuelven lento el mapa. Solo dibujo los que están en el aire y en pantalla, con tope de 400. El avión seguido se dibuja siempre.

2. **¿Cómo evitas borrar y recrear todos los marcadores cada 10 s?**
   Guardo los marcadores en un `Map` por `icao24`. En cada ciclo muevo los existentes, creo solo los nuevos y quito los que ya no se ven.

3. **¿Por qué `shallowRef` en la tienda?**
   Con `ref` normal, Vue convertiría en reactivos los miles de objetos (lento). Con `shallowRef` solo reacciona cuando reemplazo el `Map` completo, una vez por ciclo.

4. **¿Por qué `setTimeout` encadenado y no `setInterval`?**
   Así la siguiente petición sale cuando termina la anterior. Si el servidor tarda, no se acumulan peticiones. Además se pausa con la pestaña oculta para no gastar red ni cupo de OpenSky.

5. **¿Qué pasa si se apaga el backend?**
   El interceptor convierte el fallo en `ApiError("No se pudo conectar con el servidor")`. La tienda guarda el mensaje, aparece un banner rojo con "Reintentar" y el mapa sigue mostrando los últimos datos.

6. **¿Dónde está la URL del backend y por qué no está fija en el código?**
   En `VITE_API_URL` dentro de `.env`. Así cambia por entorno (local, producción) sin tocar el código. `.env` no se sube a Git; `.env.example` sí.

7. **¿Cómo garantizas TypeScript estricto sin `any`?**
   `tsconfig` con `strict` y `noUncheckedIndexedAccess`. Las respuestas de Axios se tipan con `api.get<AircraftListResponse>` y los errores se capturan como `unknown`. `npm run typecheck` revisa todo, incluidos los `.vue`.

8. **¿Cómo es responsive?**
   Mobile-first con corte en 768 px. El mapa usa `100dvh` (descuenta las barras del navegador móvil). El panel es hoja inferior en móvil y lateral en escritorio. Cada avión tiene un área de toque de 40 px y los botones miden al menos 44 px.

---

## 4. Suavizado de trayectoria (Bloque 4)

**El problema:** el backend actualiza los datos cada 30 s (caché). Sin suavizado, el avión se quedaría quieto 30 s y luego saltaría varios kilómetros.

**La solución tiene dos partes:**

### a) Extrapolación: "¿dónde debería estar ahora?"

Con el último dato sabemos dónde estaba el avión (`lat`, `lng`), a qué hora (`ts`), qué tan rápido iba (`spd`, en m/s) y hacia dónde (`hdg`, en grados desde el norte).

1. **Tiempo transcurrido:** `t = ahora − ts` (en segundos).
2. **Distancia recorrida:** `d = velocidad × t` (en metros). Ejemplo: 250 m/s × 20 s = 5 km.
3. **Repartir según el rumbo:** hacia el norte avanza `d × cos(rumbo)` y hacia el este `d × sin(rumbo)`. Rumbo 0° = todo al norte; 90° = todo al este.
4. **Pasar metros a grados:**
   - Latitud: `metros al norte ÷ radio de la Tierra`, convertido a grados.
   - Longitud: igual, pero dividiendo también por `cos(latitud)`, porque los meridianos se juntan hacia los polos y un grado de longitud mide menos lejos del ecuador.

En pocas palabras: **posición nueva = posición vieja + velocidad × tiempo, en la dirección del rumbo.** Es una aproximación plana, suficiente para distancias de pocos kilómetros.

**Cuándo NO se extrapola:** si está en tierra, si falta la velocidad o el rumbo, o si el último dato tiene más de 2 minutos ("señal perdida": el avión se muestra atenuado y quieto).

### b) Corrección con lerp: "sin saltos cuando llega el dato real"

Cuando llega un dato nuevo, la estimación casi nunca coincide exacto con la realidad. En vez de saltar, durante 1 segundo se mezclan las dos:

`posición = desde + (hacia − desde) × t`, con `t` que va de 0 a 1 en ese segundo.

- `desde` = donde estaba dibujado el avión cuando llegó el dato.
- `hacia` = la nueva extrapolación (que también sigue avanzando).

### c) Rendimiento

- Un **único** bucle `requestAnimationFrame` mueve todos los aviones animados (~60 veces por segundo).
- Solo se anima el avión seguido y hasta 60 visibles; el resto se recoloca una vez por render (cada dato nuevo o cada 5 s).
- El navegador pausa `requestAnimationFrame` en pestañas ocultas, y el bucle se cancela al destruir el componente.
- Si el usuario pidió "reducir movimiento" en su sistema, se omite la transición de 1 s.

### Preguntas del profesor sobre el suavizado

1. **¿Por qué extrapolar y no solo interpolar entre dos puntos?**
   Interpolar necesita el punto siguiente, así que el avión iría siempre 30 s atrasado. Extrapolar estima la posición actual con velocidad y rumbo, y el lerp corrige el pequeño error cuando llega el dato real.

2. **¿Por qué `requestAnimationFrame` y no `setInterval`?**
   Se sincroniza con el refresco de la pantalla (animación fluida), el navegador lo pausa en pestañas ocultas y se cancela con `cancelAnimationFrame` al desmontar el componente.

3. **¿Por qué no animas los 400 aviones?**
   Mover 400 marcadores 60 veces por segundo son 24 000 actualizaciones del DOM por segundo. Con el seguido + 60 la animación sigue fluida en móvil; a zoom lejano el movimiento del resto ni se nota.

4. **¿Qué pasa si llega el mismo dato dos veces?**
   El frontend pide cada 10 s pero el backend cambia cada 30 s. Si el `ts` es igual no se reinicia la corrección, así el avión no "tiembla"; la extrapolación sigue avanzando normal.
