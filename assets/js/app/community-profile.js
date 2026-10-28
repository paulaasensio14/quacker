// Perfil de Comunidad dentro del dashboard.
// Fuente de datos: API pública con permisos del servidor.
const CommunityProfileModule = (() => {
  "use strict";

  const FALLBACK_AVATAR =
    "/assets/img/logo-quacker.png";

  let initialized = false;
  let activeUsername = "";
  let activeController = null;
  let requestVersion = 0;
  let previousFocus = null;
  let followBusy = false;
  let followOperationVersion = 0;
  let blockBusy = false;
  let blockOperationVersion = 0;
  let currentViewerState = "";
  let currentViewerAccess = "";

  const $ = (selector) =>
    document.querySelector(selector);

  const t = (key, fallback) =>
    window.I18n?.t?.(key) || fallback;

  function normalizeUsername(value) {
    const username =
      typeof value === "string"
        ? value.trim().replace(/^@/, "").toLowerCase()
        : "";

    return /^[a-z0-9_]{2,20}$/.test(username)
      ? username
      : "";
  }

  function safeAvatar(value) {
    const src =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      src.startsWith("/assets/") ||
      src.startsWith("assets/") ||
      /^data:image\/(?:jpeg|png|webp|gif);/i.test(src)
    ) {
      return src;
    }

    return FALLBACK_AVATAR;
  }

  function cancelRequest() {
    requestVersion += 1;

    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  function setStatus(key, fallback) {
    const status = $("#communityProfileStatus");

    if (status) {
      status.textContent = t(key, fallback);
    }
  }

  function clearProfile() {
    window.CommunityReportUI?.clear?.();
    const content = $("#communityProfileContent");
    const bio = $("#communityProfileBioSection");
    const social = $("#communityProfileSocial");
    const restricted = $("#communityProfileRestricted");

    if (content) content.hidden = true;
    if (bio) bio.hidden = true;
    if (social) social.hidden = true;
    if (restricted) restricted.hidden = true;

    const blockedPanel = $("#communityProfileBlocked");
    if (blockedPanel) blockedPanel.hidden = true;

    const actions = $("#communityProfileActions");
    const follow = $("#communityProfileFollowAction");
    const followStatus = $("#communityProfileSocialStatus");

    if (actions) actions.hidden = true;
    if (follow) {
      follow.disabled = true;
      follow.textContent = "";
    }

    const block = $("#communityProfileBlockAction");
    if (block) {
      block.hidden = true;
      block.disabled = true;
    }

    if (followStatus) followStatus.textContent = "";

    currentViewerState = "";
    currentViewerAccess = "";

    for (const name of [
      "Favorites", "Stats", "Lists",
      "Reviews", "Activity"
    ]) {
      const section = $(`#communityProfile${name}`);
      const host = $(`#communityProfile${name}Content`);

      if (section) section.hidden = true;
      if (host) host.replaceChildren();
    }
  }


  const CONTENT_TYPES = [
    ["pelicula", "type_movie", "Películas"],
    ["serie", "type_series", "Series"],
    ["game", "type_game", "Videojuegos"],
    ["book", "type_book", "Libros"]
  ];

  function addNode(parent, tag, className = "", value) {
    const node = document.createElement(tag);
    if (className) node.className = className;

    if (value !== undefined) {
      node.textContent = String(value);
    }

    parent.append(node);
    return node;
  }

  function safeCover(value) {
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

    return "";
  }

  function safeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? Math.max(0, Math.trunc(number))
      : 0;
  }

  function renderFavorites(favorites, host) {
    let count = 0;

    for (const [type, key, fallback] of CONTENT_TYPES) {
      const items = Array.isArray(favorites[type])
        ? favorites[type]
        : [];

      if (!items.length) continue;

      const group = addNode(
        host, "div", "community-profile-group"
      );

      addNode(
        group, "h4", "",
        t(key, fallback)
      );

      const grid = addNode(
        group, "div", "community-profile-tiles"
      );

      for (const item of items) {
        const card = addNode(
          grid, "article", "community-profile-tile"
        );

        const snapshot =
          item?.itemSnapshot &&
          typeof item.itemSnapshot === "object"
            ? item.itemSnapshot
            : {};

        const title = String(
          snapshot.title || ""
        ).trim();

        const cover = safeCover(snapshot.cover);

        if (cover) {
          const image = addNode(
            card, "img", "community-profile-cover"
          );

          image.src = cover;
          image.alt = title
            ? `${t("community_profile_cover", "Portada de")} ${title}`
            : "";
          image.loading = "lazy";

          image.addEventListener(
            "error",
            () => { image.hidden = true; },
            { once: true }
          );
        }

        addNode(
          card, "p", "",
          title ||
            t("community_profile_untitled", "Sin título")
        );

        count += 1;
      }
    }

    if (!count) {
      addNode(
        host, "p", "community-profile-empty",
        t(
          "community_profile_empty_favorites",
          "Aún no hay favoritos."
        )
      );
    }
  }

  function renderStats(stats, host) {
    const metrics = [
      [
        "community_profile_total", "Total",
        stats.totalItems
      ],
      [
        "community_profile_completed", "Completados",
        stats.completedCount
      ],
      [
        "community_profile_in_progress", "En progreso",
        stats.inProgressCount
      ],
      [
        "community_profile_not_started", "Sin empezar",
        stats.notStartedCount
      ]
    ];

    for (const [key, label, value] of metrics) {
      const card = addNode(
        host, "article", "community-profile-tile"
      );

      addNode(
        card, "strong", "community-profile-number",
        safeNumber(value)
      );

      addNode(
        card, "span", "",
        t(key, label)
      );
    }

    const byType =
      stats.byType &&
      typeof stats.byType === "object" &&
      !Array.isArray(stats.byType)
        ? stats.byType
        : {};

    for (const [type, key, fallback] of CONTENT_TYPES) {
      const card = addNode(
        host, "article", "community-profile-tile"
      );

      addNode(
        card, "strong", "community-profile-number",
        safeNumber(byType[type])
      );

      addNode(
        card, "span", "",
        t(key, fallback)
      );
    }
  }

  function renderLists(lists, host) {
    if (!lists.length) {
      addNode(
        host, "p", "community-profile-empty",
        t(
          "community_profile_empty_lists",
          "Aún no hay listas públicas."
        )
      );
      return;
    }

    for (const list of lists) {
      const card = addNode(
        host, "article", "community-profile-tile"
      );

      addNode(
        card, "h4", "",
        String(list?.name || "").trim() ||
          t("community_profile_untitled", "Sin título")
      );

      const description =
        String(list?.description || "").trim();

      if (description) {
        addNode(
          card, "p", "community-profile-description",
          description
        );
      }

      const items = Array.isArray(list?.items)
        ? list.items
        : [];

      if (items.length) {
        const ul = addNode(card, "ul");

        for (const item of items) {
          addNode(
            ul, "li", "",
            String(
              item?.itemSnapshot?.title || ""
            ).trim() ||
              t("community_profile_untitled", "Sin título")
          );
        }
      }
    }
  }

  function renderReviews(reviews, host) {
    if (!reviews.length) {
      addNode(
        host, "p", "community-profile-empty",
        t(
          "community_profile_empty_reviews",
          "Aún no hay reseñas públicas."
        )
      );
      return;
    }

    for (const entry of reviews) {
      const card = addNode(
        host, "article", "community-profile-tile"
      );

      addNode(
        card, "h4", "",
        String(
          entry?.itemSnapshot?.title || ""
        ).trim() ||
          t("community_profile_untitled", "Sin título")
      );

      const rating = Number(entry?.rating);

      if (
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5
      ) {
        addNode(
          card, "p", "community-profile-rating",
          "★".repeat(rating) +
            "☆".repeat(5 - rating)
        );
      }

      const reviewText =
        String(entry?.review?.text || "").trim();

      if (entry?.review?.spoiler === true) {
        addNode(
          card, "p", "",
          t(
            "community_profile_spoiler_notice",
            "Esta reseña contiene spoilers."
          )
        );

        // No insertar el spoiler en el DOM
        // hasta que el visitante lo solicite.
        const reveal = addNode(
          card,
          "button",
          "community-profile-spoiler-toggle",
          t(
            "community_profile_reveal_spoiler",
            "Mostrar spoiler"
          )
        );

        reveal.type = "button";
        reveal.setAttribute("aria-expanded", "false");

        reveal.addEventListener("click", () => {
          addNode(
            card,
            "p",
            "community-profile-review-text",
            reviewText
          );

          reveal.setAttribute(
            "aria-expanded",
            "true"
          );
          reveal.hidden = true;
        }, { once: true });
      } else if (reviewText) {
        addNode(
          card,
          "p",
          "community-profile-review-text",
          reviewText
        );
      }

      const tags = Array.isArray(entry?.tags)
        ? entry.tags
        : [];

      if (tags.length) {
        const tagGroup = addNode(
          card, "div", "community-profile-tags"
        );

        for (const tag of tags) {
          addNode(
            tagGroup,
            "span",
            "community-profile-tag",
            String(tag || "")
              .trim()
              .replaceAll("_", " ")
          );
        }
      }
    }
  }

  function renderActivity(activity, host) {
    if (!activity.length) {
      addNode(
        host, "p", "community-profile-empty",
        t(
          "community_profile_empty_activity",
          "Aún no hay actividad pública."
        )
      );
      return;
    }

    for (const entry of activity) {
      const card = addNode(
        host, "article", "community-profile-tile"
      );

      const title = String(
        entry?.itemSnapshot?.title || ""
      ).trim();

      const verb = entry?.type === "completed"
        ? t("community_profile_did_complete", "Completó")
        : t("community_profile_did_progress", "Avanzó en");

      addNode(
        card, "h4", "",
        `${verb} ${title ||
          t("community_profile_untitled", "Sin título")}`
      );

      const details = [];

      const season = Number(entry?.payload?.season);
      const episode = Number(entry?.payload?.episode);
      const progress = Number(entry?.payload?.progress);

      if (
        Number.isInteger(season) && season > 0 &&
        Number.isInteger(episode) && episode > 0
      ) {
        details.push(
          `${t("community_profile_season", "Temporada")} ` +
          `${season} · ` +
          `${t("community_profile_episode", "Episodio")} ${episode}`
        );
      } else if (
        Number.isFinite(progress)
      ) {
        details.push(
          `${Math.max(0, Math.min(100, progress))}%`
        );
      }

      const minutes = Number(entry?.minutes);

      if (Number.isFinite(minutes) && minutes > 0) {
        details.push(`${Math.round(minutes)} min`);
      }

      if (details.length) {
        addNode(
          card,
          "p",
          "community-profile-description",
          details.join(" · ")
        );
      }
    }
  }

  function renderPublicSections(data, canView) {
    const sections = [
      ["Favorites", "favorites", renderFavorites],
      ["Stats", "stats", renderStats],
      ["Lists", "lists", renderLists],
      ["Reviews", "reviews", renderReviews],
      ["Activity", "activity", renderActivity]
    ];

    for (const [name, field, renderer] of sections) {
      const section = $(`#communityProfile${name}`);
      const host = $(`#communityProfile${name}Content`);

      if (!section || !host) continue;

      section.hidden = true;
      host.replaceChildren();

      // La ausencia de un campo indica que el
      // servidor no ha autorizado publicarlo.
      if (
        !canView ||
        !Object.hasOwn(data, field)
      ) {
        continue;
      }

      const value = data[field];

      const valid = field === "favorites" ||
        field === "stats"
          ? value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
          : Array.isArray(value);

      if (!valid) continue;

      renderer(value, host);
      section.hidden = false;
    }
  }

  function renderProfile(data) {
    const profile =
      data?.profile &&
      typeof data.profile === "object"
        ? data.profile
        : null;

    if (
      !profile ||
      normalizeUsername(profile.username) !==
        activeUsername
    ) {
      clearProfile();
      setStatus(
        "community_profile_error",
        "No hemos podido cargar este perfil."
      );
      return;
    }

    const name = $("#communityProfileName");
    const username = $("#communityProfileUsername");
    const avatar = $("#communityProfileAvatar");
    const bio = $("#communityProfileBio");
    const bioSection = $("#communityProfileBioSection");
    const social = $("#communityProfileSocial");
    const restricted = $("#communityProfileRestricted");
    const content = $("#communityProfileContent");
    const status = $("#communityProfileStatus");

    if (name) {
      name.textContent =
        typeof profile.name === "string" &&
        profile.name.trim()
          ? profile.name.trim()
          : `@${activeUsername}`;
    }

    if (username) {
      username.textContent = `@${activeUsername}`;
    }

    if (avatar) {
      avatar.src = safeAvatar(profile.avatar);
      avatar.alt = "";
    }

    const hasRestrictedAccess =
      data?.viewer?.access === "restricted" ||
      !Object.hasOwn(profile, "bio");

    const bioText =
      !hasRestrictedAccess &&
      typeof profile.bio === "string"
        ? profile.bio.trim()
        : "";

    if (bio) {
      bio.textContent = bioText;
    }

    if (bioSection) {
      bioSection.hidden = !bioText;
    }

    if (social) {
      const followers = Number(
        data?.social?.followersCount
      );
      const following = Number(
        data?.social?.followingCount
      );

      const hasSocial =
        !hasRestrictedAccess &&
        Number.isSafeInteger(followers) &&
        followers >= 0 &&
        Number.isSafeInteger(following) &&
        following >= 0;

      social.hidden = !hasSocial;

      if (hasSocial) {
        $("#communityProfileFollowers").textContent =
          String(followers);

        $("#communityProfileFollowing").textContent =
          String(following);
      }
    }

    if (restricted) {
      restricted.hidden = !hasRestrictedAccess;

      restricted.textContent = hasRestrictedAccess
        ? t(
            "community_profile_restricted",
            "Este perfil tiene acceso restringido."
          )
        : "";
    }

    renderPublicSections(
      data,
      !hasRestrictedAccess
    );

    renderFollowAction(data?.viewer);
    window.CommunityReportUI?.sync?.(
      data?.viewer,
      activeUsername
    );

    if (content) {
      content.hidden = false;
    }

    if (status) {
      status.textContent = "";
    }
  }

  async function loadProfile(username) {
    cancelRequest();

    const version = requestVersion;
    const controller = new AbortController();
    activeController = controller;

    clearProfile();

    setStatus(
      "community_profile_loading",
      "Cargando perfil..."
    );

    try {
      const data = await ApiClient.getCommunityProfile(
        username,
        { signal: controller.signal }
      );

      if (
        version !== requestVersion ||
        username !== activeUsername
      ) {
        return;
      }

      renderProfile(data);
    } catch (error) {
      if (version !== requestVersion) {
        return;
      }

      if (
        error?.error === "aborted" ||
        error?.name === "AbortError"
      ) {
        return;
      }

      clearProfile();

      setStatus(
        "community_profile_error",
        "No hemos podido cargar este perfil."
      );
    } finally {
      if (
        version === requestVersion &&
        activeController === controller
      ) {
        activeController = null;
      }
    }
  }

  function renderBlockAction(viewer) {
    const button = $("#communityProfileBlockAction");

    if (!button) return;

    const state =
      typeof viewer?.state === "string"
        ? viewer.state.trim()
        : "";

    const allowed = [
      "none",
      "requested",
      "following",
      "friend"
    ].includes(state);

    // Nunca mostrar el bloqueo del propio perfil,
    // ni permitirlo sin identidad autenticada.
    button.hidden = !allowed;
    button.disabled =
      !allowed ||
      blockBusy ||
      followBusy;
  }

  function renderFollowAction(viewer) {
    const actions = $("#communityProfileActions");
    const button = $("#communityProfileFollowAction");

    if (!actions || !button) return;

    const state =
      viewer &&
      typeof viewer.state === "string"
        ? viewer.state.trim()
        : "";

    const access =
      typeof viewer?.access === "string"
        ? viewer.access
        : "";

    currentViewerState = state;
    currentViewerAccess = access;

    let label = "";

    if (state === "none") {
      label = access === "restricted"
        ? t(
            "community_follow_request",
            "Solicitar seguir"
          )
        : t(
            "community_follow_follow",
            "Seguir"
          );
    } else if (state === "requested") {
      label = t(
        "community_follow_requested",
        "Solicitud enviada"
      );
    } else if (
      state === "following" ||
      state === "friend"
    ) {
      label = t(
        "community_follow_unfollow",
        "Dejar de seguir"
      );
    } else if (state === "self") {
      label = t(
        "community_follow_self",
        "Tu perfil"
      );
    }

    actions.hidden = !label;
    button.textContent = label;

    button.disabled =
      followBusy ||
      blockBusy ||
      !["none", "following", "friend"].includes(
        state
      );

    renderBlockAction(viewer);
  }

  async function performFollowAction() {
    const button = $("#communityProfileFollowAction");
    const status = $("#communityProfileSocialStatus");

    if (
      !button ||
      button.disabled ||
      followBusy ||
      blockBusy ||
      !activeUsername
    ) {
      return;
    }

    const state = currentViewerState;

    const action =
      state === "none"
        ? "follow"
        : (
            state === "following" ||
            state === "friend"
          )
          ? "unfollow"
          : "";

    if (!action) return;

    const username = activeUsername;
    const operation = ++followOperationVersion;
    const initialRequestVersion = requestVersion;

    followBusy = true;
    button.disabled = true;

    const blockButton =
      $("#communityProfileBlockAction");

    if (blockButton) {
      blockButton.disabled = true;
    }

    if (status) {
      status.textContent = t(
        "community_follow_busy",
        "Actualizando seguimiento..."
      );
    }

    try {
      const result =
        await ApiClient.updateCommunityFollowing(
          username,
          action
        );

      // No actualizar una pantalla que ahora
      // muestra otro usuario o sección.
      if (
        operation !== followOperationVersion ||
        username !== activeUsername ||
        initialRequestVersion !== requestVersion
      ) {
        return;
      }

      const accepted =
        action === "follow"
          ? (
              result?.following === true ||
              result?.requested === true
            )
          : (
              result?.following === false &&
              result?.requested !== true
            );

      if (!accepted) {
        throw new Error("unexpected_follow_response");
      }

      // La API decide si el resultado ha sido
      // seguimiento (201) o solicitud (202).
      // Volvemos a leer viewer.state del servidor.
      followBusy = false;

      await loadProfile(username);
    } catch (error) {
      if (
        operation !== followOperationVersion ||
        username !== activeUsername ||
        initialRequestVersion !== requestVersion
      ) {
        return;
      }

      followBusy = false;

      if (status) {
        status.textContent = t(
          "community_follow_error",
          "No se pudo actualizar el seguimiento."
        );
      }

      // Conservar el estado previamente verificado.
      renderFollowAction({
        state: currentViewerState,
        access: currentViewerAccess
      });
    } finally {
      if (operation === followOperationVersion) {
        followBusy = false;

        const follow = $("#communityProfileFollowAction");

        if (follow) {
          follow.disabled =
            blockBusy ||
            ![
              "none",
              "following",
              "friend"
            ].includes(currentViewerState);
        }

        renderBlockAction({
          state: currentViewerState,
          access: currentViewerAccess
        });
      }
    }
  }

  async function performBlockAction() {
    const button = $("#communityProfileBlockAction");
    const follow = $("#communityProfileFollowAction");
    const status = $("#communityProfileSocialStatus");

    if (
      !button ||
      button.hidden ||
      button.disabled ||
      blockBusy ||
      followBusy ||
      !activeUsername ||
      ![
        "none",
        "requested",
        "following",
        "friend"
      ].includes(currentViewerState)
    ) {
      return;
    }

    const username = activeUsername;

    const confirmed = window.confirm(
      t(
        "community_block_confirm",
        "¿Bloquear a este usuario? " +
          "Se eliminarán los seguimientos y las " +
          "solicitudes pendientes entre ambos. " +
          "No se restaurarán al desbloquear."
      ) + `\n@${username}`
    );

    if (!confirmed) return;

    if (
      username !== activeUsername ||
      button.hidden
    ) {
      return;
    }

    const operation = ++blockOperationVersion;
    const initialRequestVersion = requestVersion;

    blockBusy = true;
    button.disabled = true;

    if (follow) {
      follow.disabled = true;
    }

    if (status) {
      status.textContent = t(
        "community_block_busy",
        "Bloqueando usuario..."
      );
    }

    try {
      const response =
        await ApiClient.blockCommunityUser(username);

      if (
        operation !== blockOperationVersion ||
        username !== activeUsername ||
        initialRequestVersion !== requestVersion
      ) {
        return;
      }

      const blocked = response?.blocked === true;

      if (
        !blocked ||
        normalizeUsername(response?.username) !==
          username
      ) {
        throw new Error("unexpected_block_response");
      }

      // El servidor ya ha eliminado las relaciones
      // de seguimiento y solicitudes pendientes.
      // Invalidar cualquier carga del perfil.
      cancelRequest();

      followOperationVersion += 1;
      followBusy = false;

      clearProfile();

      const panel = $("#communityProfileBlocked");

      if (panel) {
        panel.hidden = false;
      }

      if (status) {
        status.textContent = t(
          "community_block_success",
          "Usuario bloqueado correctamente."
        );
      }

      $("#communityProfileBlockedBack")?.focus();

    } catch (error) {
      if (
        operation !== blockOperationVersion ||
        username !== activeUsername ||
        initialRequestVersion !== requestVersion
      ) {
        return;
      }

      // Un error HTTP, de sesión o de red nunca
      // debe tratarse como un bloqueo confirmado.
      if (status) {
        status.textContent = t(
          "community_block_error",
          "No se pudo bloquear al usuario."
        );
      }

    } finally {
      if (operation === blockOperationVersion) {
        blockBusy = false;

        const profileVisible =
          username === activeUsername &&
          $("#communityProfileContent")?.hidden ===
            false;

        if (profileVisible) {
          renderFollowAction({
            state: currentViewerState,
            access: currentViewerAccess
          });
        } else {
          button.disabled = true;
        }
      }
    }
  }

  function open(username, trigger = null) {
    const normalized = normalizeUsername(username);

    if (!normalized) return false;

    const content = $("#communityProfileContent");
    if (!content) return false;

    previousFocus = trigger;
    activeUsername = normalized;

    followOperationVersion += 1;
    followBusy = false;

    blockOperationVersion += 1;
    blockBusy = false;

    const blockedPanel = $("#communityProfileBlocked");
    if (blockedPanel) blockedPanel.hidden = true;

    Router.showView("community-profile");

    loadProfile(normalized);

    $("#communityProfileBack")?.focus();

    return true;
  }

  function back() {
    window.CommunityReportUI?.clear?.();
    cancelRequest();

    followOperationVersion += 1;
    followBusy = false;

    blockOperationVersion += 1;
    blockBusy = false;

    const blockedPanel = $("#communityProfileBlocked");
    if (blockedPanel) blockedPanel.hidden = true;

    activeUsername = "";

    Router.showView("community");

    if (
      previousFocus &&
      previousFocus.isConnected !== false &&
      typeof previousFocus.focus === "function"
    ) {
      previousFocus.focus();
    } else {
      $("#communitySearchInput")?.focus();
    }

    previousFocus = null;
  }

  function init() {
    if (initialized) return;

    const backButton = $("#communityProfileBack");
    const content = $("#communityProfileContent");
    const status = $("#communityProfileStatus");

    if (!backButton || !content || !status) {
      return;
    }

    initialized = true;
    window.CommunityReportUI?.init?.();

    backButton.addEventListener("click", back);

    $("#communityProfileFollowAction")?.addEventListener(
      "click",
      performFollowAction
    );

    $("#communityProfileBlockAction")?.addEventListener(
      "click",
      performBlockAction
    );

    $("#communityProfileBlockedBack")?.addEventListener(
      "click",
      back
    );

    document.addEventListener(
      "quacker:view-change",
      (event) => {
        const view = event?.detail?.viewId;

        if (view === "community-profile") {
          // Si no hay username activo (por ejemplo,
          // tras actualizar la página), volver a Comunidad.
          if (!activeUsername) {
            Router.showView("community");
          }
          return;
        }

        cancelRequest();
        window.CommunityReportUI?.clear?.();

        followOperationVersion += 1;
        followBusy = false;

        blockOperationVersion += 1;
        blockBusy = false;
      }
    );

    // El router puede haberse inicializado antes
    // que este módulo. Nunca dejar visible una vista
    // de perfil sin un username seleccionado.
    if (
      $("#view-community-profile")?.classList?.contains(
        "is-active"
      )
    ) {
      Router.showView("community");
    }

    clearProfile();
  }

  return {
    init,
    open,
    back
  };
})();

window.CommunityProfileModule = CommunityProfileModule;
