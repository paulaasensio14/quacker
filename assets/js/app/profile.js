// assets/js/app/profile.js

const ProfileModule = (() => {
  const $ = (sel) => document.querySelector(sel);
  const t = (key) => window.I18n?.t?.(key) ?? key;
  const PRESET_AVATARS = Object.freeze([
    { id: "av1", name: "Avatar 1", src: "assets/img/avatars/avatar-1.png" },
    { id: "av2", name: "Avatar 2", src: "assets/img/avatars/avatar-2.png" },
    { id: "av3", name: "Avatar 3", src: "assets/img/avatars/avatar-3.png" },
    { id: "av4", name: "Avatar 4", src: "assets/img/avatars/avatar-4.png" },
    { id: "av5", name: "Avatar 5", src: "assets/img/avatars/avatar-5.png" },
    { id: "av6", name: "Avatar 6", src: "assets/img/avatars/avatar-6.png" },
    { id: "av7", name: "Avatar 7", src: "assets/img/avatars/avatar-7.png" },
    { id: "av8", name: "Avatar 8", src: "assets/img/avatars/avatar-8.png" },
  ]);
  const DEFAULT_AVATAR_SRC = PRESET_AVATARS[0].src;
  const VALID_PRESET_AVATAR_SRCS = new Set(PRESET_AVATARS.map((avatar) => avatar.src));
  let initialData = null;
  let isBound = false;
  let pendingAvatarDataUrl = null;
  const PRIVACY_FIELDS = Object.freeze([
    "activity",
    "library",
    "lists",
    "reviews",
    "stats",
    "favorites"
  ]);

  let initialPrivacy = null;

  const FAVORITE_TYPES = Object.freeze([
    "pelicula",
    "serie",
    "game",
    "book"
  ]);

  const FAVORITES_PER_TYPE = 4;

  let profileFavorites = null;

  let favoritePickerContext = null;
  let favoritePickerResults = [];
  let favoritePickerAbortController = null;
  let favoritePickerSearchTimer = null;

  function renderFavoriteSlots(
    type,
    favorites = []
  ) {
    const container = document.querySelector(
      `[data-favorite-slots="${type}"]`
    );

    if (!container) return;

    container.replaceChildren();

    const safeFavorites = Array.isArray(favorites)
      ? favorites.slice(0, FAVORITES_PER_TYPE)
      : [];

    for (
      let index = 0;
      index < FAVORITES_PER_TYPE;
      index += 1
    ) {
      const favorite = safeFavorites[index] || null;
      const position = index + 1;

      const slot = document.createElement("div");
      slot.className = "profile-favorite-slot";
      slot.dataset.favoriteType = type;
      slot.dataset.favoritePosition = String(position);

      const positionEl = document.createElement("span");
      positionEl.className =
        "profile-favorite-slot-position";
      positionEl.textContent = String(position);

      slot.append(positionEl);

      if (favorite) {
        const titleEl = document.createElement("strong");
        titleEl.className =
          "profile-favorite-slot-title";
        titleEl.textContent =
          String(
            favorite?.itemSnapshot?.title || ""
          ).trim() ||
          t("profile_favorites_unknown_title");

        slot.append(titleEl);

        const actionsEl = document.createElement("div");
        actionsEl.className =
          "profile-favorite-slot-actions";

        if (index > 0) {
          const moveUpBtn =
            document.createElement("button");
          moveUpBtn.type = "button";
          moveUpBtn.className =
            "profile-favorite-action";
          moveUpBtn.setAttribute("data-favorite-action", "move-up");
          moveUpBtn.setAttribute(
            "aria-label",
            t("profile_favorites_move_up")
          );
          moveUpBtn.textContent = "↑";
          actionsEl.append(moveUpBtn);
        }

        if (index < safeFavorites.length - 1) {
          const moveDownBtn =
            document.createElement("button");
          moveDownBtn.type = "button";
          moveDownBtn.className =
            "profile-favorite-action";
          moveDownBtn.setAttribute("data-favorite-action", "move-down");
          moveDownBtn.setAttribute(
            "aria-label",
            t("profile_favorites_move_down")
          );
          moveDownBtn.textContent = "↓";
          actionsEl.append(moveDownBtn);
        }

        const replaceBtn =
          document.createElement("button");
        replaceBtn.type = "button";
        replaceBtn.className =
          "profile-favorite-action";
        replaceBtn.setAttribute(
          "data-favorite-action",
          "replace"
        );
        replaceBtn.setAttribute(
          "aria-label",
          t("profile_favorites_replace")
        );
        replaceBtn.textContent = "↻";

        actionsEl.append(replaceBtn);

        const removeBtn =
          document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className =
          "profile-favorite-action profile-favorite-action--remove";
        removeBtn.setAttribute("data-favorite-action", "remove");
        removeBtn.setAttribute(
          "aria-label",
          t("profile_favorites_remove")
        );
        removeBtn.textContent = "×";

        actionsEl.append(removeBtn);
        slot.append(actionsEl);
      } else {
        slot.classList.add(
          "profile-favorite-slot--empty"
        );

        if (index === safeFavorites.length) {
          const pickBtn =
            document.createElement("button");
          pickBtn.type = "button";
          pickBtn.className =
            "profile-favorite-pick";
          pickBtn.setAttribute("data-favorite-action", "pick");
          pickBtn.setAttribute(
            "aria-label",
            t("profile_favorites_empty_slot")
          );
          pickBtn.textContent =
            `+ ${t("profile_favorites_empty_slot")}`;

          slot.append(pickBtn);
        } else {
          const emptyEl =
            document.createElement("span");
          emptyEl.className =
            "profile-favorite-slot-empty";
          emptyEl.textContent =
            t("profile_favorites_empty_slot");

          slot.append(emptyEl);
        }
      }

      container.append(slot);
    }
  }

  function renderFavorites(
    favorites = {}
  ) {
    for (const type of FAVORITE_TYPES) {
      renderFavoriteSlots(
        type,
        favorites?.[type]
      );
    }
  }

  async function loadFavoritesIntoProfile() {
    const status = $("#profileFavoritesStatus");

    try {
      const favorites =
        await ApiClient.getUserFavorites();

      profileFavorites = favorites || {};
      renderFavorites(profileFavorites);

      if (status) {
        status.textContent = "";
      }
    } catch (err) {
      console.error(
        "ProfileModule: failed to load favorites",
        err
      );

      profileFavorites = {};
      renderFavorites(profileFavorites);

      if (status) {
        status.textContent =
          t("profile_favorites_load_error");
      }
    }
  }


  function renderFavoritePickerResults(
    items = []
  ) {
    const resultsEl = $("#favoritePickerResults");

    if (!resultsEl) return;

    resultsEl.replaceChildren();

    favoritePickerResults = (
      Array.isArray(items) ? items : []
    )
      .filter((item) => {
        const source = String(
          item?.source || ""
        ).trim();

        const externalId = String(
          item?.externalId || ""
        ).trim();

        const title = String(
          item?.title || ""
        ).trim();

        const type = String(
          item?.type || ""
        ).trim();

        return (
          source &&
          externalId &&
          title &&
          type === favoritePickerContext?.type
        );
      })
      .slice(0, 12);

    if (favoritePickerResults.length === 0) {
      const emptyEl =
        document.createElement("p");

      emptyEl.className =
        "favorite-picker-empty";

      emptyEl.textContent =
        t("profile_favorites_picker_empty");

      resultsEl.append(emptyEl);
      return;
    }

    favoritePickerResults.forEach(
      (item, index) => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.className =
          "favorite-picker-result";

        button.setAttribute(
          "data-favorite-result",
          String(index)
        );

        const titleEl =
          document.createElement("strong");

        titleEl.className =
          "favorite-picker-result-title";

        titleEl.textContent =
          String(item.title || "").trim();

        const sourceEl =
          document.createElement("span");

        sourceEl.className =
          "favorite-picker-result-source";

        sourceEl.textContent =
          String(item.source || "").trim();

        button.append(
          titleEl,
          sourceEl
        );

        resultsEl.append(button);
      }
    );
  }

  function closeFavoritePicker() {
    const modal =
      $("#favoritePickerModal");

    if (!modal) return;

    if (favoritePickerSearchTimer) {
      clearTimeout(
        favoritePickerSearchTimer
      );
      favoritePickerSearchTimer = null;
    }

    favoritePickerAbortController?.abort();
    favoritePickerAbortController = null;

    favoritePickerContext = null;
    favoritePickerResults = [];

    window.UIModal?.close(modal);
  }

  function openFavoritePicker(
    type,
    position,
    mode = "add"
  ) {
    if (
      !FAVORITE_TYPES.includes(type) ||
      !Number.isInteger(position) ||
      position < 1 ||
      position > FAVORITES_PER_TYPE
    ) {
      return;
    }

    const modal =
      $("#favoritePickerModal");

    const searchInput =
      $("#favoritePickerSearch");

    const resultsEl =
      $("#favoritePickerResults");

    const statusEl =
      $("#favoritePickerStatus");

    if (!modal) return;

    favoritePickerContext = {
      type,
      position,
      mode: mode === "replace"
        ? "replace"
        : "add"
    };

    favoritePickerResults = [];

    if (searchInput) {
      searchInput.value = "";
    }

    if (resultsEl) {
      resultsEl.replaceChildren();
    }

    if (statusEl) {
      statusEl.textContent =
        t("profile_favorites_picker_hint");
    }

    window.UIModal?.open(modal, {
      initialFocusSelector:
        "#favoritePickerSearch"
    });
  }

  async function searchFavoritePicker() {
    const searchInput =
      $("#favoritePickerSearch");

    const statusEl =
      $("#favoritePickerStatus");

    const resultsEl =
      $("#favoritePickerResults");

    const query = String(
      searchInput?.value || ""
    ).trim();

    const type = String(
      favoritePickerContext?.type || ""
    ).trim();

    if (
      !query ||
      !FAVORITE_TYPES.includes(type)
    ) {
      favoritePickerAbortController?.abort();
      favoritePickerAbortController = null;

      favoritePickerResults = [];

      if (resultsEl) {
        resultsEl.replaceChildren();
      }

      if (statusEl) {
        statusEl.textContent =
          t("profile_favorites_picker_hint");
      }

      return;
    }

    favoritePickerAbortController?.abort();

    const controller =
      new AbortController();

    favoritePickerAbortController =
      controller;

    if (statusEl) {
      statusEl.textContent =
        t("profile_favorites_picker_loading");
    }

    try {
      const items =
        await ApiClient.getExploreFeed({
          query,
          type,
          limit: 12,
          signal: controller.signal
        });

      if (
        controller.signal.aborted ||
        favoritePickerAbortController !==
          controller
      ) {
        return;
      }

      renderFavoritePickerResults(
        items
      );

      if (statusEl) {
        statusEl.textContent = "";
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      console.error(
        "ProfileModule: favorite search failed",
        err
      );

      favoritePickerResults = [];

      if (resultsEl) {
        resultsEl.replaceChildren();
      }

      if (statusEl) {
        statusEl.textContent =
          t(
            "profile_favorites_picker_search_error"
          );
      }
    } finally {
      if (
        favoritePickerAbortController ===
        controller
      ) {
        favoritePickerAbortController = null;
      }
    }
  }

  function bindFavoritePicker() {
    const modal =
      $("#favoritePickerModal");

    const searchInput =
      $("#favoritePickerSearch");

    const resultsEl =
      $("#favoritePickerResults");

    if (!modal) return;

    modal
      .querySelectorAll(
        "[data-favorite-picker-close]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          closeFavoritePicker
        );
      });

    if (searchInput) {
      searchInput.addEventListener(
        "input",
        () => {
          if (favoritePickerSearchTimer) {
            clearTimeout(
              favoritePickerSearchTimer
            );
          }

          favoritePickerSearchTimer =
            setTimeout(() => {
              favoritePickerSearchTimer = null;
              searchFavoritePicker();
            }, 600);
        }
      );
    }

    if (resultsEl) {
      resultsEl.addEventListener(
        "click",
        async (event) => {
          const button =
            event.target.closest(
              "[data-favorite-result]"
            );

          if (
            !button ||
            !resultsEl.contains(button)
          ) {
            return;
          }

          const index = Number(
            button.dataset.favoriteResult
          );

          const item =
            favoritePickerResults[index];

          const type = String(
            favoritePickerContext?.type || ""
          ).trim();

          if (
            !item ||
            !FAVORITE_TYPES.includes(type)
          ) {
            return;
          }

          const source = String(
            item?.source || ""
          ).trim();

          const externalId = String(
            item?.externalId || ""
          ).trim();

          const title = String(
            item?.title || ""
          ).trim();

          const cover = String(
            item?.cover || ""
          ).trim();

          if (
            !source ||
            !externalId ||
            !title
          ) {
            return;
          }

          const statusEl =
            $("#favoritePickerStatus");

          button.disabled = true;

          try {
            const payload = {
              source,
              contentType: type,
              externalId,
              itemSnapshot: {
                title,
                cover
              }
            };

            const pickerPosition =
              Number(
                favoritePickerContext?.position
              );

            let result = null;

            if (
              favoritePickerContext?.mode ===
              "replace"
            ) {
              result =
                await ApiClient.replaceUserFavorite(
                  type,
                  pickerPosition,
                  payload
                );
            } else {
              result =
                await ApiClient.addUserFavorite(
                  type,
                  payload
                );
            }

            profileFavorites =
              result?.favorites ||
              profileFavorites ||
              {};

            renderFavorites(
              profileFavorites
            );

            const profileStatus =
              $("#profileFavoritesStatus");

            if (profileStatus) {
              profileStatus.textContent = "";
            }

            closeFavoritePicker();
          } catch (err) {
            console.error(
              "ProfileModule: failed to add favorite",
              err
            );

            if (statusEl) {
              const errorCode = String(
                err?.error ||
                err?.message ||
                ""
              ).trim();

              statusEl.textContent =
                errorCode ===
                "favorite_already_exists"
                  ? t(
                      "profile_favorites_duplicate"
                    )
                  : t(
                      "profile_favorites_update_error"
                    );
            }
          } finally {
            button.disabled = false;
          }
        }
      );
    }
  }


  function bindFavoriteActions() {
    const card = $("#profileFavoritesCard");

    if (!card) return;

    card.addEventListener("click", async (event) => {
      const button = event.target.closest(
        "[data-favorite-action]"
      );

      if (!button || !card.contains(button)) {
        return;
      }

      const slot = button.closest(
        ".profile-favorite-slot"
      );

      if (!slot) return;

      const type = String(
        slot.dataset.favoriteType || ""
      ).trim();

      const position = Number(
        slot.dataset.favoritePosition
      );

      const action = String(
        button.dataset.favoriteAction || ""
      ).trim();

      if (
        !FAVORITE_TYPES.includes(type) ||
        !Number.isInteger(position)
      ) {
        return;
      }

      if (action === "pick") {
        openFavoritePicker(
          type,
          position,
          "add"
        );
        return;
      }

      if (action === "replace") {
        openFavoritePicker(
          type,
          position,
          "replace"
        );
        return;
      }

      const status = $("#profileFavoritesStatus");

      button.disabled = true;

      try {
        let result = null;

        if (action === "remove") {
          result =
            await ApiClient.removeUserFavorite(
              type,
              position
            );
        } else if (
          action === "move-up" ||
          action === "move-down"
        ) {
          const toPosition =
            action === "move-up"
              ? position - 1
              : position + 1;

          result =
            await ApiClient.moveUserFavorite(
              type,
              position,
              toPosition
            );
        } else {
          return;
        }

        profileFavorites =
          result?.favorites ||
          profileFavorites ||
          {};

        renderFavorites(profileFavorites);

        if (status) {
          status.textContent = "";
        }
      } catch (err) {
        console.error(
          "ProfileModule: failed to update favorites",
          err
        );

        if (status) {
          status.textContent =
            t("profile_favorites_update_error");
        }
      } finally {
        button.disabled = false;
      }
    });
  }


  function showErrors(errors) {
    const box = $("#profileFormErrors");
    if (!box) return;

    if (!errors || errors.length === 0) {
      box.classList.add("is-initially-hidden");
      box.innerHTML = "";
      return;
    }

    box.classList.remove("is-initially-hidden");
    box.innerHTML = `<ul>${errors.map(e => `<li>${e}</li>`).join("")}</ul>`;
  }

  function getFormData() {
    return {
      name: ($("#profileName")?.value || "").replace(/\s+/g, " ").trim(),
      handle: $("#profileHandle")?.value.trim() || "",
      email: ($("#profileEmail")?.value || "").trim().toLowerCase(),
      language: $("#profileLanguage")?.value || "es",
      bio: $("#profileBio")?.value.trim() || "",
      // avatar: solo lo enviamos si se cambió
      avatar: pendingAvatarDataUrl || null,
    };
  }

  function normalizeHandle(handle) {
    const h = (handle || "").trim();
    if (!h) return "";
    return h.startsWith("@") ? h : `@${h}`;
  }

  function validate(data) {
    const errors = [];

    if (
      !data.name ||
      data.name.length < 2 ||
      data.name.length > 80
    ) {
      errors.push(t("profile_error_name_short"));
    }

    const handle = normalizeHandle(data.handle);
    if (!handle || handle.length < 2) {
      errors.push(t("profile_error_handle_required"));
    } else {
      const raw = handle.slice(1);
      if (!/^[a-zA-Z0-9_]{2,20}$/.test(raw)) {
        errors.push(t("profile_error_handle_invalid"));
      }
    }

    if (!data.email) {
      errors.push(t("profile_error_email_required"));
    } else if (
      data.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
      errors.push(t("profile_error_email_invalid"));
    }

    if (data.bio && data.bio.length > 180) {
      errors.push(t("profile_error_bio_long"));
    }

    return errors;
  }

  function sameData(a, b) {
    if (!a || !b) return true;

    return (
      (a.name || "") === (b.name || "") &&
      (a.handle || "") === (b.handle || "") &&
      (a.email || "") === (b.email || "") &&
      (a.language || "es") === (b.language || "es") &&
      (a.bio || "") === (b.bio || "") &&
      // si no hay avatar pendiente, no cuenta como cambio
      !pendingAvatarDataUrl
    );
  }

  function updateSaveButtonState() {
    const btn = $("#profileSaveBtn");
    if (!btn) return;

    const current = getFormData();
    current.handle = normalizeHandle(current.handle);

    const hasChanges = !sameData(initialData, current);
    btn.disabled = !hasChanges;
  }

  function showPrivacyErrors(errors) {
    const box = $("#profilePrivacyFormErrors");
    if (!box) return;

    if (!errors || errors.length === 0) {
      box.classList.add("is-initially-hidden");
      box.innerHTML = "";
      return;
    }

    box.classList.remove("is-initially-hidden");
    box.innerHTML = `<ul>${errors.map((error) => `<li>${error}</li>`).join("")}</ul>`;
  }

  function getPrivacyFormData() {
    const visibilitySelect = document.querySelector(
      '[data-privacy-field="profileVisibility"]'
    );

    return PRIVACY_FIELDS.reduce(
      (privacy, field) => {
        const input = document.querySelector(
          `[data-privacy-field="${field}"]`
        );

        privacy[field] = input?.checked === true;
        return privacy;
      },
      {
        profileVisibility:
          visibilitySelect?.value || "hidden"
      }
    );
  }

  function samePrivacy(a, b) {
    if (!a || !b) return true;

    return (
      a.profileVisibility === b.profileVisibility &&
      PRIVACY_FIELDS.every(
        (field) => a[field] === b[field]
      )
    );
  }

  function updatePrivacySaveButtonState() {
    const btn = $("#profilePrivacySaveBtn");
    if (!btn) return;

    btn.disabled = samePrivacy(
      initialPrivacy,
      getPrivacyFormData()
    );
  }

  function renderPrivacyForm(privacy = {}) {
    const visibilitySelect = document.querySelector(
      '[data-privacy-field="profileVisibility"]'
    );

    if (visibilitySelect) {
      visibilitySelect.value =
        privacy.profileVisibility || "hidden";
    }

    for (const field of PRIVACY_FIELDS) {
      const input = document.querySelector(
        `[data-privacy-field="${field}"]`
      );

      if (input) {
        input.checked = privacy[field] === true;
      }
    }
  }

  function normalizePrivacyFormState(privacy = {}) {
    return PRIVACY_FIELDS.reduce(
      (state, field) => {
        state[field] = privacy?.[field] === true;
        return state;
      },
      {
        profileVisibility:
          privacy?.profileVisibility || "hidden"
      }
    );
  }

  async function loadPrivacyIntoForm() {
    try {
      const privacy = await ApiClient.getUserPrivacy();

      initialPrivacy =
        normalizePrivacyFormState(privacy);

      renderPrivacyForm(initialPrivacy);
      showPrivacyErrors([]);
      updatePrivacySaveButtonState();
    } catch (err) {
      console.error(
        "ProfileModule: failed to load privacy",
        err
      );

      showPrivacyErrors([
        t("profile_privacy_load_error")
      ]);
    }
  }

  function resolveAvatarSrc(avatarUrl) {
    const safeAvatar = String(avatarUrl || "").trim();

    if (!safeAvatar) return DEFAULT_AVATAR_SRC;
    if (safeAvatar.startsWith("data:image/")) return safeAvatar;
    if (VALID_PRESET_AVATAR_SRCS.has(safeAvatar)) return safeAvatar;

    return DEFAULT_AVATAR_SRC;
  }

  function updateHeaderAvatars(avatarUrl) {
    const safeAvatar = resolveAvatarSrc(avatarUrl);

    const chipImg = document.querySelector("#profileChip .avatar-circle img");
    if (chipImg) chipImg.src = safeAvatar;

    const menuImg = document.querySelector("#profileMenu .profile-menu-avatar img");
    if (menuImg) menuImg.src = safeAvatar;

    const homeBannerImg = document.getElementById("homeBannerAvatar");
    if (homeBannerImg) homeBannerImg.src = safeAvatar;
  }

  function updateHeaderUI(user) {
    const chipName = $("#profileChipName");
    if (chipName) chipName.textContent = user?.name || t("profile_fallback_name");

    const welcomeName = $("#welcomeName");
    if (welcomeName) welcomeName.textContent = user?.name || t("profile_fallback_name");

    const menuName = $("#profileMenuName");
    const menuHandle = $("#profileMenuHandle");
    if (menuName) menuName.textContent = user?.name || t("profile_fallback_name");
    if (menuHandle) menuHandle.textContent = user?.handle || "@quacker";

    updateHeaderAvatars(user?.avatar);
  }

  function setAvatarPreview(dataUrl) {
    const img = $("#profileAvatarImg");
    if (!img) return;

    img.src = resolveAvatarSrc(dataUrl);
  }

  function openAvatarPickerModal() {
    const modal = document.getElementById("avatarPickerModal");
    if (!modal) return;

    renderAvatarGrid();
    window.UIModal?.open(modal, {
      initialFocusSelector: ".avatar-option"
    });
  }

  function closeAvatarPickerModal() {
    const modal = document.getElementById("avatarPickerModal");
    if (!modal) return;

    window.UIModal?.close(modal);
  }

  function renderAvatarGrid() {
    const grid = document.getElementById("avatarGrid");
    if (!grid) return;

    grid.innerHTML = PRESET_AVATARS.map(a => `
      <button type="button" class="avatar-option" data-avatar-id="${a.id}">
        <img src="${a.src}" alt="${a.name}">
        <span>${a.name}</span>
      </button>
    `).join("");
  }

  function buildOpinionsSummary(opinions = []) {
    const safeOpinions = Array.isArray(opinions) ? opinions : [];

    const ratedOpinions = safeOpinions.filter((opinion) => {
      const rating = opinion?.rating;
      return Number.isInteger(rating) && rating >= 1 && rating <= 5;
    });

    const reviews = safeOpinions.filter((opinion) => {
      return String(opinion?.review?.text || "").trim().length > 0;
    });

    const average = ratedOpinions.length
      ? ratedOpinions.reduce((sum, opinion) => sum + opinion.rating, 0) /
        ratedOpinions.length
      : null;

    const latest = [...safeOpinions]
      .filter(Boolean)
      .sort((a, b) => {
        const aDate = Date.parse(a?.updatedAt || a?.createdAt || "") || 0;
        const bDate = Date.parse(b?.updatedAt || b?.createdAt || "") || 0;
        return bDate - aDate;
      })[0] || null;

    return {
      opinionsCount: safeOpinions.length,
      average,
      reviewsCount: reviews.length,
      latest
    };
  }

  function renderOpinionsSummary(summary) {
    const countEl = $("#profileOpinionsCount");
    const averageEl = $("#profileOpinionsAverage");
    const reviewsEl = $("#profileReviewsCount");
    const latestEl = $("#profileOpinionsLatest");

    if (!summary) return;

    if (countEl) {
      countEl.textContent = String(summary.opinionsCount || 0);
    }

    if (averageEl) {
      if (Number.isFinite(summary.average)) {
        const locale = document.documentElement.lang || "es";
        averageEl.textContent = `${new Intl.NumberFormat(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1
        }).format(summary.average)}/5`;
      } else {
        averageEl.textContent = "—";
      }
    }

    if (reviewsEl) {
      reviewsEl.textContent = String(summary.reviewsCount || 0);
    }

    if (latestEl) {
      const latest = summary.latest;

      if (!latest) {
        latestEl.textContent = t("profile_opinions_latest_empty");
        return;
      }

      const title =
        String(latest?.itemSnapshot?.title || "").trim() ||
        t("profile_opinions_unknown_title");

      const rating = latest?.rating;
      const hasRating =
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5;

      latestEl.textContent = hasRating
        ? `${title} · ${rating}/5`
        : title;
    }
  }

  async function loadOpinionsSummary() {
    try {
      const opinions = await ApiClient.getOpinions();
      renderOpinionsSummary(buildOpinionsSummary(opinions));
    } catch (err) {
      console.error("ProfileModule: failed to load opinions", err);
      renderOpinionsSummary(buildOpinionsSummary([]));
    }
  }

  function renderOpinionsList(opinions = []) {
    const listEl = $("#profileOpinionsAllList");
    if (!listEl) return;

    const safeOpinions = Array.isArray(opinions)
      ? opinions.filter(Boolean)
      : [];

    const sortedOpinions = [...safeOpinions].sort((a, b) => {
      const aDate = Date.parse(a?.updatedAt || a?.createdAt || "") || 0;
      const bDate = Date.parse(b?.updatedAt || b?.createdAt || "") || 0;
      return bDate - aDate;
    });

    listEl.replaceChildren();

    if (!sortedOpinions.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "profile-opinions-list-empty";
      emptyEl.textContent = t("profile_opinions_latest_empty");
      listEl.append(emptyEl);
      return;
    }

    sortedOpinions.forEach((opinion) => {
      const itemEl = document.createElement("article");
      itemEl.className = "profile-opinions-list-item";

      const headerEl = document.createElement("div");
      headerEl.className = "profile-opinions-list-item-header";

      const titleEl = document.createElement("strong");
      titleEl.className = "profile-opinions-list-title";
      titleEl.textContent =
        String(opinion?.itemSnapshot?.title || "").trim() ||
        t("profile_opinions_unknown_title");

      headerEl.append(titleEl);

      const rating = opinion?.rating;
      const hasRating =
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5;

      if (hasRating) {
        const ratingEl = document.createElement("div");
        ratingEl.className = "profile-opinions-list-rating";
        ratingEl.setAttribute(
          "aria-label",
          t("detail_opinion_rating_value").replace("{value}", String(rating))
        );

        const duckEl = document.createElement("img");
        duckEl.className = "profile-opinions-list-rating-duck";
        duckEl.src = "assets/img/quacker-rating.png";
        duckEl.alt = "";
        duckEl.setAttribute("aria-hidden", "true");

        const ratingValueEl = document.createElement("strong");
        ratingValueEl.textContent = `${rating}/5`;

        ratingEl.append(duckEl, ratingValueEl);
        headerEl.append(ratingEl);
      }

      itemEl.append(headerEl);

      const reviewText = String(opinion?.review?.text || "").trim();

      if (reviewText) {
        const reviewEl = document.createElement("p");
        reviewEl.className = "profile-opinions-list-review";
        reviewEl.textContent = reviewText;
        itemEl.append(reviewEl);
      }

      listEl.append(itemEl);
    });
  }

  async function loadOpinionsView() {
    try {
      const opinions = await ApiClient.getOpinions();
      renderOpinionsList(opinions);
    } catch (err) {
      console.error("ProfileModule: failed to load opinions view", err);
      renderOpinionsList([]);
    }
  }

  async function loadProfileIntoForm() {
    const user = await ApiClient.getUser();
    if (!user) return;

    if ($("#profileName")) $("#profileName").value = user.name || "";
    if ($("#profileHandle")) $("#profileHandle").value = user.handle || "";
    if ($("#profileEmail")) $("#profileEmail").value = user.email || "";
    if ($("#profileLanguage")) $("#profileLanguage").value = user.language || "es";
    if ($("#profileBio")) $("#profileBio").value = user.bio || "";

    setAvatarPreview(user.avatar || "");

    pendingAvatarDataUrl = null; // al cargar, no hay “avatar pendiente”
    initialData = {
      name: user.name || "",
      handle: user.handle || "",
      email: user.email || "",
      language: user.language || "es",
      bio: user.bio || "",
    };

    updateHeaderUI(user);
    showErrors([]);
    updateSaveButtonState();
  }

  function bindDirtyTracking() {
    const form = $("#profileForm");
    if (!form) return;

    ["profileName", "profileHandle", "profileEmail", "profileLanguage", "profileBio"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        showErrors([]); // al escribir, limpiamos mensajes
        updateSaveButtonState();
      });
      el.addEventListener("change", () => {
        showErrors([]);
        updateSaveButtonState();
      });
    });
  }

  function bindAvatar() {
    const btn = $("#profileAvatarBtn");
    const input = $("#profileAvatarInput");

    if (btn && input) {
      btn.addEventListener("click", () => input.click());

      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;

        // validación suave: tamaño máx 1.5MB
        if (file.size > 1.5 * 1024 * 1024) {
          showErrors([t("profile_error_avatar_too_large")]);
          input.value = "";
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          pendingAvatarDataUrl = dataUrl;
          setAvatarPreview(dataUrl);
          updateSaveButtonState();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function bindAvatarPicker() {
    const openBtn = document.getElementById("profileAvatarPickerBtn");
    const modal = document.getElementById("avatarPickerModal");
    const uploadFromModal = document.getElementById("avatarUploadFromModal");
    const fileInput = document.getElementById("profileAvatarInput");

    if (openBtn) {
      openBtn.addEventListener("click", openAvatarPickerModal);
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        // cerrar modal
        if (e.target.matches("[data-avatar-close]") || e.target.closest("[data-avatar-close]")) {
          closeAvatarPickerModal();
          return;
        }

        // seleccionar un avatar
        const opt = e.target.closest(".avatar-option");
        if (opt) {
          const id = opt.dataset.avatarId;
          const found = PRESET_AVATARS.find(a => a.id === id);
          if (!found) return;

          pendingAvatarDataUrl = found.src;   // guardamos RUTA de tu imagen
          setAvatarPreview(found.src);        // preview en "Mi perfil"
          updateSaveButtonState();            // activa "Guardar cambios"
          closeAvatarPickerModal();
        }
      });
    }

    // botón "Subir mi foto" dentro del modal
    if (uploadFromModal && fileInput) {
      uploadFromModal.addEventListener("click", () => {
        closeAvatarPickerModal();
        fileInput.click();
      });
    }

  }


  function resolveFollowRequestAvatarSrc(avatarUrl) {
    const safeAvatar = String(avatarUrl || "").trim();

    if (!safeAvatar) return DEFAULT_AVATAR_SRC;

    if (
      safeAvatar.startsWith("https://") ||
      safeAvatar.startsWith("/assets/") ||
      safeAvatar.startsWith("assets/") ||
      /^data:image\/(?:jpeg|png|webp|gif);/i.test(safeAvatar)
    ) {
      return safeAvatar;
    }

    return DEFAULT_AVATAR_SRC;
  }

  function renderFollowRequests(requests = []) {
    const list = $("#profileFollowRequestsList");
    const status = $("#profileFollowRequestsStatus");

    if (!list) return;

    list.replaceChildren();

    const safeRequests = (
      Array.isArray(requests) ? requests : []
    ).filter((request) => {
      return String(request?.username || "").trim();
    });

    if (safeRequests.length === 0) {
      if (status) {
        status.textContent =
          t("profile_follow_requests_empty");
      }
      return;
    }

    if (status) {
      status.textContent = "";
    }

    for (const request of safeRequests) {
      const username = String(
        request.username || ""
      )
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

      const row = document.createElement("article");
      row.className = "profile-follow-request-row";

      const identity = document.createElement("div");
      identity.className =
        "profile-follow-request-identity";

      const avatar = document.createElement("img");
      avatar.className =
        "profile-follow-request-avatar";
      avatar.src = resolveFollowRequestAvatarSrc(
        request.avatar
      );
      avatar.alt = "";
      avatar.setAttribute("aria-hidden", "true");

      const text = document.createElement("div");
      text.className =
        "profile-follow-request-text";

      const name = document.createElement("strong");
      name.className =
        "profile-follow-request-name";
      name.textContent =
        String(request.name || "").trim() ||
        `@${username}`;

      const handle = document.createElement("span");
      handle.className =
        "profile-follow-request-handle";
      handle.textContent = `@${username}`;

      text.append(name, handle);
      identity.append(avatar, text);

      const actions = document.createElement("div");
      actions.className =
        "profile-follow-request-actions";

      const acceptButton =
        document.createElement("button");
      acceptButton.type = "button";
      acceptButton.className =
        "btn-primary profile-follow-request-action";
      acceptButton.dataset.followRequestAction =
        "accept";
      acceptButton.dataset.username = username;
      acceptButton.textContent =
        t("profile_follow_requests_accept");

      const rejectButton =
        document.createElement("button");
      rejectButton.type = "button";
      rejectButton.className =
        "profile-follow-request-action profile-follow-request-action--reject";
      rejectButton.dataset.followRequestAction =
        "reject";
      rejectButton.dataset.username = username;
      rejectButton.textContent =
        t("profile_follow_requests_reject");

      actions.append(
        acceptButton,
        rejectButton
      );

      row.append(identity, actions);
      list.append(row);
    }
  }

  async function loadFollowRequests() {
    const status = $("#profileFollowRequestsStatus");

    if (status) {
      status.textContent =
        t("profile_follow_requests_loading");
    }

    try {
      const requests =
        await ApiClient.getFollowRequests();

      renderFollowRequests(requests);
    } catch (err) {
      console.error(
        "ProfileModule: failed to load follow requests",
        err
      );

      renderFollowRequests([]);

      if (status) {
        status.textContent =
          t("profile_follow_requests_load_error");
      }
    }
  }

  function bindFollowRequests() {
    const list = $("#profileFollowRequestsList");

    if (!list) return;

    list.addEventListener("click", async (event) => {
      const button = event.target.closest(
        "[data-follow-request-action]"
      );

      if (!button || !list.contains(button)) {
        return;
      }

      const action = String(
        button.dataset.followRequestAction || ""
      ).trim();

      const username = String(
        button.dataset.username || ""
      ).trim();

      if (
        !username ||
        !["accept", "reject"].includes(action)
      ) {
        return;
      }

      const row = button.closest(
        ".profile-follow-request-row"
      );

      const actionButtons = row
        ? row.querySelectorAll(
            "[data-follow-request-action]"
          )
        : [button];

      for (const actionButton of actionButtons) {
        actionButton.disabled = true;
      }

      const status = $("#profileFollowRequestsStatus");

      if (status) {
        status.textContent = "";
      }

      try {
        if (action === "accept") {
          await ApiClient.acceptFollowRequest(
            username
          );
        } else {
          await ApiClient.rejectFollowRequest(
            username
          );
        }

        await loadFollowRequests();
      } catch (err) {
        console.error(
          "ProfileModule: failed to update follow request",
          err
        );

        if (status) {
          status.textContent =
            t("profile_follow_requests_update_error");
        }

        for (const actionButton of actionButtons) {
          actionButton.disabled = false;
        }
      }
    });
  }

  function bindPrivacyForm() {
    const form = $("#profilePrivacyForm");
    const saveBtn = $("#profilePrivacySaveBtn");

    if (!form) return;

    const privacyInputs = [
      document.querySelector(
        '[data-privacy-field="profileVisibility"]'
      ),
      ...PRIVACY_FIELDS.map((field) =>
        document.querySelector(
          `[data-privacy-field="${field}"]`
        )
      )
    ];

    for (const input of privacyInputs) {
      if (!input) continue;

      input.addEventListener("change", () => {
        showPrivacyErrors([]);
        updatePrivacySaveButtonState();
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = getPrivacyFormData();

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = t("profile_privacy_saving");
      }

      try {
        const updated =
          await ApiClient.updateUserPrivacy(payload);

        initialPrivacy =
          normalizePrivacyFormState(updated);

        renderPrivacyForm(initialPrivacy);
        showPrivacyErrors([]);

        window.toast?.({
          title: t("profile_privacy_saved"),
          type: "success",
          duration: 2200
        });
      } catch (err) {
        console.error(
          "ProfileModule: failed to save privacy",
          err
        );

        showPrivacyErrors([
          t("profile_privacy_save_error")
        ]);
      } finally {
        if (saveBtn) {
          saveBtn.textContent = t("profile_privacy_save");
          updatePrivacySaveButtonState();
        }
      }
    });
  }

  function bindOpinionsNavigation() {
    const viewAllBtn = $("#profileOpinionsViewAll");
    const backBtn = $("#profileOpinionsBack");

    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", () => {
        window.Router?.showView("opinions");
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.Router?.showView("profile");
      });
    }
  }

  function bindForm() {
    const form = $("#profileForm");
    const saveBtn = $("#profileSaveBtn");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = getFormData();
      data.handle = normalizeHandle(data.handle);

      const errors = validate(data);
      if (errors.length) {
        showErrors(errors);
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = t("profile_saving");
      }

      try {
        const payload = {
          name: data.name,
          handle: data.handle,
          email: data.email,
          language: data.language,
          bio: data.bio,
        };
        if (data.avatar) payload.avatar = data.avatar;

        const updated = await ApiClient.updateUser(payload);
        updateHeaderUI(updated);

        // actualizamos “estado inicial” tras guardar
        pendingAvatarDataUrl = null;
        initialData = {
          name: updated.name || "",
          handle: updated.handle || "",
          email: updated.email || "",
          language: updated.language || "es",
          bio: updated.bio || "",
        };

        showErrors([]);

        window.toast?.({ 
          title: t("profile_saved"), 
          type: "success", 
          duration: 2200 
        });
      } catch (err) {
        console.error(err);

        const errorCode = String(
          err?.error || err?.message || ""
        ).trim();

        const errorMessages = {
          handle_in_use: t("profile_error_handle_in_use"),
          invalid_handle: t("profile_error_handle_invalid"),
          email_in_use: t("profile_error_email_in_use"),
          invalid_email: t("profile_error_email_invalid"),
          invalid_name: t("profile_error_name_short")
        };

        showErrors([
          errorMessages[errorCode] || t("profile_save_error")
        ]);
      } finally {
        if (saveBtn) {
          saveBtn.textContent = t("profile_save");
          updateSaveButtonState();
        }
      }
    });
  }

  async function init() {
    // Bind de listeners solo una vez (evita duplicados si app-core refresca perfil)
    if (!isBound) {
      bindAvatar();
      bindAvatarPicker();
      bindDirtyTracking();
      bindPrivacyForm();
      bindFollowRequests();
      bindFavoriteActions();
      bindFavoritePicker();
      bindOpinionsNavigation();
      bindForm();
      isBound = true;
    }

    // Cargar datos siempre que se active / cambie el usuario
    const initialLoads = [
      loadProfileIntoForm(),
      loadPrivacyIntoForm(),
      loadFollowRequests(),
      loadFavoritesIntoProfile(),
      loadOpinionsSummary()
    ];

    if ($("#view-opinions")?.classList.contains("is-active")) {
      initialLoads.push(loadOpinionsView());
    }

    await Promise.all(initialLoads);
  }

  async function load() {
    await Promise.all([
      loadProfileIntoForm(),
      loadPrivacyIntoForm(),
      loadFollowRequests(),
      loadFavoritesIntoProfile(),
      loadOpinionsSummary()
    ]);
  }

  return { init, load, loadOpinionsView };
})();

// Exponer al scope global
window.ProfileModule = ProfileModule;
