/*
 * Quacker - Recepcion de enlaces colaborativos.
 *
 * Captura un token recibido por URL y lo conserva
 * temporalmente en la sesion de la pestana.
 *
 * Nunca acepta invitaciones automaticamente.
 * No realiza peticiones HTTP.
 * No utiliza localStorage.
 */

(function () {
  "use strict";

  const STORAGE_KEY =
    "quacker:pending-list-invite";

  // Token base64url generado a partir de 32 bytes.
  const TOKEN_PATTERN =
    /^[A-Za-z0-9_-]{43}$/;

  const LINK_HASH_PATTERN =
    /^#list-invite=([A-Za-z0-9_-]{43})$/;

  function parseListInviteHash(hash) {
    if (typeof hash !== "string") {
      return null;
    }

    const match =
      LINK_HASH_PATTERN.exec(hash);

    return match ? match[1] : null;
  }

  function getPendingToken() {
    try {
      const token =
        window.sessionStorage.getItem(
          STORAGE_KEY
        );

      return (
        typeof token === "string" &&
        TOKEN_PATTERN.test(token)
      )
        ? token
        : null;
    } catch (_) {
      // Sin almacenamiento no se inventa un token.
      return null;
    }
  }

  function clearPendingToken() {
    try {
      window.sessionStorage.removeItem(
        STORAGE_KEY
      );
    } catch (_) {
      // Puede fallar en navegadores restringidos.
    }
  }

  function captureFromLocation() {
    const token =
      parseListInviteHash(
        window.location?.hash
      );

    if (!token) {
      // No interferir con #reset, hashes de vistas
      // ni otros enlaces de la aplicacion.
      return null;
    }

    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        token
      );
    } catch (_) {
      // Si no podemos conservar el token, no
      // eliminamos su URL ni fingimos haberlo
      // guardado antes del inicio de sesion.
      return null;
    }

    // Despues de almacenarlo, retirar el token
    // de la barra de direcciones sin navegar.
    try {
      const cleanUrl =
        String(
          window.location.pathname || "/"
        ) +
        String(
          window.location.search || ""
        );

      window.history.replaceState(
        null,
        document.title,
        cleanUrl
      );
    } catch (_) {
      // El token ya esta almacenado.
    }

    return token;
  }

  window.ListLinkInviteEntry =
    Object.freeze({
      parseListInviteHash,
      captureFromLocation,
      getPendingToken,
      clearPendingToken
    });

  // Captura tambien navegaciones en la misma pestana.
  // No consulta la API ni acepta la invitacion.
  window.addEventListener?.("hashchange", () => {
    captureFromLocation();
  });

  // Captura temprana al cargar este modulo.
  // No consulta la API ni acepta la invitacion.
  captureFromLocation();
})();
