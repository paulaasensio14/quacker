(function () {
  let currentState = null;
  let initialized = false;

  function getElements() {
    return {
      modal: document.getElementById("whatsNewModal"),
      menuItem: document.querySelector(
        '.profile-menu-item[data-profile-action="whats-new"]'
      ),
      profileCard: document.getElementById("profileWhatsNewCard"),
      profileButton: document.getElementById("profileWhatsNewBtn"),
      version: document.getElementById("whatsNewVersion"),
      releaseTitle: document.getElementById("whatsNewReleaseTitle"),
      items: document.getElementById("whatsNewItems")
    };
  }

  function render(state) {
    const {
      menuItem,
      profileCard,
      version,
      releaseTitle,
      items
    } = getElements();

    const available =
      state?.available === true &&
      !!state?.release;

    if (menuItem) {
      menuItem.hidden = !available;
    }

    if (profileCard) {
      profileCard.hidden = !available;
    }

    if (!available) return false;

    if (version) {
      version.textContent =
        state.currentVersion
          ? `v${state.currentVersion}`
          : "";
    }

    if (releaseTitle) {
      releaseTitle.textContent =
        String(state.release.title || "");
    }

    if (items) {
      items.replaceChildren();

      for (const text of state.release.items || []) {
        const item = document.createElement("li");
        item.textContent = String(text || "");
        items.appendChild(item);
      }
    }

    return true;
  }

  function showState(state) {
    const { modal } = getElements();

    if (!modal || !render(state)) {
      return false;
    }

    UIModal.open(modal, {
      initialFocusSelector:
        "#closeWhatsNewModalFooter"
    });

    return true;
  }

  async function init() {
    if (initialized) return;

    initialized = true;

    UIModal.bind("whatsNewModal", {
      closeSelectors: [
        "#closeWhatsNewModal",
        "#closeWhatsNewModalFooter"
      ],
      initialFocusSelector:
        "#closeWhatsNewModalFooter",
      closeOnBackdrop: true
    });

    const {
      menuItem,
      profileCard,
      profileButton
    } = getElements();

    if (menuItem) {
      menuItem.hidden = true;
    }

    if (profileCard) {
      profileCard.hidden = true;
    }

    if (profileButton) {
      profileButton.addEventListener("click", () => {
        open();
      });
    }

    try {
      const state =
        await ApiClient.getWhatsNewUIState();

      currentState = state;

      const available =
        state?.available === true &&
        !!state?.release;

      if (menuItem) {
        menuItem.hidden = !available;
      }

      if (profileCard) {
        profileCard.hidden = !available;
      }

      if (!available) return;

      render(state);

      if (state?.unseen) {
        const { modal } = getElements();

        if (!modal) return;

        UIModal.open(modal, {
          initialFocusSelector:
            "#closeWhatsNewModalFooter"
        });

        try {
          const updatedState =
            await ApiClient.markWhatsNewSeen();

          currentState = {
            ...state,
            ...updatedState,
            unseen: false
          };
        } catch (error) {
          console.error(
            "WhatsNewModule mark seen error",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "WhatsNewModule init error",
        error
      );

      if (menuItem) {
        menuItem.hidden = true;
      }

      if (profileCard) {
        profileCard.hidden = true;
      }
    }
  }

  async function open() {
    try {
      const state =
        await ApiClient.getWhatsNewUIState();

      currentState = state;

      const {
        menuItem,
        profileCard
      } = getElements();

      const available =
        state?.available === true &&
        !!state?.release;

      if (menuItem) {
        menuItem.hidden = !available;
      }

      if (profileCard) {
        profileCard.hidden = !available;
      }

      if (available) {
        showState(state);
      }
    } catch (error) {
      console.error(
        "WhatsNewModule open error",
        error
      );
    }
  }

  window.WhatsNewModule = {
    init,
    open
  };
})();
