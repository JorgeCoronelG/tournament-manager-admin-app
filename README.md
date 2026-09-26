# base-angular-dashboard

Base para dashboards con **Angular 22**, **Angular Material 3** y **Tailwind CSS 4**.

- Signals, `OnPush` y detección de cambios **zoneless** (sin `zone.js`); Signal Forms.
- Seis layouts (vertical/horizontal), modo claro/oscuro, temas de color y preferencias que se guardan en el navegador.
- i18n (inglés/español) con Transloco, entornos y configuración en runtime, capa HTTP con manejo de errores.
- Feature de ejemplo (dashboard y clientes) con carga lazy sobre una API mock.
- Docker (nginx sin privilegios, cabeceras de seguridad, healthcheck), ESLint, Prettier, Vitest, Playwright (e2e, regresión visual y accesibilidad), CI y Dependabot.

> Aún no incluye **autenticación**: `CurrentUserService` es el punto donde conectarla.

## Requisitos

Node `^22.22.3`, `^24.15.0` o superior, o solo Docker.

## Empezar

```bash
npm ci
npm run api      # API mock en http://localhost:3000 (otra terminal)
npm start        # http://localhost:4200
```

Con Docker (incluye la API mock):

```bash
docker compose --profile dev  up --build   # http://localhost:4200 (hot reload)
docker compose --profile prod up --build   # http://localhost:8080 (nginx)
```

## Scripts

| Comando                    | Descripción                                            |
| -------------------------- | ------------------------------------------------------ |
| `npm start`                | Servidor de desarrollo                                 |
| `npm run api`              | API mock (`mock/db.json`, json-server)                 |
| `npm run build`            | Build de producción (`dist/base-angular-dashboard`)    |
| `npm test`                 | Tests unitarios (Vitest)                               |
| `npm run e2e:docker`       | e2e + regresión visual + accesibilidad, todo en Docker |
| `npm run lint` / `format`  | ESLint / Prettier (`format:check` lo usa CI)           |
| `npm run init -- <nombre>` | Renombra el proyecto tras clonar la base               |

## Estructura

```
src/
├── @ui/          # Kit de UI y layout, independiente de la aplicación
│   ├── components/  config/  services/  pipes/  utils/
│   ├── styles/      # Sass + tailwind.css: tema Material 3, variables, layouts, overrides
│   ├── tailwind/    # tailwind.config.ts y los plugins que generan los temas
│   └── app.provider.ts
├── app/          # La aplicación
│   ├── core/        # settings, http, i18n, navegación, usuario, notificaciones
│   ├── features/    # dashboard, customers, not-found, styleguide (solo desarrollo)
│   ├── layouts/     # layout, toolbar, sidenav, config-panel, footer, user-menu
│   ├── app.config.ts  app.routes.ts
├── environments/ # development (por defecto), production y testing
└── assets/i18n/  # en.json, es.json
e2e/  mock/  nginx/  scripts/
```

Alias `@ui/*` → `src/@ui/*`; prefijo de selectores `app-`.

## Cómo agregar una página

1. Componente standalone `OnPush` en `src/app/features/<feature>/`.
2. Ruta lazy en `src/app/app.routes.ts` (o un archivo de rutas por feature, como `customers.routes.ts`). El `title` de la ruta es una clave de traducción.
3. Entrada en `src/app/core/navigation/navigation-loader.service.ts` (la etiqueta también es una clave).
4. Textos en `src/assets/i18n/en.json` **y** `es.json`.

`features/customers` muestra el patrón completo: `httpResource`, filtros y formulario con Signal Forms, tabla con orden y paginación, estados de carga/error/vacío y tests.

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
- **Marca:** título en `src/@ui/config/app-configs.ts`, logo/favicon en `src/assets/img/logo/logo.svg` y `src/favicon.svg`, título en `src/index.html` (o usa `npm run init`).
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

## Crear un proyecto nuevo desde esta base

```bash
node scripts/init.mjs mi-app "Mi App"   # nombre técnico y nombre visible
```

Renombra `package.json`, `angular.json`, `Dockerfile`, CI, README, título, sidenav y footer. Después reemplaza el logo, quita lo que no uses del ejemplo (`features/customers`, `mock/`) y agrega la autenticación.
