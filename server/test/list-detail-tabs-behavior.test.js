import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/lists.js",
    import.meta.url
  ),
  "utf8"
);

const exportMarker =
  "  return { init, load, render };";

assert.equal(
  source.split(exportMarker).length,
  2,
  "Exportación de ListsModule inesperada"
);

// Instrumentación SOLO en memoria para las pruebas.
const instrumented = source.replace(
  exportMarker,
  `  return {
    init,
    load,
    render,
    __testSetState({ lists, userId }) {
      allLists = lists;
      currentUserId = userId;
    },
    __testOpen: openListDetail,
    __testClose: closeListDetail,
    __testActivate: activateListDetailTab,
    __testActive: () => activeDetailTab
  };`
);

const sections = [
  ["content", "Content"],
  ["polls", "Polls"],
  ["people", "People"]
];

function makeList({
  id = "list-a",
  visibility = "collab",
  owner = "owner",
  collaborators = []
} = {}) {
  return {
    id,
    name: "Lista de prueba",
    description: "",
    visibility,
    ownerUserId: owner,
    collaborators,
    invitedUserIds: [],
    items: [],
    polls: []
  };
}

function makeElement(id, hidden = false) {
  const classes = new Set();
  const handlers = new Map();
  const attributes = new Map();

  return {
    id,
    hidden,
    disabled: false,
    textContent: "",
    innerHTML: "",
    value: "",
    dataset: {},
    children: [],
    tabIndex: -1,
    focused: false,
    isTab: false,

    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        if (force === undefined) {
          if (classes.has(name)) {
            classes.delete(name);
          } else {
            classes.add(name);
          }
        } else if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }

        return classes.has(name);
      }
    },

    setAttribute(name, value) {
      attributes.set(name, String(value));
    },

    getAttribute(name) {
      return attributes.get(name) ?? null;
    },

    removeAttribute(name) {
      attributes.delete(name);
    },

    addEventListener(type, callback) {
      if (!handlers.has(type)) {
        handlers.set(type, []);
      }
      handlers.get(type).push(callback);
    },

    fire(type, event) {
      for (const handler of handlers.get(type) || []) {
        handler(event);
      }
    },

    appendChild(child) {
      this.children.push(child);
    },

    replaceChildren(...children) {
      this.children = children;
    },

    contains(child) {
      return (
        this === child ||
        this.children.includes(child)
      );
    },

    closest(selector) {
      if (
        this.isTab &&
        selector ===
          '[role="tab"][data-list-detail-tab]'
      ) {
        return this;
      }

      return null;
    },

    querySelectorAll() {
      return [];
    },

    focus() {
      this.focused = true;
    }
  };
}

function createHarness({
  lists = [makeList()],
  userId = "owner"
} = {}) {
  const ids = [
    "listDetail",
    "listsGrid",
    "listDetailTabs",
    "listDetailTabContent",
    "listDetailTabPolls",
    "listDetailTabPeople",
    "listDetailPaneContent",
    "listDetailPanePolls",
    "listDetailPanePeople",
    "listCollaborationPanel",
    "listCollaborationOwner",
    "btnLeaveCollaborativeList",
    "listMembersList",
    "listDetailPolls",
    "listDetailPollsList"
  ];

  const elements = Object.fromEntries(
    ids.map(id => [id, makeElement(id)])
  );

  elements.listDetail.hidden = true;
  elements.listDetailTabs.hidden = true;
  elements.listDetailPanePolls.hidden = true;
  elements.listDetailPanePeople.hidden = true;
  elements.listCollaborationPanel.hidden = true;
  elements.listCollaborationOwner.hidden = true;
  elements.btnLeaveCollaborativeList.hidden = true;

  const buttons = {};

  for (const [value, suffix] of sections) {
    const button =
      elements[`listDetailTab${suffix}`];

    button.isTab = true;
    button.dataset.listDetailTab = value;
    buttons[value] = button;
  }

  const tablist = elements.listDetailTabs;

  tablist.children = sections.map(
    ([value]) => buttons[value]
  );

  tablist.querySelectorAll = selector => {
    return selector ===
      '[role="tab"][data-list-detail-tab]'
        ? tablist.children
        : [];
  };

  const document = {
    getElementById(id) {
      return elements[id] || null;
    },

    createElement(tag) {
      return makeElement(`mock-${tag}`);
    },

    querySelector() {
      return null;
    },

    querySelectorAll() {
      return [];
    },

    addEventListener() {},

    dispatchEvent() {}
  };

  const window = {
    I18n: {
      t(key) {
        return key;
      }
    }
  };

  const ApiClient = {
    getTransportInfo() {
      return { transport: "local" };
    },

    getListMembers() {
      throw new Error(
        "No debe consultar la API en estas pruebas"
      );
    }
  };

  vm.runInNewContext(
    instrumented,
    {
      window,
      document,
      ApiClient,
      console,
      setTimeout,
      clearTimeout,
      requestAnimationFrame(callback) {
        callback();
      }
    },
    {
      filename: "lists.js",
      timeout: 3000
    }
  );

  const module = window.ListsModule;

  assert.ok(module);

  module.__testSetState({ lists, userId });
  module.init();

  function click(value) {
    const button = buttons[value];

    assert.ok(button, `Pestaña inexistente: ${value}`);

    tablist.fire("click", {
      target: button
    });
  }

  function key(value, keyName) {
    let prevented = false;

    tablist.fire("keydown", {
      target: buttons[value],
      key: keyName,
      preventDefault() {
        prevented = true;
      }
    });

    return prevented;
  }

  function expectSelected(value) {
    assert.equal(
      module.__testActive(),
      value
    );

    for (const [name, suffix] of sections) {
      const button = buttons[name];
      const pane =
        elements[`listDetailPane${suffix}`];

      const selected = name === value;

      assert.equal(
        button.getAttribute("aria-selected"),
        selected ? "true" : "false",
        `Estado ARIA de ${name}`
      );

      assert.equal(
        pane.hidden,
        !selected,
        `Visibilidad de ${name}`
      );

      assert.equal(
        button.tabIndex,
        selected ? 0 : -1,
        `Orden de teclado de ${name}`
      );

      assert.equal(
        button.classList.contains("is-active"),
        selected,
        `Estilo activo de ${name}`
      );
    }
  }

  return {
    module,
    elements,
    buttons,
    click,
    key,
    expectSelected
  };
}

test(
  "QK-184-UI-BEH: abre colaborativa en Contenido",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");

    assert.equal(h.elements.listDetail.hidden, false);
    assert.equal(h.elements.listDetailTabs.hidden, false);
    assert.equal(
      h.elements.listCollaborationPanel.hidden,
      false
    );

    h.expectSelected("content");
  }
);

test(
  "QK-184-UI-BEH: clic Personas oculta otras secciones",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");
    h.click("people");

    h.expectSelected("people");
  }
);

test(
  "QK-184-UI-BEH: clic Votaciones cambia solo panel",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");
    h.click("polls");

    h.expectSelected("polls");

    assert.equal(
      h.elements.listDetailPolls.hidden,
      false
    );
  }
);

test(
  "QK-184-UI-BEH: flechas navegan entre pestanas",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");

    assert.equal(
      h.key("content", "ArrowRight"),
      true
    );

    h.expectSelected("polls");
    assert.equal(h.buttons.polls.focused, true);

    assert.equal(
      h.key("polls", "ArrowLeft"),
      true
    );

    h.expectSelected("content");

    assert.equal(
      h.key("content", "ArrowLeft"),
      true
    );

    h.expectSelected("people");
  }
);

test(
  "QK-184-UI-BEH: Inicio y Fin funcionan",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");

    assert.equal(h.key("content", "End"), true);

    h.expectSelected("people");

    assert.equal(
      h.buttons.people.focused,
      true
    );

    assert.equal(h.key("people", "Home"), true);

    h.expectSelected("content");
  }
);

test(
  "QK-184-UI-BEH: recarga misma lista conserva pestana",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");
    h.click("polls");

    await h.module.__testOpen("list-a");

    h.expectSelected("polls");
  }
);

test(
  "QK-184-UI-BEH: otra lista restablece Contenido",
  async () => {
    const h = createHarness({
      lists: [
        makeList({ id: "list-a" }),
        makeList({ id: "list-b" })
      ]
    });

    await h.module.__testOpen("list-a");

    h.click("people");
    h.expectSelected("people");

    await h.module.__testOpen("list-b");

    h.expectSelected("content");
  }
);

test(
  "QK-184-UI-BEH: cerrar y reabrir restablece",
  async () => {
    const h = createHarness();

    await h.module.__testOpen("list-a");
    h.click("people");

    h.module.__testClose();

    assert.equal(h.elements.listDetail.hidden, true);
    assert.equal(h.elements.listDetailTabs.hidden, true);

    await h.module.__testOpen("list-a");

    h.expectSelected("content");
  }
);

test(
  "QK-184-UI-BEH: privada no presenta pestanas",
  async () => {
    const h = createHarness({
      lists: [
        makeList({ visibility: "private" })
      ]
    });

    await h.module.__testOpen("list-a");

    assert.equal(h.elements.listDetailTabs.hidden, true);
    assert.equal(
      h.elements.listCollaborationPanel.hidden,
      true
    );

    h.expectSelected("content");

    h.module.__testActivate("people");

    h.expectSelected("content");
  }
);

test(
  "QK-184-UI-BEH: publica conserva Contenido",
  async () => {
    const h = createHarness({
      lists: [
        makeList({ visibility: "public" })
      ]
    });

    await h.module.__testOpen("list-a");

    assert.equal(h.elements.listDetailTabs.hidden, true);
    assert.equal(h.elements.listDetailPaneContent.hidden, false);

    h.expectSelected("content");
  }
);

test(
  "QK-184-UI-BEH: colaborador no ve gestion de propietario",
  async () => {
    const h = createHarness({
      userId: "member",
      lists: [
        makeList({
          collaborators: ["member"]
        })
      ]
    });

    await h.module.__testOpen("list-a");

    assert.equal(
      h.elements.listCollaborationOwner.hidden,
      true
    );

    assert.equal(
      h.elements.btnLeaveCollaborativeList.hidden,
      false
    );

    h.click("people");

    h.expectSelected("people");
  }
);

test(
  "QK-184-UI-BEH: navegar no modifica listas",
  async () => {
    const list = makeList({
      collaborators: ["member"]
    });

    const original = JSON.stringify(list);

    const h = createHarness({
      lists: [list]
    });

    await h.module.__testOpen("list-a");

    h.click("people");
    h.click("polls");
    h.click("content");

    h.expectSelected("content");

    assert.equal(
      JSON.stringify(list),
      original,
      "Navegar no debe alterar datos"
    );
  }
);
