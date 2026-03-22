// assets/js/app/profile.js

const ProfileModule = (() => {
  const $ = (sel) => document.querySelector(sel);

  let initialData = null;
  let isBound = false;
  let pendingAvatarDataUrl = null;
  let lastAvatarPickerFocus = null;

  function showErrors(errors) {
    const box = $("#profileFormErrors");
    if (!box) return;

    if (!errors || errors.length === 0) {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }

    box.style.display = "block";
    box.innerHTML = `<ul>${errors.map(e => `<li>${e}</li>`).join("")}</ul>`;
  }

  function getFormData() {
    return {
      name: $("#profileName")?.value.trim() || "",
      handle: $("#profileHandle")?.value.trim() || "",
      email: $("#profileEmail")?.value.trim() || "",
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

    if (!data.name || data.name.length < 2) {
      errors.push("El nombre debe tener al menos 2 caracteres.");
    }

    // usuario: permitir letras/números/_ y empezar por @
    const handle = normalizeHandle(data.handle);
    if (!handle || handle.length < 2) {
      errors.push("El usuario es obligatorio (por ejemplo: @tacorce).");
    } else {
      const raw = handle.slice(1);
      if (!/^[a-zA-Z0-9_]{2,20}$/.test(raw)) {
        errors.push("El usuario solo puede tener letras, números o _ (2–20 caracteres).");
      }
    }

    // email suave
    if (!data.email) {
      errors.push("El email es obligatorio.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push("El email no parece válido.");
    }

    // bio: opcional, pero si existe limitamos un poco
    if (data.bio && data.bio.length > 180) {
      errors.push("La bio es muy larga (máx. 180 caracteres).");
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

  function updateHeaderAvatars(avatarUrl) {
    const safeAvatar = String(avatarUrl || "").trim();
    const fallbackAvatar = "assets/img/avatar-default.svg";

    const chipImg = document.querySelector("#profileChip .avatar-circle img");
    if (chipImg) chipImg.src = safeAvatar || fallbackAvatar;

    const menuImg = document.querySelector("#profileMenu .profile-menu-avatar img");
    if (menuImg) menuImg.src = safeAvatar || fallbackAvatar;

    const homeBannerImg = document.getElementById("homeBannerAvatar");
    if (homeBannerImg) homeBannerImg.src = safeAvatar || fallbackAvatar;
  }

  function updateHeaderUI(user) {
    // chip arriba derecha
    const chipName = $("#profileChipName");
    if (chipName) chipName.textContent = user?.name || "Sin nombre";

    // saludo home
    const welcomeName = $("#welcomeName");
    if (welcomeName) welcomeName.textContent = user?.name || "Quacker";

    // dropdown perfil
    const menuName = $("#profileMenuName");
    const menuHandle = $("#profileMenuHandle");
    if (menuName) menuName.textContent = user?.name || "Sin nombre";
    if (menuHandle) menuHandle.textContent = user?.handle || "@quacker";

    updateHeaderAvatars(user?.avatar);
  }

  function setAvatarPreview(dataUrl) {
    const img = $("#profileAvatarImg");
    if (!img) return;

    const safeAvatar = String(dataUrl || "").trim();
    const fallbackAvatar = "assets/img/avatar-default.svg";

    img.src = safeAvatar || fallbackAvatar;
  }

  // ===== Avatares predefinidos =====
  const PRESET_AVATARS = [
    { id: "av1", name: "Avatar 1", src: "assets/img/avatars/avatar-1.png" },
    { id: "av2", name: "Avatar 2", src: "assets/img/avatars/avatar-2.png" },
    { id: "av3", name: "Avatar 3", src: "assets/img/avatars/avatar-3.png" },
    { id: "av4", name: "Avatar 4", src: "assets/img/avatars/avatar-4.png" },
    { id: "av5", name: "Avatar 5", src: "assets/img/avatars/avatar-5.png" },
    { id: "av6", name: "Avatar 6", src: "assets/img/avatars/avatar-6.png" },
  ];

  function openAvatarPickerModal() {
    const modal = document.getElementById("avatarPickerModal");
    if (!modal) return;

    lastAvatarPickerFocus = document.activeElement || null;

    renderAvatarGrid();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeAvatarPickerModal() {
    const modal = document.getElementById("avatarPickerModal");
    if (!modal) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    if (lastAvatarPickerFocus && typeof lastAvatarPickerFocus.focus === "function") {
      requestAnimationFrame(() => {
        lastAvatarPickerFocus.focus();
      });
    }
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
          showErrors(["La imagen es demasiado grande (máx. 1.5MB)."]);
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

    // ESC para cerrar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal?.classList.contains("is-open")) {
        closeAvatarPickerModal();
      }
    });
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
        saveBtn.textContent = "Guardando...";
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
          title: "Perfil guardado",
          type: "success",
          duration: 2200
        });
      } catch (err) {
        console.error(err);
        showErrors(["No se pudo guardar el perfil. Inténtalo de nuevo."]);
      } finally {
        if (saveBtn) {
          saveBtn.textContent = "Guardar cambios";
          updateSaveButtonState();
        }
      }
    });
  }

  function bindRestoreDemo() {
    const btn = $("#resetProfileBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const demo = {
        name: "Arnau",
        handle: "@arnauduck",
        email: "arnau@example.com",
        language: "es",
        bio: "Amante de las series largas, pelis de ciencia ficción y JRPGs eternos.",
      };

      try {
        await ApiClient.updateUser(demo);
        await loadProfileIntoForm();
        window.toast?.({
          title: "Perfil restaurado",
          type: "success",
          duration: 2200
        });
      } catch (err) {
        console.error(err);
        showErrors(["No se pudo restaurar el perfil."]);
      }
    });
  }

  async function init() {
    // Bind de listeners solo una vez (evita duplicados si app-core refresca perfil)
    if (!isBound) {
      bindAvatar();
      bindAvatarPicker();
      bindDirtyTracking();
      bindForm();
      bindRestoreDemo();
      isBound = true;
    }

    // Cargar datos siempre que se active / cambie el usuario
    await loadProfileIntoForm();
  }

  async function load() {
    await loadProfileIntoForm();
  }

  return { init, load };
})();

// Exponer al scope global
window.ProfileModule = ProfileModule;
