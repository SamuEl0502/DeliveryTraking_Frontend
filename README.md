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
- Icono según el modelo, al estilo FlightRadar24: con el campo `type` (tipo ICAO, como `B738`), `familyOf` en `src/utils/aircraftFamily.ts` elige una de 20 familias de silueta. Primero busca en una tabla de tipos exactos y después por prefijo; sin tipo, o con un tipo que no reconoce, usa `generic`. Las siluetas son dibujos propios en SVG vistos desde arriba, que respetan la relación entre envergadura y largo, la posición del ala y de los motores y el número de motores. No están copiadas de tar1090 ni de dump1090-fa (GPL) ni de FlightRadar24.

  | Familia | Tipos de ejemplo | Medida mayor | Icono |
  |---|---|---|---|
  | `cessna-high` | C172, C182, C152, C72R | 11 m | 14 px |
  | `piston-low` | P28A, SR22, S22T, DA40, BE36, M20P | 10,7 m | 14 px |
  | `piston-twin` | PA44, BE58, PA34, DA42, C310 | 11,8 m | 14 px |
  | `turboprop-single` | PC12, TBM9, C208, KODI | 16,3 m | 16 px |
  | `kingair` | BE20, B350, BE9L, PAY* | 16,6 m | 16 px |
  | `bizjet-light` | C25B, E55P, C56X, C68A, LJ*, PC24 | 16,3 m | 16 px |
  | `bizjet-large` | CL35, CL60, G280, E545; GLF*, GL7T (29,4 m) | 21 m | 17 px (GL*: 20) |
  | `regional-rear` | CRJ9, CRJ7; E145 (29,9 m) | 36,2 m | 23 px (E145: 20) |
  | `ejet` | E75L, E170, E190 | 31,7 m | 21 px |
  | `a220` | BCS1, BCS3 | 38,7 m | 24 px |
  | `a320` | A318–A321, A19N, A20N, A21N | 37,6 m (A321: 44,5) | 23 px (A321: 26) |
  | `b737` | B737, B738, B38M, B39M | 39,5 m | 24 px |
  | `b757-767` | B752, B753; B763 (54,9 m) | 47,3 m | 27 px (767: 29) |
  | `b777-787` | B77W, B772; B789 (62,8 m) | 73,9 m | 36 px (787: 32) |
  | `a330-a350` | A333, A359, A343, MD11 | 66,8 m | 33 px |
  | `jumbo` | B744, B748, A388 | 70,7 m | 35 px (A388: 36) |
  | `turboprop-regional` | AT76, DH8D, SF34, C130 | 27,2 m | 20 px |
  | `heli` | R44, EC35, AS50, B407, H60 | rotor de 10 m | 14 px (H60: 16) |
  | `military-trainer` | TEX2, T38, PC21 | 10,2 m | 14 px |
  | `generic` | todo lo demás | — | 22 px |

  El tamaño es proporcional a la medida mayor del modelo (envergadura o largo): `px = 10 + 0,35 × metros`, entre 14 y 36 px. Dentro de una familia, algunos tipos tienen su propia medida, como el 767 frente al 757 o el 787 frente al 777. Con el zoom, el mapa pone la variable CSS `--zoom-scale` en `zoomend`: 0,85 con zoom ≤ 5, 1 con 6–7 y 1,3 con zoom ≥ 8. El seleccionado sigue × 1,35 y la rotación por rumbo no cambia. Hay un `divIcon` en caché por familia y tamaño (unas decenas para 400 marcadores) y `setIcon` solo se llama si cambia. Los tipos salen de la base de Mictronics (licencia ODC-By), que se cita en la atribución del mapa. Prueba: `npm test`.
- Aeropuertos en el mapa: al seleccionar un avión con ruta confirmada, se pone un punto con el código en el origen y otro en el destino, sin línea entre ellos (el recorrido lo muestra la estela). La ruta sale de `/schedule` si llegó, o de `/details` solo si está verificada; una ruta inventada no se dibuja.
- Despegue real: solo se muestran rutas confirmadas, sin rutas estimadas. Si no hay ruta confirmada pero llega `departure`, el panel muestra "Despegó de …" y "Destino desconocido", y el mapa solo pone un punto en ese aeropuerto, sin progreso. La ruta de `/schedule` sigue mandando sobre las demás.
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
