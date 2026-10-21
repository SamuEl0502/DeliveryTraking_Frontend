# Delivery Tracking con tracking geoespacial en vivo (WebSockets, suavizado de trayectoria en el frontend y recálculo dinámico de ETA)

Sistema robusto de **rastreo geoespacial en tiempo real de paquetes y envíos aéreos**, desarrollado con un backend en Node.js y TypeScript. Conecta la telemetría en vivo de aeronaves sobre el espacio aéreo de EE. UU. (vía **OpenSky Network**) con una arquitectura modular por capas, caché de baja latencia y observabilidad completa.

## Stack

Vue 3 · TypeScript estricto · Vite · Pinia · Vue Router · Axios · Leaflet (tiles de OpenStreetMap)

## Requisitos

- Node.js LTS (probado con v24) y npm
- El backend corriendo (por defecto en `http://localhost:3000`)

## Instalar y correr (PowerShell)

```powershell
cd frontend
npm install
Copy-Item .env.example .env   # luego ajusta los valores si hace falta
npm run dev                   # abre http://localhost:5173
```

Otros comandos:

```powershell
npm run typecheck   # revisa tipos (incluye archivos .vue)
npm run build       # typecheck + build de producción en dist/
npm run preview     # sirve el build localmente
```

## Variables de entorno (`frontend/.env.example`)

- `VITE_API_URL`: URL base del backend (si falta, se usa `http://localhost:3000`).

## Contrato con el backend

Los tipos de `src/types/aircraft.ts` son los mismos de `backend/types/aircraft.ts`. Se compararon campo por campo el 19 de octubre de 2026.

- `GET /api/aircraft` → `{ time, count, aircraft: AircraftState[] }`.
- `GET /api/aircraft/:icao24` → un `AircraftState` suelto. El `icao24` son 6 caracteres hexadecimales.
- Unidades: `spd` en m/s, `alt` en metros, `hdg` en grados desde el norte (sentido horario), `ts` y `time` en segundos Unix.
- `lat` y `lng` nunca son `null` porque el backend descarta los aviones sin posición. `callsign` llega sin espacios, o `null` si queda vacío. `ts` puede valer `0` si OpenSky no manda ninguna hora.
- Errores: `{ error: { code, message, correlationId } }`. Códigos: 400 `VALIDATION_ERROR` / `INVALID_JSON`, 404 `NOT_FOUND` / `AIRCRAFT_NOT_FOUND`, 429 `TOO_MANY_REQUESTS` (300 peticiones por IP cada 15 min en `/api`), 502 `OPENSKY_UNAVAILABLE` / `OPENSKY_AUTH_FAILED` / `OPENSKY_BAD_RESPONSE`, 503 `OPENSKY_QUOTA_EXCEEDED`, 504 `OPENSKY_TIMEOUT`, 500 `FIXTURE_MISSING` / `INTERNAL_ERROR`.

El archivo `.env` va dentro de `frontend/` (Vite solo lee los de esa carpeta) y nunca se sube a Git.

## Estructura

```
frontend/
  src/
    types/        contratos de la API (iguales al backend)
    services/     Axios tipado con interceptor de errores
    store/        tiendas Pinia (aviones, selección, carga, error)
    composables/  usePolling (polling 10 s) · useSmoothedPosition (suavizado)
    components/   AircraftMap (Leaflet) · AircraftPanel (avión seguido)
    views/        MapView (pantalla principal)
    router/       rutas
  EXPLICACION.md  guía del código y del flujo de datos
```

## Estado actual

**Funciona hoy**
- Mapa con aviones reales sobre EE. UU., consultando al backend cada 10 s (pausa con la pestaña oculta).
- Solo se dibujan los aviones en el aire y visibles (máx. 400), rotados según su rumbo.
- Clic en un avión: panel con callsign, velocidad, altitud, estado y hora de la última posición.
- Movimiento suave: extrapolación con velocidad y rumbo, más corrección con lerp; "señal perdida" tras 2 min sin datos.
- Indicador de carga y banner de error con reintento si el backend no responde. El banner muestra el `message` que manda el backend y su `correlationId` como "ref." para buscarlo en los logs. Si la respuesta no trae ese formato, muestra un mensaje genérico con el código HTTP.
- Si OpenSky no manda la hora de un avión (`ts = 0`), el panel muestra "sin hora" y "Señal perdida", en vez de una fecha de 1970.
- Panel del avión: la foto va arriba, a todo el ancho del panel y en proporción 3:2, con el crédito "Foto: {fotógrafo} / Planespotters" enlazado a la página de la foto, como exige Planespotters. Debajo están la ruta y la barra de progreso del recorrido, que no lleva número; el porcentaje queda solo en el `aria-label` para lectores de pantalla.
- Buscador de vuelos en la tarjeta "En el aire". Filtra en el navegador la lista de aviones en el aire que ya trajo el backend, así que no gasta API. Acepta el número comercial IATA (`WN590`, `B6123`) y lo traduce al callsign ICAO (`SWA590`, `JBU123`) para las 11 aerolíneas principales de EE. UU. (tabla en `src/utils/flightSearch.ts`). El callsign ICAO también funciona directo. Muestra hasta 8 sugerencias, cada una con su número comercial (`WN590`) si la aerolínea está en la tabla; con clic o Enter se abre el panel del avión y el mapa vuela hasta él. Se maneja con teclado: flechas, Enter y Escape. Prueba: `npm test` (Node 22.6 o superior).
- Etiqueta del vuelo, al estilo FlightRadar24: el avión seleccionado muestra encima una píldora azul con su número de vuelo. Igual que la cabecera del panel, muestra el número comercial (`WN590`) y no el indicativo ICAO (`SWA590`). Orden: el `flightNumber` de `/schedule`, el de la ruta, la conversión del callsign con la aerolínea de adsbdb (`route.airline`, aunque la ruta no esté verificada) o con la tabla de `src/utils/flightSearch.ts`, luego el callsign tal cual y por último el icao24. Los indicativos tipo matrícula (`N123AB`, aviación general) se quedan como están, igual que en FlightRadar24. La etiqueta sigue al avión y desaparece al cerrar el panel. Es un único `L.tooltip` ligado al marcador seleccionado y tiene `aria-hidden`, porque el panel ya muestra el dato.
- Icono según el tipo de avión: con el campo `type` (tipo ICAO, como `B738`), `src/utils/aircraftClass.ts` lo clasifica en una de 7 clases (avioneta, jet privado, regional, fuselaje estrecho, fuselaje ancho, jumbo y helicóptero). Lo hace con excepciones exactas y reglas por prefijo; un tipo desconocido cuenta como fuselaje estrecho, y sin tipo se usa el icono genérico. Cada clase tiene su silueta SVG propia, que no está copiada de tar1090 ni de dump1090 porque son GPL, y su propio tamaño: de 16 px para las avionetas a 28 px para los jumbos. Hay un `divIcon` en caché por clase, así que no se crean SVG en cada render. Los tipos salen de la base de Mictronics (licencia ODC-By), que se cita en la atribución del mapa. Prueba: `npm test`.
- Aeropuertos en el mapa: al seleccionar un avión con ruta confirmada, se pone un punto con el código en el origen y otro en el destino, sin línea entre ellos (el recorrido lo muestra la estela). La ruta sale de `/schedule` si llegó, o de `/details` solo si está verificada; una ruta inventada no se dibuja.
- Despegue real y ruta estimada: si la ruta está verificada pero `estimated` (el origen es el despegue que vio OpenSky y el destino viene de adsbdb), se muestra como verificada, con sus aeropuertos en el mapa y progreso, más la nota "Origen según el despegue · destino estimado". Si no hay ruta confirmada pero llega `departure`, el panel muestra "Despegó de …" y "Destino desconocido", y el mapa solo pone un punto en ese aeropuerto, sin progreso. La ruta de `/schedule` sigue mandando sobre las demás.
- Estela desde el despegue, al estilo FlightRadar24: al seleccionar un avión se pide `GET /api/aircraft/:icao24/track` y se vuelve a pedir cada 60 s mientras siga seleccionado. Cada consulta cuesta 4 créditos de otra cuenta de OpenSky, y el backend la guarda 1 min en caché. A ese recorrido se le suman las posiciones reales que llegan por el polling, de modo que el trazo termina en el avión. Cada tramo toma el color de la altitud de su punto y lleva un punto pequeño en cada posición. Solo se guardan posiciones reales, cuando cambia el `ts`; la posición suavizada solo se usa para la línea fina final hasta el icono, y así no aparecen zigzags. Si el backend responde 404 `TRACK_NOT_FOUND`, la estela empieza al seleccionar el avión. Todo se borra al deseleccionar.
- Color por altitud de la estela, al estilo FlightRadar24: tierra gris, < 600 m verde, 600–3.000 m verde-amarillo, 3.000–6.000 m naranja, 6.000–9.000 m rojo, 9.000–12.000 m magenta y > 12.000 m violeta (`src/utils/altitude.ts`). Solo la estela cambia de color; los marcadores van de un solo color, con el azul de seleccionado y el gris de señal perdida. Una leyenda plegable "Altitud" junto al zoom muestra las franjas de la estela en m y ft. Prueba: `npm test`.
- Diseño responsive (mobile-first, panel lateral en escritorio y hoja inferior en móvil).

**Viene después**
- Autenticación (access token + refresh token rotativo) y navigation guards por rol.
- Envíos: lista del cliente, detalle e historial de eventos del paquete.
- WebSocket por vuelo en lugar del polling.
- ETA dinámico del envío en el mapa.

- ```text
Fecha de actualización: Octubre 2026
Estado del módulo: Fase 1 (Completado y Operativo)
Entorno de ejecución: Node.js (LTS) + Express 5 + TypeScript
