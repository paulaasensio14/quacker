import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const helper = source.indexOf(
  "  let listCollaborationConfirmBusy = false;"
);

const firstHandler = source.indexOf(
  "  async function removeActiveListMember(button)"
);

const end = source.indexOf(
  "  function _renderActiveListDetailHeader(",
  firstHandler
);

assert.ok(firstHandler >= 0);
assert.ok(end > firstHandler);

const handlers = source.slice(
  helper >= 0 ? helper : firstHandler,
  end
);

function fixture({
  mode = "remove",
  answer = true,
  supported = true,
  fail = false
} = {}) {
  let list = {
    id: "lista-a",
    visibility: "collab",
    ownerUserId: "owner",
    collaborators: ["member"]
  };

  const calls = [];
  const confirmations = [];
  const feedback = [];
  const toasts = [];

  let closed = 0;
  let loads = 0;

  const view = {
    active: true,
    classList: {
      contains(name) {
        return name === "is-active" && view.active;
      }
    }
  };

  const detail = { hidden: false };

  const removeButton = {
    disabled: false,
    hidden: false,
    isConnected: true,
    dataset: { memberId: "member" }
  };

  const leaveButton = {
    disabled: false,
    hidden: false,
    isConnected: true
  };

  const context = {
    console: { error() {} },

    currentUserId: mode === "remove" ? "owner" : "member",
    activeListId: "lista-a",
    activeDetailTab: "people",

    t(key) {
      return key;
    },

    _normalizeId(value) {
      return String(value || "").trim();
    },

    _activeListForCollaboration() {
      return list;
    },

    _getEl(id) {
      return {
        "view-lists": view,
        listDetail: detail,
        btnLeaveCollaborativeList: leaveButton
      }[id] || null;
    },

    _setListCollaborationFeedback(...args) {
      feedback.push(args);
    },

    async load() {
      loads++;
    },

    closeListDetail() {
      closed++;
    },

    window: {
      confirm() {
        throw new Error("native_confirm_must_not_be_used");
      },

      UIConfirm: supported ? {
        async ask(options) {
          confirmations.push(options);

          return typeof answer === "function"
            ? await answer(options)
            : answer;
        }
      } : undefined,

      toast(value) {
        toasts.push(value);
      }
    },

    ApiClient: {
      async removeListMember(listId, memberId) {
        calls.push(["remove", listId, memberId]);

        if (fail) throw new Error("network_failure");

        return { removed: true };
      },

      async leaveCollaborativeList(listId) {
        calls.push(["leave", listId]);

        if (fail) throw new Error("network_failure");

        return { left: true };
      }
    }
  };

  vm.runInNewContext(
    handlers +
    "\nglobalThis.removeMember = removeActiveListMember;" +
    "\nglobalThis.leaveList = leaveActiveCollaborativeList;",
    context
  );

  return {
    context,
    list,
    view,
    detail,
    calls,
    confirmations,
    feedback,
    toasts,
    removeButton,
    leaveButton,

    get closed() { return closed; },
    get loads() { return loads; },

    run() {
      return mode === "remove"
        ? context.removeMember(removeButton)
        : context.leaveList();
    },

    switchList() {
      list = { ...list, id: "lista-b" };
      context.activeListId = "lista-b";
    }
  };
}

function pendingDecision() {
  let release;

  const promise = new Promise(resolve => {
    release = resolve;
  });

  return { promise, release };
}

test("DS-07.5.2 listas: aceptar conserva operaciones originales", async () => {
  for (const mode of ["remove", "leave"]) {
    const f = fixture({ mode });

    await f.run();

    assert.equal(f.confirmations.length, 1);

    const options = f.confirmations[0];

    assert.equal(options.tone, "danger");
    assert.equal(options.cancelLabel, "common_cancel");
    assert.equal(options.closeLabel, "common_close");

    assert.equal(
      options.confirmLabel,
      "lists_collab_" + mode
    );

    assert.equal(
      options.message,
      "lists_collab_" + mode + "_confirm"
    );

    assert.deepEqual(
      f.calls,
      mode === "remove"
        ? [["remove", "lista-a", "member"]]
        : [["leave", "lista-a"]]
    );

    assert.equal(f.loads, 1);

    assert.equal(f.removeButton.disabled, false);
    assert.equal(f.leaveButton.disabled, false);

    if (mode === "remove") {
      assert.deepEqual(
        f.feedback.at(-1),
        ["lists_collab_remove_success", false, "success"]
      );

      assert.equal(f.closed, 0);
    } else {
      assert.equal(f.closed, 1);
      assert.equal(f.toasts.length, 1);
      assert.equal(f.toasts[0].type, "success");
    }
  }
});

test("DS-07.5.2 listas: cancelar no modifica datos", async () => {
  for (const mode of ["remove", "leave"]) {
    for (const answer of [false, undefined, "true", 1]) {
      const f = fixture({ mode, answer: () => answer });

      await f.run();

      assert.equal(f.calls.length, 0);
      assert.equal(f.feedback.length, 0);
      assert.equal(f.loads, 0);
      assert.equal(f.closed, 0);
      assert.equal(f.toasts.length, 0);
    }
  }
});

test("DS-07.5.2 listas: fallo o ausencia del dialogo no autoriza", async () => {
  for (const mode of ["remove", "leave"]) {
    const missing = fixture({ mode, supported: false });

    await missing.run();

    assert.equal(missing.calls.length, 0);

    const failed = fixture({
      mode,
      answer: async () => {
        throw new Error("dialog_failed");
      }
    });

    await failed.run();
    await failed.run();

    assert.equal(failed.confirmations.length, 2);
    assert.equal(failed.calls.length, 0);
  }
});

test("DS-07.5.2 listas: contexto cambiado invalida confirmacion", async () => {
  for (const mode of ["remove", "leave"]) {
    for (const change of [
      f => f.switchList(),
      f => { f.detail.hidden = true; },
      f => { f.view.active = false; },
      f => { f.context.activeDetailTab = "content"; },
      f => { f.context.currentUserId = "other"; },
      f => { f.list.visibility = "private"; },
      f => { f.list.collaborators = []; }
    ]) {
      const decision = pendingDecision();

      const f = fixture({
        mode,
        answer: () => decision.promise
      });

      const operation = f.run();

      change(f);

      decision.release(true);

      await operation;

      assert.equal(f.calls.length, 0);
      assert.equal(f.loads, 0);
      assert.equal(f.closed, 0);
    }
  }
});

test("DS-07.5.2 listas: permisos revalidados despues de confirmar", async () => {
  for (const mode of ["remove", "leave"]) {
    const decision = pendingDecision();

    const f = fixture({
      mode,
      answer: () => decision.promise
    });

    const operation = f.run();

    f.list.ownerUserId =
      mode === "remove" ? "another-owner" : "member";

    decision.release(true);

    await operation;

    assert.equal(f.calls.length, 0);
  }
});

test("DS-07.5.2 listas: control sustituido o deshabilitado no ejecuta", async () => {
  for (const mode of ["remove", "leave"]) {
    for (const change of [
      button => { button.isConnected = false; },
      button => { button.disabled = true; },
      button => { button.hidden = true; }
    ]) {
      const decision = pendingDecision();

      const f = fixture({
        mode,
        answer: () => decision.promise
      });

      const operation = f.run();

      change(
        mode === "remove"
          ? f.removeButton
          : f.leaveButton
      );

      decision.release(true);

      await operation;

      assert.equal(f.calls.length, 0);
    }
  }
});

test("DS-07.5.2 listas: no duplica confirmaciones pendientes", async () => {
  for (const mode of ["remove", "leave"]) {
    const decision = pendingDecision();

    const f = fixture({
      mode,
      answer: () => decision.promise
    });

    const first = f.run();

    await f.run();

    assert.equal(f.confirmations.length, 1);
    assert.equal(f.calls.length, 0);

    decision.release(true);

    await first;

    assert.equal(f.calls.length, 1);
  }
});

test("DS-07.5.2 listas: error API conserva recuperacion", async () => {
  for (const mode of ["remove", "leave"]) {
    const f = fixture({ mode, fail: true });

    await f.run();

    assert.equal(f.calls.length, 1);
    assert.equal(f.loads, 0);
    assert.equal(f.closed, 0);

    assert.deepEqual(
      f.feedback.at(-1),
      ["lists_collab_action_error", true]
    );

    assert.equal(f.removeButton.disabled, false);
    assert.equal(f.leaveButton.disabled, false);
  }
});
