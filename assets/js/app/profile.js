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
      bindOpinionsNavigation();
      bindForm();
      isBound = true;
    }

    // Cargar datos siempre que se active / cambie el usuario
    const initialLoads = [
      loadProfileIntoForm(),
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
      loadOpinionsSummary()
    ]);
  }

  return { init, load, loadOpinionsView };
})();

// Exponer al scope global
window.ProfileModule = ProfileModule;
