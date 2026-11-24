# Tournament Manager - Panel de administración

Panel web para administrar **torneos de fútbol amateur**: ligas, equipos, jugadores, árbitros, canchas, calendario, resultados y estadísticas. Hoy muchas ligas llevan todo en credenciales físicas, Excel y WhatsApp; este sistema centraliza el registro de jugadores y la operación del torneo para evitar los "cachirules" (jugadores inscritos en más de un equipo o suspendidos que siguen jugando).

## El proyecto completo

Tournament Manager se compone de tres partes:

| Parte                              | Descripción                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Panel web (este repositorio)**   | Angular 22, Angular Material 3, Tailwind CSS 4, Transloco. Lo usan el superadministrador y los administradores de liga.                |
| **API (`tournament-manager-api`)** | Laravel 13, PHP 8.5, MySQL 8.4, autenticación con Sanctum. Es la fuente de datos del panel y de la app móvil.                          |
| **App móvil (React Native)**       | Los jugadores se registran con foto y el árbitro escanea su QR para validar si puede jugar (con y sin internet). Consume la misma API. |

## Qué hace el panel

- **Usuarios y roles:** superadministrador, administrador de liga, árbitro, delegado de equipo y jugador. Cada rol ve solo los módulos y acciones que le corresponden (capacidades en `core/auth/role-capabilities.ts`).
- **Ligas:** alta, estatus (activa/inactiva) y límite de torneos activos por liga (configurado por el superadmin). El superadmin trabaja sobre una liga a la vez con el selector de liga de la barra superior.
- **Torneos:** configuración, inscripciones de equipos, plantillas (rosters), grupos, calendario, estadísticas e historial de torneos terminados.
- **Calendario y partidos:** fase regular por jornadas y liguilla opcional (a partido único o ida y vuelta), horarios, árbitros, canchas y captura de resultados. Descarga de imágenes de horarios y resultados.
- **Estadísticas:** tabla de posiciones con criterios de desempate configurables.
- **Equipos, jugadores, árbitros y canchas** por liga. Un equipo pertenece a una sola liga.
- **Panel principal:** métricas globales (superadmin, con filtro por liga) y métricas por liga (administrador de liga).

## Reglas de negocio importantes

- La liguilla es opcional: si el torneo no la tiene, termina al cerrar la fase regular.
- Un torneo en planeación no cuenta para el límite de torneos activos de la liga.
- Un equipo pertenece a una sola liga; si participa en otra, se da de alta de nuevo.
- Los listados usan paginación, orden y búsqueda del lado del servidor.

> El nombre técnico del paquete y del proyecto de Angular sigue siendo `base-angular-dashboard` (viene de la plantilla de la que se partió). Por eso aparece en `dist/`, en `angular.json` y en los ejemplos de Docker de este README.

## Stack del panel

- Signals, `OnPush` y detección de cambios **zoneless** (sin `zone.js`); Signal Forms.
- Seis layouts (vertical/horizontal), modo claro/oscuro, temas de color y preferencias que se guardan en el navegador.
- i18n con Transloco (textos en español), entornos y configuración en runtime, capa HTTP con manejo de errores.
- Docker (nginx sin privilegios, cabeceras de seguridad, healthcheck), ESLint, Prettier, Vitest, Playwright (e2e, regresión visual y accesibilidad), CI y Dependabot.
- Autenticación con token Bearer: login, recuperación y activación de cuenta, guards por sesión y por rol/capacidad (`core/auth/`).

## Requisitos

Node `^22.22.3`, `^24.15.0` o superior, o solo Docker.

## Empezar

```bash
npm ci
npm start        # http://localhost:4200
```

Con Docker:

```bash
docker compose --profile dev  up --build   # http://localhost:4200 (hot reload)
docker compose --profile prod up --build   # http://localhost:8080 (nginx)
```

Detener y limpiar (con `--profile` igual que al levantar):

```bash
docker compose ps                                  # contenedores del proyecto en ejecución
docker compose --profile dev down                  # detiene y elimina los contenedores y la red (usa prod si levantaste prod)
docker compose --profile dev down -v               # además elimina los volúmenes (el node_modules del contenedor)
docker compose --profile dev down --rmi local      # además elimina las imágenes que construyó el proyecto
docker compose -f docker-compose.e2e.yml down -v   # lo mismo para el stack de e2e (el script ya lo hace al terminar)
```

Con `Ctrl+C` en la terminal donde corre `up` se detienen los contenedores, pero no se eliminan.

Limpieza general de Docker (afecta a **todo** Docker, no solo a este proyecto; revisa antes lo que se va a borrar):

```bash
docker ps -a                  # contenedores (también los detenidos)
docker images                 # imágenes
docker container prune        # elimina los contenedores detenidos
docker image prune            # elimina las imágenes sin etiqueta (<none>)
docker image prune -a         # elimina todas las imágenes que ningún contenedor usa
docker volume prune           # elimina los volúmenes que ningún contenedor usa
docker builder prune          # elimina la caché de build
docker system prune -a --volumes   # todo lo anterior junto
```

## Scripts

| Comando                   | Descripción                                            |
| ------------------------- | ------------------------------------------------------ |
| `npm start`               | Servidor de desarrollo                                 |
| `npm run build`           | Build de producción (`dist/base-angular-dashboard`)    |
| `npm test`                | Tests unitarios (Vitest)                               |
| `npm run e2e:docker`      | e2e + regresión visual + accesibilidad, todo en Docker |
| `npm run lint` / `format` | ESLint / Prettier (`format:check` lo usa CI)           |

## Estructura

```
src/
├── @ui/          # Kit de UI y layout, independiente de la aplicación
│   ├── components/  config/  services/  pipes/  utils/
│   ├── styles/      # Sass + tailwind.css: tema Material 3, variables, layouts, overrides
│   ├── tailwind/    # tailwind.config.ts y los plugins que generan los temas
│   └── app.provider.ts
├── app/          # La aplicación
│   ├── core/        # settings, http, i18n, navegación, usuario, auth, contexto de liga, snackbar
│   ├── features/    # un módulo por área (ver abajo)
│   ├── layouts/     # layout, toolbar, sidenav, footer, user-menu
│   ├── shared/      # componentes y utilidades compartidas (diálogos, estado de listas, etc.)
│   ├── app.config.ts  app.routes.ts
├── environments/ # development (por defecto), production y testing
└── assets/i18n/  # es.json
e2e/  nginx/  scripts/
```

Módulos en `src/app/features/`:

- **Acceso:** `login`, `forgot-password`, `activate-account`, `change-password`, `not-found`.
- **Administración:** `dashboard`, `users`, `leagues`.
- **Torneos:** `tournaments` (gestión e historial), `registrations` (inscripciones), `rosters` (plantillas), `groups` (grupos y liguilla), `matches` (calendario, resultados y estadísticas).
- **Catálogos por liga:** `teams`, `players`, `referees`, `fields`.
- `styleguide`: solo desarrollo.

Alias `@ui/*` → `src/@ui/*`; prefijo de selectores `app-`.

## Cómo agregar una página

1. Componente standalone `OnPush` en `src/app/features/<feature>/`.
2. Ruta lazy en `src/app/app.routes.ts` (o un archivo de rutas por feature, como `users.routes.ts`). El `title` de la ruta es una clave de traducción.
3. Entrada en `src/app/core/navigation/navigation-loader.service.ts` (la etiqueta también es una clave).
4. Textos en `src/assets/i18n/es.json`.

`features/users` muestra el patrón base: `httpResource`, filtros y formulario con Signal Forms, tabla con orden, paginación y scroll propio, estados de carga/error/vacío y tests.

## Configuración por entorno

`apiUrl` sale de `src/environments/environment*.ts`. En runtime, `config.json` (junto a `index.html`) la sobrescribe, así que **la misma imagen sirve para cualquier ambiente**. La imagen Docker lo genera al arrancar desde variables de entorno:

```bash
docker run -p 8080:8080 -e API_URL=https://api.ejemplo.com base-angular-dashboard
```

`API_URL` también se agrega a `connect-src` de la CSP. Por defecto es `/api` (mismo origen).

## Tema y estilos

Los colores viven en **un solo lugar**: `themes` en [tailwind.config.ts](src/@ui/tailwind/tailwind.config.ts).

```
tailwind.config.ts (themes) ──plugin──▶ variables CSS (--app-color-*, --app-foreground-*, --app-background-*)
                                        │  @ui/styles/_themes.scss
                                        ▼
                             tokens Material 3 (--mat-sys-*) → componentes Material
```

Cambiar de tema o de esquema en runtime solo intercambia variables CSS.

- **Agregar un tema:** entrada en `themes` y en `availableThemes` de `src/app/app.config.ts`.
- **Marca:** título en `src/@ui/config/app-configs.ts`, logo/favicon en `src/assets/img/logo/logo.png` y `src/favicon.png`, título en `src/index.html`.
- **Tailwind 4 con config JS:** se carga con `@config` desde `src/@ui/styles/tailwind.css`, que importa todo **sin `layer()`** a propósito: las utilidades sin capa (junto con `important: ":root"`) son las que ganan a Angular Material. Los SCSS que usan `@apply` o `theme()` llevan `@reference` a ese archivo.
- **Material 3:** solo `primary` viene de serie; `color="accent"`/`"warn"` se mantienen para botones e iconos (`_button.scss`, `_icon.scss`). Los overrides de tokens (`mat.*-overrides`) van en `body`, no en `:root`.

## Convenciones

Detalle completo en [CLAUDE.md](CLAUDE.md). En corto: standalone + `OnPush`, `inject()`, API de signals, zoneless (el estado que cambia fuera de eventos debe ser un signal), Signal Forms, `@if/@for`, sin `any`, elementos interactivos nativos (`<button>`/`<a>`), Sass con `@use`, todo texto visible traducido.

## Docker y despliegue

La imagen de producción (`nginxinc/nginx-unprivileged`, puerto **8080**, imágenes base fijadas por digest) corre sin root, expone `/healthz`, envía CSP y demás cabeceras de seguridad, y sirve `index.html` sin caché y los archivos con hash como `immutable`. El servicio `prod` de compose añade sistema de archivos de solo lectura, `cap_drop: ALL` y `no-new-privileges`.

## Pruebas y CI

- `npm test`: unitarias (Vitest).
- `npm run e2e:docker`: flujos, accesibilidad (axe, claro y oscuro) y regresión visual. Tras un cambio visual intencional: `sh scripts/e2e-docker.sh --update-snapshots=all` y revisa las imágenes en el PR.
- [CI](.github/workflows/ci.yml): formato, lint, tests, build, e2e y prueba de humo de la imagen. [Publicación](.github/workflows/publish.yml): imagen multi-arquitectura (amd64/arm64) a GHCR en `main` y en tags `v*`.
- [Dependabot](.github/dependabot.yml): agrupa Angular, lint/formato, tests y Tailwind; ignora las mayores de Angular (requieren `ng update`). Playwright se actualiza a mano junto con su imagen.
