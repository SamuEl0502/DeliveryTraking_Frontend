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
- Indicador de carga y banner de error con reintento si el backend no responde.
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
