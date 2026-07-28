(function () {
  try {
    const isDev = String(window.location.port) === "3000";
    if (!isDev) return;

    // Canonical host en dev para que la cookie de sesión no se pierda
    if (window.location.hostname === "localhost") {
      const next = window.location.href.replace("://localhost:", "://127.0.0.1:");
      window.location.replace(next);
    }
  } catch (_) {}
})();
