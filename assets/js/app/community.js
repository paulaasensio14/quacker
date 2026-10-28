// Búsqueda de personas dentro del dashboard.
const CommunityModule = (() => {
  "use strict";

  const FALLBACK_AVATAR =
    "/assets/img/logo-quacker.png";

  const SEARCH_DELAY_MS = 350;

  let initialized = false;
  let debounceTimer = null;
  let activeController = null;
  let requestVersion = 0;
  let currentState = "idle";

  const $ = (selector) =>
    document.querySelector(selector);

  const t = (key, fallback) =>
    window.I18n?.t?.(key) || fallback;

  function setStatus(key, fallback) {
    currentState = key;
    const status = $("#communitySearchStatus");

    if (status) {
      status.textContent = t(key, fallback);
    }
  }

  function clearResults() {
    $("#communityResults")?.replaceChildren();
  }

  function safeAvatar(value) {
    const src =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      src.startsWith("/assets/") ||
      src.startsWith("assets/") ||
      /^https:\/\//i.test(src) ||
      /^data:image\/(?:jpeg|png|webp|gif);/i.test(src)
    ) {
      return src;
    }

    return FALLBACK_AVATAR;
  }

  function renderUsers(users) {
    const results = $("#communityResults");
    if (!results) return;

    results.replaceChildren();

    for (const user of users) {
      const username =
        typeof user?.username === "string"
          ? user.username.trim().toLowerCase()
          : "";

      if (!/^[a-z0-9_]{2,20}$/.test(username)) {
        continue;
      }

      const item = document.createElement("div");
      item.setAttribute("role", "listitem");

      const link = document.createElement("a");
      link.className = "community-user-card";
      link.href =
        `/u/${encodeURIComponent(username)}`;

      link.setAttribute(
        "aria-label",
        `${t("community_view_profile", "Ver perfil")}: @${username}`
      );

      // Mantener href para copiar o abrir el perfil
      // compartible. El clic normal usa la vista interna.
      link.addEventListener("click", (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        const open =
          window.CommunityProfileModule?.open;

        if (typeof open !== "function") {
          return;
        }

        event.preventDefault();
        open(username, link);
      });

      const avatar = document.createElement("img");
      avatar.className = "community-user-avatar";
      avatar.src = safeAvatar(user.avatar);
      avatar.alt = "";
      avatar.loading = "lazy";

      avatar.addEventListener(
        "error",
        () => {
          avatar.src = FALLBACK_AVATAR;
        },
        { once: true }
      );

      const identity =
        document.createElement("span");
      identity.className = "community-user-identity";

      const name =
        document.createElement("span");
      name.className = "community-user-name";
      name.textContent =
        typeof user.name === "string" &&
        user.name.trim()
          ? user.name.trim()
          : `@${username}`;

      const handle =
        document.createElement("span");
      handle.className = "community-user-handle";
      handle.textContent = `@${username}`;

      identity.append(name, handle);

      const action =
        document.createElement("span");
      action.className = "community-user-action";
      action.textContent = t(
        "community_view_profile",
        "Ver perfil"
      );

      link.append(avatar, identity, action);
      item.append(link);
      results.append(item);
    }

    if (!results.children.length) {
      setStatus(
        "community_no_results",
        "No encontramos usuarios con ese nombre."
      );
    } else {
      const status = $("#communitySearchStatus");

      if (status) {
        status.textContent = "";
      }
      currentState = "results";
    }
  }

  function cancelPendingSearch() {
    requestVersion += 1;

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  async function runSearch(query) {
    const version = ++requestVersion;

    const controller = new AbortController();
    activeController = controller;

    setStatus(
      "community_loading",
      "Buscando personas..."
    );

    try {
      const users = await ApiClient.getCommunityUsers(
        query,
        {
          signal: controller.signal
        }
      );

      if (version !== requestVersion) {
        return;
      }

      renderUsers(
        Array.isArray(users) ? users : []
      );
    } catch (error) {
      if (version !== requestVersion) {
        return;
      }

      clearResults();

      if (
        error?.error === "aborted" ||
        error?.name === "AbortError"
      ) {
        return;
      }

      if (error?.status === 429) {
        setStatus(
          "community_rate_limited",
          "Demasiadas búsquedas. Inténtalo más tarde."
        );
      } else {
        setStatus(
          "community_error",
          "No pudimos buscar usuarios. Inténtalo de nuevo."
        );
      }
    } finally {
      if (
        version === requestVersion &&
        activeController === controller
      ) {
        activeController = null;
      }
    }
  }

  function onInput() {
    const input = $("#communitySearchInput");
    if (!input) return;

    cancelPendingSearch();
    clearResults();

    const query = input.value.trim();

    if (
      query.replace(/^@/, "").length < 2
    ) {
      setStatus(
        "community_idle",
        "Escribe al menos dos caracteres para buscar."
      );
      return;
    }

    setStatus(
      "community_loading",
      "Buscando personas..."
    );

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runSearch(query);
    }, SEARCH_DELAY_MS);
  }

  function init() {
    if (initialized) return;

    const input = $("#communitySearchInput");
    const results = $("#communityResults");
    const status = $("#communitySearchStatus");

    if (!input || !results || !status) return;

    initialized = true;

    input.addEventListener("input", onInput);

    document.addEventListener(
      "quacker:view-change",
      (event) => {
        if (event?.detail?.viewId === "community") {
          // Una búsqueda interrumpida al salir debe
          // reanudarse cuando volvemos a Comunidad.
          // Si ya había resultados, los conservamos.
          if (currentState === "community_loading") {
            onInput();
          }

          return;
        }

        // Al abandonar Comunidad, evitamos que una
        // respuesta antigua modifique los resultados.
        cancelPendingSearch();
      }
    );

    document.addEventListener(
      "quacker:lang-change",
      () => {
        if (currentState === "results") {
          return;
        }

        status.textContent = t(
          currentState,
          "Escribe al menos dos caracteres para buscar."
        );
      }
    );

    setStatus(
      "community_idle",
      "Escribe al menos dos caracteres para buscar."
    );
  }

  return {
    init
  };
})();

window.CommunityModule = CommunityModule;
