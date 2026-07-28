(function () {
  try {
    // En el server real (3000) NO restauramos nada: HTTP debe ser la verdad.
    const isNodeServer = String(window.location.port) === "3000";
    if (isNodeServer) return;

    // En estático, respetamos sessionStorage si existe
    const t = sessionStorage.getItem("quacker_transport");
    const baseUrl = sessionStorage.getItem("quacker_baseUrl");

    if (baseUrl && window.ApiClient?.setBaseUrl) ApiClient.setBaseUrl(baseUrl);
    if (t && window.ApiClient?.setTransport) ApiClient.setTransport(t);
  } catch (_) {}
})();

(function () {
  function bindLogout() {
    const logoutBtn = document.querySelector(".logout-btn");
    const logoutMenuItem = document.querySelector('[data-profile-action="logout"]');

    async function doLogout() {
      try {
        if (logoutBtn) {
          if (logoutBtn.dataset.busy === "1") return;
          logoutBtn.dataset.busy = "1";
          logoutBtn.setAttribute("aria-busy", "true");
        }

        if (window.ApiClient?.logout) {
          await ApiClient.logout();
        }
      } catch (_) {
        // aunque falle, por seguridad salimos igual
      } finally {
        // importante: usar replace para no volver atrás al dashboard con "back"
        window.location.replace("index.html");
      }
    }

    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
    if (logoutMenuItem) logoutMenuItem.addEventListener("click", doLogout);
  }

  // Esperamos al DOM, pero sin depender del resto de módulos
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindLogout);
  } else {
    bindLogout();
  }
})();

(async function () {
  async function waitForApiClient(ms = 2000) {
    const start = Date.now();

    while (Date.now() - start < ms) {
      if (window.ApiClient && typeof ApiClient.getCurrentSession === "function") {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    return false;
  }

  try {
    const isApiClientReady = await waitForApiClient(5000);

    if (!isApiClientReady) {
      await waitForApiClient(5000);
    }

    const isNodeServer = String(window.location.port) === "3000";

    if (isNodeServer) {
      try {
        if (ApiClient.setBaseUrl) ApiClient.setBaseUrl("/api");
        if (ApiClient.setTransport) ApiClient.setTransport("http");
      } catch (_) {}
    }

    let session = null;

    try {
      session = await ApiClient.getCurrentSession();
    } catch (_) {
      session = null;
    }

    if (!session || !session.user) {
      window.location.replace("index.html");
    }
  } catch (_) {
    window.location.replace("index.html");
  }
})();
