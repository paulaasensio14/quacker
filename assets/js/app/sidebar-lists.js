/*
 * DS-08.2 — Accesos de listas en el menu lateral.
 * La API existente conserva el control de permisos.
 */
(() => {
  const LIMIT = 4;

  const icons = {
    private: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    public: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><ellipse cx="12" cy="12" rx="4" ry="9"/>',
    collab: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>'
  };

  let initialized = false;
  let version = 0;
  let selectedId = null;
  let entries = [];
  let state = "loading";

  let rows;
  let status;
  let retry;
  let all;
  let media;

  const t = key => window.I18n?.t?.(key) ?? key;

  function select(id) {
    selectedId = id == null ? null : String(id);

    if (!rows) return;

    for (const row of rows.children) {
      const button = row.children[0];

      if (button.dataset.listShortcutId === selectedId) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  function normalize(lists) {
    const result = [];
    const seen = new Set();

    for (const list of Array.isArray(lists) ? lists : []) {
      const id = String(list?.id ?? "").trim();

      if (!id || seen.has(id)) continue;

      seen.add(id);

      result.push({
        id,
        name: String(list.name ?? "").trim(),
        visibility: Object.hasOwn(icons, list.visibility)
          ? list.visibility
          : "private"
      });

      if (result.length === LIMIT) break;
    }

    return result;
  }

  function render() {
    const focusedId =
      document.activeElement?.dataset?.listShortcutId;

    const nodes = entries.map(list => {
      const row = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "sidebar-list-shortcut";
      button.dataset.listShortcutId = list.id;
      button.dataset.visibility = list.visibility;

      const name = list.name || t("lists_untitled");

      const visibility = t(
        "lists_visibility_" + list.visibility
      );

      button.title = name + " · " + visibility;

      button.setAttribute(
        "aria-label",
        name + " — " + visibility
      );

      const icon = document.createElement("span");

      icon.className = "sidebar-list-icon";
      icon.setAttribute("aria-hidden", "true");

      // Solo SVG constantes. Los nombres se insertan
      // mediante textContent, nunca como HTML.
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true" focusable="false">' +
        icons[list.visibility] +
        '</svg>';

      const label = document.createElement("span");

      label.className = "sidebar-list-name";
      label.textContent = name;

      button.append(icon, label);

      button.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("quacker:lists-open-detail", {
            detail: {
              listId: list.id,
              source: "sidebar"
            }
          })
        );
      });

      row.append(button);

      return row;
    });

    rows.replaceChildren(...nodes);

    select(selectedId);

    status.hidden =
      state === "ready" && entries.length > 0;

    status.textContent = status.hidden
      ? ""
      : t("sidebar_lists_" + (
          state === "ready" ? "empty" : state
        ));

    retry.hidden = state !== "error";

    if (focusedId) {
      const next = nodes.find(
        row => row.children[0].dataset.listShortcutId === focusedId
      );

      (next?.children[0] || all).focus();
    }
  }

  async function refresh(clear = false) {
    const request = ++version;

    if (!media.matches) return;

    if (clear || state === "error") {
      entries = [];
      state = "loading";
      render();
    }

    rows.setAttribute("aria-busy", "true");

    try {
      const lists = await ApiClient.getListsForNavigation();

      if (request !== version) return;

      if (!Array.isArray(lists)) {
        throw new Error("invalid_lists_response");
      }

      const next = normalize(lists);

      const changed =
        JSON.stringify(next) !== JSON.stringify(entries);

      const needsRender = changed || state !== "ready";

      entries = next;
      state = "ready";

      if (needsRender) render();
    } catch (_) {
      if (request !== version) return;

      entries = [];
      state = "error";
      render();
    } finally {
      if (request === version) {
        rows.setAttribute("aria-busy", "false");
      }
    }
  }

  function init() {
    if (initialized) return;

    const section = document.getElementById("sidebarLists");
    if (!section) return;

    rows = document.getElementById("sidebarListsEntries");
    status = document.getElementById("sidebarListsStatus");
    retry = document.getElementById("sidebarListsRetry");
    all = document.getElementById("sidebarListsAll");

    const create = document.getElementById("sidebarListsCreate");

    if (!rows || !status || !retry || !all || !create) return;

    initialized = true;

    media = window.matchMedia("(min-width: 1025px)");

    create.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("quacker:lists-create-request")
      );
    });

    all.addEventListener("click", () => {
      window.Router?.showView("lists");

      // Reutilizar el retorno al listado completo.
      document.getElementById("btnBackToLists")?.click();
    });

    retry.addEventListener("click", () => refresh(true));

    document.addEventListener("quacker:data-changed", event => {
      const kind = event.detail?.kind;

      if (kind === "lists" || kind === "user_blocks") {
        refresh(true);
      }
    });

    document.addEventListener("quacker:lang-change", render);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh();
    });

    window.addEventListener("focus", () => refresh());

    media.addEventListener("change", () => {
      refresh(true);
    });

    render();
    refresh();
  }

  window.SidebarLists = Object.freeze({
    init,
    select
  });
})();
