# CLAUDE.md

Base de dashboard con Angular 22, Angular Material 3 y Tailwind CSS 4. Lee el [README](README.md) para la visión general; aquí están las reglas que hay que respetar al modificar el código.

## Comandos

```bash
npm start              # ng serve
npm run build          # build de producción
npm test               # Vitest vía ng test (usa -- --watch=false en CI)
npm run lint           # ESLint; debe terminar sin errores ni warnings
npm run format         # Prettier; format:check lo verifica
```

Antes de dar algo por terminado: `npm run format:check && npm run lint && npm test -- --watch=false && npm run build`. El build no debe emitir warnings.

Node no siempre está instalado en la máquina: si falta, ejecuta los comandos dentro de `node:24` con Docker montando el proyecto.

## Estructura

- `src/@ui/` — kit de UI/layout (alias `@ui/*`). No debe importar nada de `src/app/`.
- `src/app/` — la aplicación: rutas, navegación, layouts.
- El prefijo de selectores es `app-` (`<app-toolbar>`), las clases CSS/variables usan `app-` (`.app-layout-poseidon`, `--app-sidenav-width`) y los símbolos `App*` (`AppConfigService`, `provideApp`).
- Estado global del layout: `AppLayoutService` (`@ui/services`). Configuración y tema en runtime: `AppConfigService` (`@ui/config`). Ambos exponen **signals de solo lectura** y métodos para mutarlos.

## Reglas de código

- Componentes standalone (es el valor por defecto; no escribas `standalone: true`) con `changeDetection: ChangeDetectionStrategy.OnPush`.
- `inject()` en lugar de inyección por constructor. Servicios con `@Service()` de `@angular/core`.
- Signals: `input()`, `output()`, `model()`, `viewChild()`, `computed()`, `effect()`. **No** uses `@Input`, `@Output`, `@ViewChild`, `@HostListener` ni `@HostBinding`; los bindings del host van en `host: {}`.
- Estado derivado de observables: `toSignal()`. Evita `| async` en templates nuevos.
- **La app es zoneless** (no existe `zone.js`). Un valor que cambie fuera de un evento del template (timers, callbacks, promesas) tiene que ser un `signal` o la vista no se actualizará. No uses `ChangeDetectorRef.markForCheck()` como parche.
- Formularios nuevos: Signal Forms (`form()` de `@angular/forms/signals` y `[formField]`), no `FormGroup`/`ngModel`.
- Templates: `@if` / `@for` (con `track`) / `@switch` / `@let`. Nada de `*ngIf`, `*ngFor` ni `ngClass`/`ngStyle`; usa `[class]`/`[style]`.
- Sin `any` (usa `unknown` o genéricos): es error de ESLint.
- Los elementos interactivos son `<button type="button">` o `<a>`. No pongas `(click)` en un `div`/`span`: es error de ESLint (accesibilidad). Un fondo que solo captura clics lleva `role="presentation"`.
- Nuevas páginas: carga lazy (`loadComponent`) dentro de los `children` del layout en `app.routes.ts` y entrada en `navigation-loader.service.ts`.
- Providers de inicialización: `provideEnvironmentInitializer()`. `ENVIRONMENT_INITIALIZER` está deprecado.
- Formato lo decide Prettier (`.prettierrc.json`); no lo discutas ni lo formatees a mano. No edites archivos generados.

## Estilos

- Sass siempre con `@use` (o `meta.load-css`), **nunca `@import`**.
- Los colores salen de `themes` en `src/@ui/tailwind/tailwind.config.ts` → variables CSS (plugin `@ui/tailwind/plugins/themes.ts`) → tokens `--mat-sys-*` en `@ui/styles/_themes.scss`. No hardcodees colores en componentes: usa las clases de Tailwind (`bg-primary-600`, `text-default`) o las variables `--app-*`.
- Angular Material 3: solo `primary` viene de serie. `color="accent"` y `color="warn"` funcionan únicamente en botones y `mat-icon` (`partials/plugins/@angular/material/_button.scss` y `_icon.scss`).
- Overrides de tokens de Material (`mat.*-overrides`) van dentro de `body`, no de `:root`: las variables que referencian a otras se resuelven donde se declaran.
- Tailwind 4 se usa con la config JS (`@config`). Un SCSS con `@apply` o `theme()` necesita `@reference` a `src/@ui/styles/tailwind.css` en su primera línea; prefiere clases en el HTML en código nuevo. No importes Tailwind con `layer()`: las utilidades deben quedar sin capa para ganar a Material.
- Los plugins de Tailwind usan `plugin` de `@ui/tailwind/utils/plugin` (no `tailwindcss/plugin` directo) y no pueden usar `e()`.
- Los estilos globales y de Material viven en `@ui/styles`; los de un componente, junto al componente.

## Verificar cambios de UI

`npm run e2e:docker` levanta `ng serve` + la API mock + Playwright en Docker y corre: flujos (clientes, preferencias, 404), accesibilidad (axe, claro y oscuro) y regresión visual (`e2e/__screenshots__`). Tras un cambio visual **intencional** regenera con `sh scripts/e2e-docker.sh --update-snapshots=all` y revisa las imágenes en el diff (sin `=all`, Playwright solo reescribe las que superan la tolerancia). La versión de `@playwright/test` (en `e2e/package.json`) debe coincidir con la imagen de `docker-compose.e2e.yml`.

## Datos, i18n y entornos

- API: `SettingsService.api("/ruta")` compone la URL; `apiUrl` sale de `src/environments/*` y `config.json` lo sobrescribe en runtime. Lecturas con `httpResource`, escrituras con `HttpClient`. `errorInterceptor` muestra el snackbar (se evita con `SKIP_ERROR_NOTIFICATION`).
- i18n con Transloco: textos en `src/assets/i18n/{en,es}.json`, pipe `| transloco`; las etiquetas de navegación y los `title` de las rutas son claves. Todo texto visible nuevo debe estar en ambos idiomas.
- API mock: `npm run api` (o el servicio `api` de compose) sirve `mock/db.json`.

## Docker y seguridad

- La imagen `prod` es `nginx-unprivileged` en el puerto 8080. Al arrancar genera `/config.json` (`apiUrl`) y la CSP (`connect-src`) desde la variable `API_URL` (`nginx/40-runtime-config.sh`); la plantilla de cabeceras es `nginx/security-headers.inc.template`. `nginx/` y `mock/` están excluidos de Prettier a propósito.
- El build de producción tiene `inlineCritical: false` a propósito: el CSS crítico inline necesita un `onload` inline que la CSP bloquea.

## Fuera de alcance (por ahora)

Aún no hay autenticación (hay entornos, capa HTTP y una feature de ejemplo con API mock). No la agregues sin que se pida, y no subas Angular a una mayor nueva sin una migración planificada (Dependabot ignora las mayores).
