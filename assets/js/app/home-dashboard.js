/**
 * QUACKER — home-dashboard.js (LEGACY / DEPRECATED)
 *
 * Este archivo NO debe contener lógica activa.
 * La Home actual vive en:
 * - assets/js/app/home-lists-ui.js  (render Home, Continue, Backlog, modal Actividad)
 * - assets/js/app/home-notifications.js (panel notificaciones)
 *
 * Regla de oro: UI → ApiClient → FakeBackend (nunca localStorage directo)
 *
 * Motivo:
 * Existía código antiguo (mock de datos + render) que podía reintroducir duplicidades.
 * Se deja este archivo como marcador para evitar que alguien lo vuelva a usar por error.
 */
