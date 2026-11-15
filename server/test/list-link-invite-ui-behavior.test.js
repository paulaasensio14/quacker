import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const originalExport =
  "  return { init, load, render };";

assert.equal(
  source.split(originalExport).length,
  2,
  "Exportacion original de ListsModule inesperada"
);

// La instrumentacion existe SOLO en memoria
// durante estas pruebas. No altera lists.js.
const instrumented = source.replace(
  originalExport,
  `  return {
    init,
    load,
    render,
    __testSetState({ lists, userId, listId }) {
      allLists = lists;
      currentUserId = userId;
      activeListId = listId;
    },
    __testGenerate: createActiveListLinkInvite,
    __testCopy: copyActiveListLinkInvite,
    __testRevoke: revokeActiveListLinkInvite,
    __testReset: resetListLinkInviteUI,
    __testRender: renderListCollaboration
  };`
);

const validUrl =
  "https://quacker.es/#list-invite=" +
  "A".repeat(43);

function createList({
  id = "list-A",
  owner = "owner",
  visibility = "collab",
  collaborators = []
} = {}) {
  return {
    id,
    ownerUserId: owner,
    visibility,
    collaborators,
    invitedUserIds: []
  };
}

function createElement() {
  return {
    hidden: false,
    disabled: false,
    textContent: "",
    value: "",
    children: [],
    dataset: {},
    attributes: {},
    focused: false,
    selected: false,
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    appendChild(child) {
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
    },
    focus() {
      this.focused = true;
    },
    select() {
      this.selected = true;
    }
  };
}

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return {
    promise,
    resolve,
    reject
  };
}

function createHarness({
  list = createList(),
  userId = "owner",
  generate,
  revoke,
  writeClipboard
} = {}) {
  const calls = [];
  const copied = [];

  const ids = [
    "listDetail",
    "listsGrid",
    "listCollaborationPanel",
    "listCollaborationOwner",
    "listMembersList",
    "listCollaborationFeedback",
    "listLinkInviteResult",
    "listLinkInviteUrl",
    "listLinkInviteFeedback",
    "btnCreateListLinkInvite",
    "btnCopyListLinkInvite",
    "btnRevokeListLinkInvite"
  ];

  const elements = Object.fromEntries(
    ids.map(id => [id, createElement()])
  );

  elements.listLinkInviteResult.hidden = true;

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },
    createElement() {
      return createElement();
    }
  };

  const api = {
    createListLinkInvite(id) {
      calls.push({
        action: "generate",
        listId: id
      });

      return generate
        ? generate(id)
        : Promise.resolve({
            created: true,
            invite: { url: validUrl }
          });
    },
    revokeListLinkInvite(id) {
      calls.push({
        action: "revoke",
        listId: id
      });

      return revoke
        ? revoke(id)
        : Promise.resolve({
            revoked: true
          });
    },
    getTransportInfo() {
      return { transport: "local" };
    }
  };

  const navigator = {
    clipboard: {
      writeText(url) {
        copied.push(url);

        return writeClipboard
          ? writeClipboard(url)
          : Promise.resolve();
      }
    }
  };

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    }
  };

  vm.runInNewContext(
    instrumented,
    {
      window,
      document,
      navigator,
      ApiClient: api,
      console,
      setTimeout,
      clearTimeout
    },
    {
      filename: "lists.js",
      timeout: 3000
    }
  );

  const module = window.ListsModule;

  assert.ok(module);

  function setState({
    nextList = list,
    nextUserId = userId
  } = {}) {
    module.__testSetState({
      lists: [nextList],
      userId: nextUserId,
      listId: nextList.id
    });
  }

  setState();
  module.__testReset();

  return {
    module,
    list,
    calls,
    copied,
    elements,
    setState
  };
}

test(
  "QK-184-SEC-06 BEHAVIOR: propietario genera enlace",
  async () => {
    const h = createHarness();

    await h.module.__testGenerate();

    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].action, "generate");
    assert.equal(h.calls[0].listId, "list-A");

    assert.equal(
      h.elements.listLinkInviteUrl.value,
      validUrl
    );

    assert.equal(
      h.elements.listLinkInviteResult.hidden,
      false
    );

    assert.equal(
      h.elements.btnCopyListLinkInvite.disabled,
      false
    );

    assert.equal(
      h.elements.btnRevokeListLinkInvite.disabled,
      false
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      "lists_collab_link_created"
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: colaborador no genera enlace",
  async () => {
    const list = createList({
      collaborators: ["member"]
    });

    const h = createHarness({
      list,
      userId: "member"
    });

    h.module.__testRender(list, {
      owner: {
        userId: "owner",
        username: "owner"
      },
      collaborators: [{
        userId: "member",
        username: "member"
      }]
    });

    assert.equal(
      h.elements.listCollaborationPanel.hidden,
      false
    );

    assert.equal(
      h.elements.listCollaborationOwner.hidden,
      true
    );

    await h.module.__testGenerate();

    assert.equal(h.calls.length, 0);
    assert.equal(
      h.elements.listLinkInviteResult.hidden,
      true
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: lista privada no genera enlace",
  async () => {
    const list = createList({
      visibility: "private"
    });

    const h = createHarness({ list });

    h.module.__testRender(list, {
      owner: {
        userId: "owner",
        username: "owner"
      }
    });

    assert.equal(
      h.elements.listCollaborationPanel.hidden,
      true
    );

    await h.module.__testGenerate();

    assert.equal(h.calls.length, 0);
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: rechaza URLs no validas",
  async () => {
    const invalidUrls = [
      "https://example.com/#list-invite=" +
        "A".repeat(43),
      "https://quacker.es/#list-invite=short",
      "https://quacker.es/?list-invite=" +
        "A".repeat(43)
    ];

    for (const url of invalidUrls) {
      const h = createHarness({
        generate: async () => ({
          created: true,
          invite: { url }
        })
      });

      await h.module.__testGenerate();

      assert.equal(
        h.elements.listLinkInviteResult.hidden,
        true
      );

      assert.equal(
        h.elements.listLinkInviteUrl.value,
        ""
      );

      assert.equal(
        h.elements.listLinkInviteFeedback.textContent,
        "lists_collab_link_error"
      );
    }
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: copia enlace exacto",
  async () => {
    const h = createHarness();

    await h.module.__testGenerate();
    await h.module.__testCopy();

    assert.deepEqual(h.copied, [validUrl]);

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      "lists_collab_link_copied"
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: fallo de portapapeles",
  async () => {
    const h = createHarness({
      writeClipboard: async () => {
        throw new Error("clipboard_denied");
      }
    });

    await h.module.__testGenerate();
    await h.module.__testCopy();

    assert.equal(
      h.elements.listLinkInviteUrl.focused,
      true
    );

    assert.equal(
      h.elements.listLinkInviteUrl.selected,
      true
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      "lists_collab_link_copy_error"
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.attributes.role,
      "alert"
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: revoca y borra enlace",
  async () => {
    const h = createHarness();

    await h.module.__testGenerate();
    await h.module.__testRevoke();

    assert.deepEqual(
      h.calls.map(call => call.action),
      ["generate", "revoke"]
    );

    assert.equal(
      h.elements.listLinkInviteResult.hidden,
      true
    );

    assert.equal(
      h.elements.listLinkInviteUrl.value,
      ""
    );

    assert.equal(
      h.elements.btnCopyListLinkInvite.disabled,
      true
    );

    assert.equal(
      h.elements.btnRevokeListLinkInvite.disabled,
      true
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      "lists_collab_link_revoked"
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: fallo al revocar",
  async () => {
    const h = createHarness({
      revoke: async () => {
        throw new Error("network_error");
      }
    });

    await h.module.__testGenerate();
    await h.module.__testRevoke();

    assert.equal(
      h.elements.listLinkInviteUrl.value,
      validUrl
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      "lists_collab_link_error"
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.attributes.role,
      "alert"
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: ignora generacion antigua",
  async () => {
    const deferred = createDeferred();

    const h = createHarness({
      generate: () => deferred.promise
    });

    const pending = h.module.__testGenerate();

    assert.equal(
      h.elements.btnCreateListLinkInvite.disabled,
      true
    );

    // Simula cambiar de lista mientras espera la API.
    h.module.__testReset();

    h.setState({
      nextList: createList({ id: "list-B" })
    });

    deferred.resolve({
      created: true,
      invite: { url: validUrl }
    });

    await pending;

    assert.equal(
      h.elements.listLinkInviteUrl.value,
      ""
    );

    assert.equal(
      h.elements.listLinkInviteResult.hidden,
      true
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      ""
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: ignora copia antigua",
  async () => {
    const deferred = createDeferred();

    const h = createHarness({
      writeClipboard: () => deferred.promise
    });

    await h.module.__testGenerate();

    const pending = h.module.__testCopy();

    h.module.__testReset();

    h.setState({
      nextList: createList({ id: "list-B" })
    });

    deferred.resolve();
    await pending;

    assert.equal(
      h.elements.listLinkInviteUrl.value,
      ""
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      ""
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: ignora revocacion antigua",
  async () => {
    const deferred = createDeferred();

    const h = createHarness({
      revoke: () => deferred.promise
    });

    await h.module.__testGenerate();

    const pending = h.module.__testRevoke();

    h.module.__testReset();

    h.setState({
      nextList: createList({ id: "list-B" })
    });

    deferred.resolve({
      revoked: true
    });

    await pending;

    assert.equal(
      h.elements.listLinkInviteResult.hidden,
      true
    );

    assert.equal(
      h.elements.listLinkInviteFeedback.textContent,
      ""
    );
  }
);

test(
  "QK-184-SEC-06 BEHAVIOR: perder propiedad limpia enlace",
  async () => {
    const list = createList({
      collaborators: ["member"]
    });

    const h = createHarness({ list });

    await h.module.__testGenerate();

    h.setState({
      nextList: list,
      nextUserId: "member"
    });

    h.module.__testRender(list, {
      owner: {
        userId: "owner",
        username: "owner"
      },
      collaborators: [{
        userId: "member",
        username: "member"
      }]
    });

    assert.equal(
      h.elements.listCollaborationOwner.hidden,
      true
    );

    assert.equal(
      h.elements.listLinkInviteUrl.value,
      ""
    );

    assert.equal(
      h.elements.listLinkInviteResult.hidden,
      true
    );

    await h.module.__testRevoke();

    assert.equal(
      h.calls.filter(
        call => call.action === "revoke"
      ).length,
      0
    );
  }
);
