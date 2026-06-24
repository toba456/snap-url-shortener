# Snap — Documentación técnica

Snap es un acortador de URLs con analíticas. Los usuarios se registran, crean alias cortos para sus URLs largas y consultan estadísticas de uso (clicks por día, hora pico, URLs por semana) desde un dashboard personalizado.

---

## Índice

1. [Tecnologías](#tecnologías)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Arrancar la aplicación](#arrancar-la-aplicación)
4. [API del backend](#api-del-backend)
5. [Autenticación](#autenticación)
6. [Base de datos](#base-de-datos)
7. [Tests](#tests)
8. [Arquitectura frontend](#arquitectura-frontend)
9. [Proxy de Vite y colisión de rutas](#proxy-de-vite-y-colisión-de-rutas)

---

## Tecnologías

### Backend

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | ≥ 20 | Runtime |
| TypeScript | 5.x | Tipado estático |
| Express | 4.x | Servidor HTTP |
| better-sqlite3 | 12.x | Base de datos SQLite síncrona |
| bcryptjs | 3.x | Hash de contraseñas |
| jsonwebtoken | 9.x | Generación y verificación de JWT |
| tsx | 4.x | Ejecución directa de TypeScript en desarrollo |
| Vitest | 3.x | Framework de tests unitarios/integración |
| Supertest | 7.x | Tests de endpoints HTTP |

### Frontend

| Tecnología | Versión | Uso |
|---|---|---|
| React | 19.x | UI, Concurrent Mode + StrictMode |
| React Router | 7.x | Enrutado SPA (BrowserRouter) |
| Vite | 8.x | Bundler y servidor de desarrollo |
| TypeScript | 6.x | Tipado estático |
| Playwright | 1.x | Tests end-to-end en Chromium headless |

---

## Estructura del proyecto

```
proyecto_1/
├── src/                        # Código fuente del backend
│   ├── index.ts                # Punto de entrada: crea el servidor HTTP
│   ├── app.ts                  # Express app: monta routers y middlewares
│   ├── config.ts               # Variables de entorno (PORT, JWT_SECRET, DB_NAME)
│   ├── db/
│   │   ├── index.ts            # Singleton de la conexión SQLite
│   │   └── schema.ts           # CREATE TABLE + índices + migración automática
│   ├── middleware/
│   │   ├── authenticate.ts     # Verifica Bearer JWT en cabecera Authorization
│   │   ├── error-handlers.ts   # Manejadores 404 y 500
│   │   └── request-logger.ts   # Log de cada petición
│   ├── modules/
│   │   ├── auth/               # Registro y login
│   │   ├── urls/               # CRUD de URLs + registro de clicks + redirect
│   │   └── dashboard/          # Analíticas del usuario autenticado
│   └── types/
│       └── express.d.ts        # Extiende Request con req.user
│
├── tests/                      # Tests de integración del backend
│   ├── auth.test.ts
│   ├── auth-routes.test.ts
│   ├── authenticate.test.ts
│   ├── config.test.ts
│   ├── dashboard.test.ts
│   ├── health.test.ts
│   └── urls.test.ts
│
├── client/                     # SPA React
│   ├── vite.config.ts          # Config de Vite + proxy hacia el backend
│   ├── index.html              # HTML raíz de la SPA
│   └── src/
│       ├── main.tsx            # Monta BrowserRouter + AuthProvider + App
│       ├── App.tsx             # Árbol de rutas React Router
│       ├── api/
│       │   ├── auth.ts         # Funciones register() y login()
│       │   ├── urls.ts         # getUrls(), createUrl(), deleteUrl()
│       │   └── dashboard.ts    # getDashboard() + fillDailyGaps()
│       ├── store/
│       │   └── authContext.tsx  # Context API: token, user, saveAuth, clearAuth
│       └── pages/
│           ├── Login.tsx
│           ├── Register.tsx
│           └── Dashboard.tsx   # Página principal: stats + tabla de URLs + formulario
│
├── data/
│   └── snap.db                 # Archivo SQLite (generado automáticamente)
│
├── package.json                # Scripts y dependencias del backend
└── vitest.config.ts            # Configuración de Vitest
```

---

## Arrancar la aplicación

Se necesitan **dos terminales**: una para el backend y otra para el frontend.

### Prerrequisitos

- Node.js ≥ 20
- npm ≥ 10

### Terminal 1 — Backend (Express en puerto 3000)

```bash
# Desde la raíz del proyecto
cd /ruta/a/proyecto_1

npm install          # solo la primera vez
npm run dev          # inicia con tsx watch (hot reload)
```

El servidor arranca en `http://localhost:3000`.  
La base de datos `data/snap.db` se crea automáticamente si no existe.

#### Variables de entorno opcionales

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `JWT_SECRET` | `dev-secret-change-me` | Secreto para firmar tokens (cambiar en producción) |
| `DB_NAME` | `snap.db` | Nombre del archivo SQLite en `data/` |
| `NODE_ENV` | `development` | En `production`, `PORT` y `JWT_SECRET` son obligatorias |

### Terminal 2 — Frontend (Vite en puerto 5173)

```bash
# Desde la carpeta client
cd /ruta/a/proyecto_1/client

npm install          # solo la primera vez
npm run dev          # inicia Vite dev server
```

La SPA queda disponible en `http://localhost:5173`.

> **Importante:** el backend debe estar corriendo antes de abrir la SPA, ya que Vite
> redirige las llamadas a la API hacia `localhost:3000` a través de su proxy.

### Verificación rápida

```bash
# Backend alive
curl http://localhost:3000/health
# → {"status":"ok"}

# Abrir la SPA en el navegador
open http://localhost:5173
```

---

## API del backend

Todos los endpoints responden y aceptan `application/json`.

### Endpoints públicos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Comprueba que el servidor está vivo |
| `POST` | `/auth/register` | Registra un usuario nuevo |
| `POST` | `/auth/login` | Inicia sesión, devuelve JWT |
| `GET` | `/urls` | Lista todas las URLs (sin filtro de usuario) |
| `GET` | `/:slug` | Redirige (302) a la URL original y registra un click |

### Endpoints protegidos (requieren `Authorization: Bearer <token>`)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/urls` | Crea una URL corta para el usuario autenticado |
| `DELETE` | `/urls/:slug` | Elimina una URL propia (403 si es ajena) |
| `GET` | `/dashboard` | Devuelve las analíticas del usuario autenticado |

### Ejemplos de cuerpos

**POST /auth/register**
```json
{
  "name": "María García",
  "email": "maria@ejemplo.com",
  "password": "segura123"
}
```
Respuesta `201`:
```json
{
  "token": "<jwt>",
  "user": { "id": 1, "email": "maria@ejemplo.com", "name": "María García" }
}
```

**POST /urls**
```json
{
  "url": "https://es.wikipedia.org/wiki/Planeta",
  "slug": "planeta",
  "expires_at": "2027-12-31 23:59:59"
}
```
`slug` y `expires_at` son opcionales. Si no se envía `slug`, se genera uno aleatorio.

**GET /dashboard** — respuesta:
```json
{
  "resumen": {
    "total_urls": 5,
    "urls_activas": 4,
    "urls_expiradas": 1,
    "total_clicks": 142
  },
  "tendencias": {
    "clicks_por_dia": [
      { "dia": "2026-06-20", "clicks": 12 },
      { "dia": "2026-06-21", "clicks": 8 }
    ],
    "clicks_por_hora": [
      { "hora": 9, "clicks": 34 },
      { "hora": 14, "clicks": 28 }
    ],
    "urls_por_semana": [
      { "semana": "2026-W25", "urls_creadas": 3 }
    ]
  }
}
```

### Códigos de error habituales

| Código | Significado |
|---|---|
| `400` | Datos inválidos o faltantes |
| `401` | Token ausente, inválido o expirado |
| `403` | Intentando eliminar una URL ajena |
| `404` | Slug no encontrado |
| `409` | Email ya registrado / Slug ya en uso |

---

## Autenticación

Snap usa **JWT Bearer tokens**:

1. El cliente llama a `POST /auth/register` o `POST /auth/login`.
2. El backend devuelve `{ token, user }`.
3. En peticiones protegidas el cliente envía:
   ```
   Authorization: Bearer <token>
   ```
4. El middleware `authenticate.ts` verifica la firma y extrae `req.user = { id, email, name }`.

Los tokens no tienen expiración configurada en desarrollo. En producción se debe establecer `expiresIn` en `jwt.sign`.

### Almacenamiento en el frontend

| Clave en localStorage | Contenido |
|---|---|
| `snap_token` | El JWT como string |
| `snap_user` | El objeto user serializado como JSON |

El `AuthContext` inicializa su estado desde `localStorage` en el primer render (lazy `useState`), por lo que la sesión persiste entre recargas de página. `clearAuth()` elimina ambas claves y limpia el estado de React, lo que provoca que React Router redirija automáticamente a `/login`.

---

## Base de datos

SQLite con WAL mode. El archivo vive en `data/snap.db`. Se inicializa mediante `initDb()` en el arranque.

### Esquema

```sql
-- Usuarios del sistema
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- URLs acortadas (user_id = NULL si se creó sin autenticación)
CREATE TABLE urls (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  original_url TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT,                            -- NULL = sin expiración
  user_id      INTEGER REFERENCES users(id)
);

-- Registro de cada redirect (click)
CREATE TABLE clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id     INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  clicked_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Índices de rendimiento
CREATE INDEX idx_urls_user_id              ON urls(user_id);
CREATE INDEX idx_clicks_url_id_clicked_at ON clicks(url_id, clicked_at);
```

### Relaciones

```
users ──< urls ──< clicks
```

- Un usuario puede tener muchas URLs.
- Cada URL puede tener muchos clicks.
- Al eliminar una URL, sus clicks se borran en cascada (`ON DELETE CASCADE`).

### Migración automática

`schema.ts` incluye una migración de `ALTER TABLE` que añade la columna `user_id` si la tabla `urls` existía previamente sin ella (bases de datos creadas antes de implementar autenticación).

---

## Tests

El backend tiene **70 tests** de integración. No usan mocks de la base de datos: cada test crea una instancia SQLite en memoria (`:memory:`) con el esquema completo, lo que garantiza que el comportamiento real de las queries se verifica.

### Ejecutar los tests

```bash
# Desde la raíz del proyecto
npm test                # ejecuta todos los tests una vez
npm run test:watch      # modo vigilancia (re-ejecuta al guardar)
```

### Archivos de tests

| Archivo | Tests | Qué prueba |
|---|---|---|
| `config.test.ts` | 6 | Validación de variables de entorno |
| `health.test.ts` | 1 | Endpoint GET /health |
| `auth.test.ts` | 9 | Servicio de auth (register/login, bcrypt, JWT) |
| `auth-routes.test.ts` | 10 | Endpoints POST /auth/register y /auth/login |
| `authenticate.test.ts` | 6 | Middleware de verificación JWT |
| `urls.test.ts` | 25 | CRUD de URLs, redirect, registro de clicks |
| `dashboard.test.ts` | 13 | Endpoint GET /dashboard, analíticas, aislamiento entre usuarios |

### Patrón de un test típico

```typescript
// Cada test tiene su propia BD en memoria: aislamiento total
function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initDb(db)                        // crea tablas e índices
  return db
}

// El router recibe la BD y el middleware como parámetros
// → permite inyectar un auth simulado en los tests
const app = createTestApp(db, mockAuth(userId))

// El test hace HTTP real contra la app Express
const res = await request(app).get('/dashboard')
expect(res.status).toBe(200)
```

### Tests end-to-end

El script `client/snap-verify.mjs` usa Playwright para verificar los flujos completos en Chromium headless:

```bash
# Requiere que ambos servidores estén corriendo
node client/snap-verify.mjs
```

Cubre: registro, login, crear URL, verificar contador, logout, protección de rutas sin sesión, y detección automática de token corrupto con redirección a login.

---

## Arquitectura frontend

### Árbol de componentes

```
main.tsx
└── StrictMode
    └── BrowserRouter
        └── AuthProvider          ← Context API con token + user
            └── App.tsx           ← Árbol de rutas
                ├── /login        → <Login>
                ├── /register     → <Register>
                ├── /dashboard    → <Dashboard>
                └── *             → redirect según sesión
```

### Flujo de datos

```
localStorage ──► AuthContext ──► App (rutas)
                     │
                     ▼
              Dashboard.tsx
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    GET /urls            GET /dashboard
    (api/urls.ts)        (api/dashboard.ts)
          │                     │
    filtra por            fillDailyGaps()
    user_id               (rellena días vacíos)
          │                     │
          └──────────┬──────────┘
                     ▼
              Estado local React
              (useState: urls, stats)
```

### Páginas

- **Register** (`/register`): formulario de nombre, email, contraseña. Llama a `register()` → `saveAuth()` → redirige a `/dashboard`.
- **Login** (`/login`): formulario email + contraseña. Llama a `login()` → `saveAuth()` → redirige a `/dashboard`.
- **Dashboard** (`/dashboard`): carga datos en paralelo con `Promise.all`, muestra tarjetas de resumen, gráfico de barras de 30 días (HTML puro, sin librería), formulario de creación y tabla de URLs propias. El guard que protege la ruta vive dentro del componente (`if (!token) return <Navigate to="/login">`), después de todos los hooks.

### Reglas de hooks y narrowing de TypeScript

El componente `Dashboard` declara todos los `useState` y `useEffect` **antes** del guard condicional, cumpliendo la regla de React de no llamar hooks después de un `return`. Dentro del `useEffect`, el token se captura en una constante local antes del closure asíncrono:

```typescript
const currentToken: string = token  // necesario para que TypeScript estreche el tipo
async function load() {
  const data = await getDashboard(currentToken)  // ← string, no string | null
}
```

### Actualizaciones optimistas

Al crear o eliminar una URL, el estado local se actualiza **sin hacer una nueva petición** al backend:

- `handleCreated(url)` → prepend a `urls` + incrementa los contadores de `resumen`.
- `handleDeleted(slug)` → filtra de `urls` + decrementa los contadores.

Si la petición falla, el `catch` muestra el error con `role="alert"`.

### Detección de sesión expirada

En el `useEffect` de carga, si la petición al dashboard devuelve 401 con el mensaje `"Sesión expirada"`, se llama a `clearAuth()` automáticamente. Esto limpia `localStorage`, resetea el contexto y React Router redirige a `/login` sin crash ni intervención del usuario.

---

## Proxy de Vite y colisión de rutas

La ruta `/dashboard` existe tanto en el backend (API) como en la SPA (página). Vite resuelve la colisión con la función `bypass`:

```typescript
// client/vite.config.ts
'/dashboard': {
  target: 'http://localhost:3000',
  bypass(req) {
    // Navegación del browser (Accept: text/html) → sirve la SPA
    if (req.headers.accept?.includes('text/html')) {
      return '/index.html'
    }
    // fetch() de la API (Accept: application/json) → proxy al backend
  },
},
```

Sin este bypass, escribir `http://localhost:5173/dashboard` en la barra de direcciones del navegador devolvería el JSON del backend en lugar de cargar la SPA.
