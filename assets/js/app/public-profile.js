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

  function renderStats(stats) {
    const section =
      $("#publicProfileStats");

    const container =
      $("#publicProfileStatsGrid");

    if (
      !section ||
      !container ||
      !stats ||
      typeof stats !== "object" ||
      Array.isArray(stats)
    ) {
      if (section) section.hidden = true;
      return;
    }

    container.replaceChildren();

    const entries = [
      ["Total", stats.totalItems],
      ["Completados", stats.completedCount],
      ["En progreso", stats.inProgressCount],
      ["Sin empezar", stats.notStartedCount]
    ];

    for (const [label, value] of entries) {
      const card =
        document.createElement("article");

      card.className =
        "public-profile-stat";

      const number =
        document.createElement("strong");

      number.className =
        "public-profile-stat-value";

      const normalizedValue =
        Number.isFinite(Number(value))
          ? Math.max(0, Number(value))
          : 0;

      number.textContent =
        String(normalizedValue);

      const text =
        document.createElement("span");

      text.className =
        "public-profile-stat-label";

      text.textContent = label;

      card.append(number, text);
      container.append(card);
    }

    const byType =
      stats.byType &&
      typeof stats.byType === "object" &&
      !Array.isArray(stats.byType)
        ? stats.byType
        : {};

    const typeLabels = {
      pelicula: "🎬 Películas",
      serie: "📺 Series",
      game: "🎮 Juegos",
      book: "📚 Libros"
    };

    for (const type of FAVORITE_TYPES) {
      const card =
        document.createElement("article");

      card.className =
        "public-profile-stat public-profile-stat-type";

      const number =
        document.createElement("strong");

      number.className =
        "public-profile-stat-value";

      const value =
        Number.isFinite(Number(byType[type]))
          ? Math.max(0, Number(byType[type]))
          : 0;

      number.textContent = String(value);

      const text =
        document.createElement("span");

      text.className =
        "public-profile-stat-label";

      text.textContent = typeLabels[type];

      card.append(number, text);
      container.append(card);
    }

    section.hidden = false;
  }

  function renderLists(lists) {
    const section =
      $("#publicProfileLists");

    const container =
      $("#publicProfileListsGrid");

    if (
      !section ||
      !container ||
      !Array.isArray(lists)
    ) {
      if (section) section.hidden = true;
      return;
    }

    container.replaceChildren();

    if (!lists.length) {
      const empty =
        document.createElement("p");

      empty.className =
        "public-profile-section-empty";

      empty.textContent =
        "Aún no hay listas públicas.";

      container.append(empty);
      section.hidden = false;
      return;
    }

    for (const list of lists) {
      const card =
        document.createElement("article");

      card.className =
        "public-profile-list-card";

      const title =
        document.createElement("h3");

      title.textContent =
        String(list?.name || "").trim() ||
        "Lista sin nombre";

      card.append(title);

      const description =
        String(list?.description || "").trim();

      if (description) {
        const text =
          document.createElement("p");

        text.className =
          "public-profile-list-description";

        text.textContent = description;

        card.append(text);
      }

      const items =
        Array.isArray(list?.items)
          ? list.items
          : [];

      if (items.length) {
        const itemList =
          document.createElement("ul");

        itemList.className =
          "public-profile-list-items";

        for (const item of items) {
          const row =
            document.createElement("li");

          const title =
            String(
              item?.itemSnapshot?.title || ""
            ).trim();

          row.textContent =
            title || "Sin título";

          itemList.append(row);
        }

        card.append(itemList);
      } else {
        const empty =
          document.createElement("p");

        empty.className =
          "public-profile-section-empty";

        empty.textContent =
          "Esta lista todavía está vacía.";

        card.append(empty);
      }

      container.append(card);
    }

    section.hidden = false;
  }

  function renderReviews(reviews) {
    const section =
      $("#publicProfileReviews");

    const container =
      $("#publicProfileReviewsList");

    if (
      !section ||
      !container ||
      !Array.isArray(reviews)
    ) {
      if (section) section.hidden = true;
      return;
    }

    container.replaceChildren();

    if (!reviews.length) {
      const empty =
        document.createElement("p");

      empty.className =
        "public-profile-section-empty";

      empty.textContent =
        "Aún no hay reseñas públicas.";

      container.append(empty);
      section.hidden = false;
      return;
    }

    for (const entry of reviews) {
      const card =
        document.createElement("article");

      card.className =
        "public-profile-review-card";

      const title =
        document.createElement("h3");

      title.textContent =
        String(
          entry?.itemSnapshot?.title || ""
        ).trim() ||
        "Sin título";

      card.append(title);

      const rating =
        Number(entry?.rating);

      if (
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5
      ) {
        const ratingEl =
          document.createElement("p");

        ratingEl.className =
          "public-profile-review-rating";

        ratingEl.textContent =
          `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;

        card.append(ratingEl);
      }

      if (entry?.review?.spoiler === true) {
        const spoiler =
          document.createElement("p");

        spoiler.className =
          "public-profile-review-spoiler";

        spoiler.textContent =
          "⚠️ Contiene spoilers";

        card.append(spoiler);
      }

      const reviewText =
        String(
          entry?.review?.text || ""
        ).trim();

      const text =
        document.createElement("p");

      text.className =
        "public-profile-review-text";

      text.textContent =
        reviewText || "Sin texto";

      card.append(text);

      const tags =
        Array.isArray(entry?.tags)
          ? entry.tags
          : [];

      if (tags.length) {
        const tagsEl =
          document.createElement("div");

        tagsEl.className =
          "public-profile-review-tags";

        for (const tag of tags) {
          const chip =
            document.createElement("span");

          chip.className =
            "public-profile-review-tag";

          chip.textContent =
            String(tag || "")
              .trim()
              .replaceAll("_", " ");

          tagsEl.append(chip);
        }

        card.append(tagsEl);
      }

      container.append(card);
    }

    section.hidden = false;
  }

  function renderActivity(activity) {
    const section =
      $("#publicProfileActivity");

    const container =
      $("#publicProfileActivityList");

    if (
      !section ||
      !container ||
      !Array.isArray(activity)
    ) {
      if (section) section.hidden = true;
      return;
    }

    container.replaceChildren();

    if (!activity.length) {
      const empty =
        document.createElement("p");

      empty.className =
        "public-profile-section-empty";

      empty.textContent =
        "Aún no hay actividad pública.";

      container.append(empty);
      section.hidden = false;
      return;
    }

    for (const entry of activity) {
      const card =
        document.createElement("article");

      card.className =
        "public-profile-activity-card";

      const title =
        String(
          entry?.itemSnapshot?.title || ""
        ).trim() ||
        "Sin título";

      const heading =
        document.createElement("h3");

      heading.textContent =
        entry?.type === "completed"
          ? `Completó ${title}`
          : `Avanzó en ${title}`;

      card.append(heading);

      const details = [];

      const season =
        Number(entry?.payload?.season);

      const episode =
        Number(entry?.payload?.episode);

      const progress =
        Number(entry?.payload?.progress);

      if (
        Number.isInteger(season) &&
        season > 0 &&
        Number.isInteger(episode) &&
        episode > 0
      ) {
        details.push(
          `Temporada ${season} · Episodio ${episode}`
        );
      } else if (
        Number.isFinite(progress)
      ) {
        details.push(
          `${Math.max(
            0,
            Math.min(100, progress)
          )}%`
        );
      }

      const minutes =
        Number(entry?.minutes);

      if (
        Number.isFinite(minutes) &&
        minutes > 0
      ) {
        details.push(
          `${Math.round(minutes)} min`
        );
      }

      if (details.length) {
        const meta =
          document.createElement("p");

        meta.className =
          "public-profile-activity-meta";

        meta.textContent =
          details.join(" · ");

        card.append(meta);
      }

      container.append(card);
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
    renderStats(data.stats);
    renderLists(data.lists);
    renderReviews(data.reviews);
    renderActivity(data.activity);

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
