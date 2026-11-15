/*
 * Quacker - Confirmacion de invitaciones por enlace.
 *
 * Se inicializa exclusivamente despues de comprobar
 * la sesion autenticada del dashboard.
 *
 * Nunca acepta una invitacion automaticamente.
 */

(function () {
  "use strict";

  let initialized = false;
  let modalActive = false;
  let busy = false;

  let invitationToken = "";

  let modal = null;
  let acceptButton = null;
  let declineButton = null;
  let closeButton = null;
  let feedback = null;

  function t(key) {
    const value = window.I18n?.t?.(key);

    return typeof value === "string"
      ? value
      : key;
  }

  function setFeedback(
    message = "",
    isError = false
  ) {
    if (!feedback) return;

    feedback.textContent = message;

    feedback.setAttribute(
      "role",
      isError ? "alert" : "status"
    );
  }

  function setBusy(nextBusy) {
    busy = !!nextBusy;

    if (acceptButton) {
      acceptButton.disabled = busy;

      acceptButton.textContent = busy
        ? t("lists_collab_link_accept_loading")
        : t("lists_collab_link_accept_confirm");
    }

    if (declineButton) {
      declineButton.disabled = busy;
    }

    if (closeButton) {
      closeButton.disabled = busy;
    }
  }

  function closeModal() {
    if (!modalActive) return;

    modalActive = false;

    window.UIModal.close(modal);
  }

  function discardInvitation() {
    if (!modalActive || busy) return;

    window.ListLinkInviteEntry
      ?.clearPendingToken?.();

    invitationToken = "";
    setFeedback();
    closeModal();
  }

  function isPermanentInviteError(error) {
    const code = String(
      error?.error || ""
    ).trim();

    return (
      error?.status === 404 ||
      [
        "invite_not_found",
        "invite_expired",
        "expired_invite",
        "link_invite_not_found",
        "list_not_collaborative",
        "not_found",
        "already_collaborator",
        "cannot_add_owner"
      ].includes(code)
    );
  }

  function getInviteErrorKey(error) {
    const code = String(
      error?.error || ""
    ).trim();

    if (
      code === "already_collaborator" ||
      code === "cannot_add_owner"
    ) {
      return "lists_collab_link_accept_already";
    }

    if (isPermanentInviteError(error)) {
      return "lists_collab_link_accept_invalid";
    }

    return "lists_collab_link_accept_error";
  }

  function showAcceptedList() {
    try {
      window.Router?.showView?.("lists");

      // El propio ApiClient ya emite el cambio
      // de datos. Recargamos la vista visible.
      const refresh =
        window.ListsModule?.load?.();

      refresh?.catch?.(() => {});
    } catch (_) {
      // La invitacion ya se ha aceptado.
      // No repetir la peticion por un fallo visual.
    }
  }

  async function acceptInvitation() {
    // Solo este handler puede llamar a la API.
    if (!modalActive || busy) return;

    const currentToken =
      window.ListLinkInviteEntry
        ?.getPendingToken?.();

    if (
      !invitationToken ||
      currentToken !== invitationToken
    ) {
      window.ListLinkInviteEntry
        ?.clearPendingToken?.();

      invitationToken = "";

      setFeedback(
        t("lists_collab_link_accept_invalid"),
        true
      );

      if (acceptButton) {
        acceptButton.disabled = true;
      }

      return;
    }

    const submittedToken = invitationToken;

    setFeedback();
    setBusy(true);

    try {
      const result =
        await ApiClient.acceptListLinkInvite(
          submittedToken
        );

      if (result?.accepted !== true) {
        throw new Error(
          "invite_accept_not_confirmed"
        );
      }

      if (
        window.ListLinkInviteEntry?.getPendingToken?.() ===
        submittedToken
      ) {
        window.ListLinkInviteEntry
          ?.clearPendingToken?.();
      }

      invitationToken = "";

      const successMessage =
        t("lists_collab_link_accept_success");

      setFeedback(successMessage);

      closeModal();

      // Mostrar confirmacion usando el toast existente.
      try {
        window.toast?.({
          title: t(
            "lists_collab_link_accept_title"
          ),
          message: successMessage,
          type: "success",
          duration: 4000
        });
      } catch (_) {}

      showAcceptedList();
    } catch (error) {
      const key =
        getInviteErrorKey(error);

      if (isPermanentInviteError(error)) {
        if (
          window.ListLinkInviteEntry?.getPendingToken?.() ===
          submittedToken
        ) {
          window.ListLinkInviteEntry
            ?.clearPendingToken?.();
        }

        invitationToken = "";
      }

      if (modalActive) {
        setFeedback(t(key), true);
      }
    } finally {
      setBusy(false);

      // Una nueva invitacion recibida mientras A estaba
      // procesandose debe conservarse y mostrarse.
      // init() nunca acepta automaticamente.
      const nextPendingToken =
        window.ListLinkInviteEntry
          ?.getPendingToken?.();

      if (
        nextPendingToken &&
        nextPendingToken !== submittedToken
      ) {
        init();
      }

      // Enlaces permanentemente invalidos
      // no deben poder reintentarse.
      if (
        modalActive &&
        !invitationToken &&
        acceptButton
      ) {
        acceptButton.disabled = true;
      }
    }
  }

  function handleEscape(event) {
    if (
      event.key !== "Escape" ||
      !modalActive
    ) {
      return;
    }

    if (busy) {
      // Durante el POST no permitimos cerrar
      // la ventana y dejar un estado ambiguo.
      event.preventDefault();
      event.stopImmediatePropagation?.();
      return;
    }

    discardInvitation();

    event.preventDefault();
    event.stopImmediatePropagation?.();
  }

  function openInvitation(token) {
    invitationToken = token;
    modalActive = true;

    setFeedback();
    setBusy(false);

    window.UIModal.open(
      modal,
      {
        initialFocusSelector:
          "#btnAcceptListLinkInvite"
      }
    );
  }

  function init() {
    if (busy) return;

    const entry =
      window.ListLinkInviteEntry;

    const token =
      entry?.getPendingToken?.();

    if (!token) return;

    if (initialized) {
      if (modalActive) {
        // Una invitacion nueva sustituye la anterior
        // sin volver a registrar los listeners.
        if (invitationToken !== token) {
          invitationToken = token;
          setFeedback();
          setBusy(false);
        }
      } else {
        openInvitation(token);
      }

      return;
    }

    const nextModal =
      document.getElementById(
        "listLinkInviteAcceptModal"
      );

    const nextAccept =
      document.getElementById(
        "btnAcceptListLinkInvite"
      );

    const nextDecline =
      document.getElementById(
        "btnDeclineListLinkInvite"
      );

    const nextClose =
      document.getElementById(
        "btnCloseListLinkInvite"
      );

    const nextFeedback =
      document.getElementById(
        "listLinkInviteAcceptFeedback"
      );

    if (
      !nextModal ||
      !nextAccept ||
      !nextDecline ||
      !nextClose ||
      !nextFeedback ||
      !window.UIModal ||
      typeof ApiClient.acceptListLinkInvite !== "function"
    ) {
      return;
    }

    modal = nextModal;
    acceptButton = nextAccept;
    declineButton = nextDecline;
    closeButton = nextClose;
    feedback = nextFeedback;

    // Se usa el gestor de modales de Quacker.
    // El backdrop se gestiona aqui para que
    // tambien descarte el token temporal.
    window.UIModal.bind(
      "listLinkInviteAcceptModal",
      {
        closeSelectors: [],
        closeOnBackdrop: false,
        initialFocusSelector:
          "#btnAcceptListLinkInvite"
      }
    );

    acceptButton.addEventListener(
      "click",
      () => {
        acceptInvitation().catch(() => {
          setFeedback(
            t("lists_collab_link_accept_error"),
            true
          );
          setBusy(false);
        });
      }
    );

    declineButton.addEventListener(
      "click",
      discardInvitation
    );

    closeButton.addEventListener(
      "click",
      discardInvitation
    );

    modal.addEventListener(
      "click",
      (event) => {
        if (event.target === modal) {
          discardInvitation();
        }
      }
    );

    // Captura Escape antes del listener
    // del gestor global de ventanas.
    window.addEventListener(
      "keydown",
      handleEscape,
      true
    );

    initialized = true;
    openInvitation(token);
  }

  window.ListLinkInvitePrompt =
    Object.freeze({
      init
    });
})();
