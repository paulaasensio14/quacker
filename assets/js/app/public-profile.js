(() => {
  "use strict";

  const DEFAULT_AVATAR =
    "/assets/img/logo-quacker.png";

  const FAVORITE_TYPES = Object.freeze([
    "pelicula",
    "serie",
    "game",
    "book"
  ]);

  function $(selector) {
    return document.querySelector(selector);
  }

  function getUsernameFromPath() {
    const parts = window.location.pathname
      .split("/")
      .filter(Boolean);

    if (
      parts.length !== 2 ||
      parts[0] !== "u"
    ) {
      return "";
    }

    try {
      return decodeURIComponent(parts[1]).trim();
    } catch (_) {
      return "";
    }
  }

  function resolveAvatarSrc(value) {
    const src = String(value || "").trim();

    if (!src) return DEFAULT_AVATAR;

    if (src.startsWith("data:image/")) {
      return src;
    }

    if (src.startsWith("/assets/")) {
      return src;
    }

    if (src.startsWith("assets/")) {
      return `/${src}`;
    }

    return DEFAULT_AVATAR;
  }

  function resolveCoverSrc(value) {
    const src = String(value || "").trim();

    if (!src) return "";

    if (src.startsWith("https://")) {
      return src;
    }

    if (src.startsWith("/assets/")) {
      return src;
    }

    if (src.startsWith("assets/")) {
      return `/${src}`;
    }

    if (src.startsWith("data:image/")) {
      return src;
    }

    return "";
  }

  function showError() {
    const loading = $("#publicProfileLoading");
    const content = $("#publicProfileContent");
    const error = $("#publicProfileError");

    if (loading) loading.hidden = true;
    if (content) content.hidden = true;
    if (error) error.hidden = false;
  }

  function createFavoriteCard(item) {
    const card = document.createElement("article");
    card.className = "public-profile-favorite";

    const snapshot =
      item?.itemSnapshot &&
      typeof item.itemSnapshot === "object"
        ? item.itemSnapshot
        : {};

    const title = String(
      snapshot.title || ""
    ).trim();

    const coverSrc = resolveCoverSrc(
      snapshot.cover
    );

    if (coverSrc) {
      const image = document.createElement("img");

      image.className =
        "public-profile-favorite-cover";

      image.src = coverSrc;
      image.alt = title
        ? `Portada de ${title}`
        : "Portada";

      image.loading = "lazy";
      image.decoding = "async";

      card.append(image);
    } else {
      const placeholder =
        document.createElement("div");

      placeholder.className =
        "public-profile-favorite-placeholder";

      placeholder.textContent =
        "Sin portada";

      card.append(placeholder);
    }

    const body = document.createElement("div");
    body.className =
      "public-profile-favorite-body";

    const heading = document.createElement("h4");
    heading.className =
      "public-profile-favorite-title";

    heading.textContent =
      title || "Sin título";

    body.append(heading);
    card.append(body);

    return card;
  }

  function renderFavoriteGroup(
    type,
    items
  ) {
    const container = document.querySelector(
      `[data-favorites-list="${type}"]`
    );

    if (!container) return;

    container.replaceChildren();

    const safeItems = Array.isArray(items)
      ? items
      : [];

    if (!safeItems.length) {
      const empty = document.createElement("p");

      empty.className =
        "public-profile-favorites-empty";

      empty.textContent =
        "Aún no hay favoritos en esta categoría.";

      container.append(empty);
      return;
    }

    for (const item of safeItems) {
      container.append(
        createFavoriteCard(item)
      );
    }
  }

  function renderFavorites(favorites) {
    const section =
      $("#publicProfileFavorites");

    if (
      !section ||
      !favorites ||
      typeof favorites !== "object" ||
      Array.isArray(favorites)
    ) {
      if (section) section.hidden = true;
      return;
    }

    for (const type of FAVORITE_TYPES) {
      renderFavoriteGroup(
        type,
        favorites[type]
      );
    }

    section.hidden = false;
  }

  function renderProfile(data) {
    const profile =
      data?.profile &&
      typeof data.profile === "object"
        ? data.profile
        : null;

    if (!profile) {
      showError();
      return;
    }

    const name = String(
      profile.name || ""
    ).trim();

    const username = String(
      profile.username || ""
    ).trim();

    const bio = String(
      profile.bio || ""
    ).trim();

    const avatar =
      $("#publicProfileAvatar");

    const nameEl =
      $("#publicProfileName");

    const usernameEl =
      $("#publicProfileUsername");

    const bioEl =
      $("#publicProfileBio");

    if (avatar) {
      avatar.src = resolveAvatarSrc(
        profile.avatar
      );

      avatar.alt = name
        ? `Avatar de ${name}`
        : "Avatar";
    }

    if (nameEl) {
      nameEl.textContent =
        name || "Usuario de Quacker";
    }

    if (usernameEl) {
      usernameEl.textContent =
        username
          ? `@${username}`
          : "";
    }

    if (bioEl) {
      bioEl.textContent = bio;
      bioEl.hidden = !bio;
    }

    document.title = name
      ? `${name} · Quacker`
      : "Perfil · Quacker";

    renderFavorites(data.favorites);

    const loading =
      $("#publicProfileLoading");

    const content =
      $("#publicProfileContent");

    const error =
      $("#publicProfileError");

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (content) content.hidden = false;
  }

  async function loadPublicProfile() {
    const username =
      getUsernameFromPath();

    if (!username) {
      showError();
      return;
    }

    try {
      const response = await fetch(
        `/api/public/users/${encodeURIComponent(username)}`,
        {
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

      if (!response.ok) {
        showError();
        return;
      }

      const data = await response.json();

      renderProfile(data);
    } catch (_) {
      showError();
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    loadPublicProfile
  );
})();
