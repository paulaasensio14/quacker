import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/public-profile-reports.js",
    import.meta.url
  ),
  "utf8"
);

const profileSource = fs.readFileSync(
  new URL(
    "../../assets/js/app/public-profile.js",
    import.meta.url
  ),
  "utf8"
);

const html = fs.readFileSync(
  new URL("../../public-profile.html", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL(
    "../../assets/css/public-profile.css",
    import.meta.url
  ),
  "utf8"
);

const translations = fs.readFileSync(
  new URL(
    "../../assets/js/app/i18n.js",
    import.meta.url
  ),
  "utf8"
);

class FakeElement {
  constructor() {
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.className = "";
    this.children = [];
    this.handlers = {};
    this.attributes = {};
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  addEventListener(type, handler) {
    this.handlers[type] = handler;
  }
}

function createHarness({
  authorized = true,
  error = null
} = {}) {
  const ids = [
    "publicProfileReportAction",
    "publicProfileReportModal",
    "publicProfileReportForm",
    "publicProfileReportTitle",
    "publicProfileReportReason",
    "publicProfileReportDetails",
    "publicProfileReportStatus",
    "publicProfileReportSubmit",
    "publicProfileReportReasonImpersonation",
    "publicProfileReportReasonSpoilers",
    "publicProfileReportReasonInappropriate"
  ];

  const elements = new Map(
    ids.map((id) => [id, new FakeElement()])
  );

  const calls = [];
  const modalOpens = [];

  const window = {
    I18n: {
      t(key, params) {
        return params?.title
          ? key + ":" + params.title
          : key;
      }
    },
    UIModal: {
      bind() {},
      close() {},
      open(modal, options) {
        modalOpens.push({ modal, options });
      }
    },
    QuackerReports: {
      async submit(payload) {
        calls.push(payload);
        if (error) throw error;
        return {
          ok: true,
          reportId: "report_review_1"
        };
      }
    }
  };

  const context = {
    window,
    document: {
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement() {
        return new FakeElement();
      }
    }
  };

  vm.runInNewContext(
    source,
    context,
    { filename: "public-profile-reports.js" }
  );

  const ui = window.PublicProfileReportUI;
  ui.init();

  if (authorized) {
    ui.sync(
      { state: "none", access: "full" },
      { username: "bob" }
    );
  }

  const entry = {
    source: "tmdb",
    contentType: "pelicula",
    externalId: "603",
    itemSnapshot: {
      title: "Película de prueba"
    },
    review: {
      text: "Una reseña pública",
      spoiler: false
    }
  };

  function decorate(review = entry) {
    const card = new FakeElement();
    ui.decorateReview(card, review);

    return {
      card,
      button: card.children[0] || null
    };
  }

  return {
    ui,
    entry,
    decorate,
    calls,
    modalOpens,
    element(id) {
      return elements.get(id);
    },
    submit() {
      return elements.get(
        "publicProfileReportForm"
      ).handlers.submit({
        preventDefault() {}
      });
    }
  };
}

test("la tarjeta de reseña incorpora el botón", () => {
  assert.ok(
    profileSource.includes(
      "PublicProfileReportUI?.decorateReview?."
    )
  );

  assert.ok(
    css.includes(
      ".public-profile-report-review-action:focus-visible"
    )
  );

  assert.ok(
    html.includes('id="publicProfileReportReason"')
  );

  assert.equal(
    html.includes('id="publicProfileReportReasonSpoilers"'),
    false
  );

  assert.equal(
    html.includes('id="publicProfileReportReasonImpersonation"'),
    false
  );
});

test("no aparece para visitantes sin sesión", () => {
  const h = createHarness({ authorized: false });

  assert.equal(h.decorate().button, null);
});

test("no aparece en el perfil propio", () => {
  const h = createHarness();

  h.ui.sync(
    { state: "self" },
    { username: "bob" }
  );

  assert.equal(h.decorate().button, null);
});

test("no crea un botón sin identidad de reseña", () => {
  const h = createHarness();

  assert.equal(
    h.decorate({
      ...h.entry,
      externalId: ""
    }).button,
    null
  );
});

test("muestra los motivos específicos de reseñas", () => {
  const h = createHarness();
  const { button } = h.decorate();

  assert.ok(button);

  button.handlers.click();

  assert.equal(h.modalOpens.length, 1);

  assert.equal(
    h.element("publicProfileReportTitle").textContent,
    "public_report_review_title"
  );

  const options =
    h.element("publicProfileReportReason").children;

  assert.deepEqual(
    options.map((option) => option.value),
    [
      "",
      "spam",
      "harassment",
      "hate",
      "spoilers",
      "inappropriate_content",
      "other"
    ]
  );

  assert.deepEqual(
    options.map(
      (option) => option.attributes["data-i18n"]
    ),
    [
      "public_report_select",
      "moderation_reason_spam",
      "moderation_reason_harassment",
      "moderation_reason_hate",
      "moderation_reason_spoilers",
      "moderation_reason_inappropriate_content",
      "moderation_reason_other"
    ]
  );

  assert.equal(
    button.attributes["aria-label"],
    "public_report_review_aria:Película de prueba"
  );
});

test("envía denuncia de reseña con identidad exacta", async () => {
  const h = createHarness();
  const { button } = h.decorate();

  button.handlers.click();

  h.element("publicProfileReportReason").value =
    "spoilers";

  h.element("publicProfileReportDetails").value =
    "  Contiene spoilers  ";

  assert.equal(await h.submit(), true);
  assert.equal(h.calls.length, 1);

  assert.deepEqual(
    JSON.parse(JSON.stringify(h.calls[0])),
    {
      username: "bob",
      kind: "review",
      reason: "spoilers",
      details: "Contiene spoilers",
      reviewIdentity: {
        source: "tmdb",
        contentType: "pelicula",
        externalId: "603"
      }
    }
  );

  assert.equal(button.hidden, true);

  assert.equal(
    h.element("publicProfileReportAction").hidden,
    false
  );

  assert.equal(h.decorate().button, null);
});

test("rechaza motivos exclusivos de perfiles", async () => {
  const h = createHarness();
  const { button } = h.decorate();

  button.handlers.click();

  h.element("publicProfileReportReason").value =
    "impersonation";

  assert.equal(await h.submit(), false);
  assert.equal(h.calls.length, 0);
});

test("un duplicado muestra error y mantiene el botón", async () => {
  const h = createHarness({
    error: Object.assign(
      new Error("duplicate"),
      { status: 409 }
    )
  });

  const { button } = h.decorate();
  button.handlers.click();

  h.element("publicProfileReportReason").value =
    "spam";

  assert.equal(await h.submit(), false);
  assert.equal(button.hidden, false);

  assert.equal(
    h.element("publicProfileReportStatus").textContent,
    "public_report_duplicate"
  );
});

test("el formulario vuelve a modo perfil sin motivos de reseña", () => {
  const h = createHarness();

  h.decorate().button.handlers.click();

  h.element("publicProfileReportAction").handlers.click();

  assert.deepEqual(
    h.element("publicProfileReportReason")
      .children.map((option) => option.value),
    [
      "",
      "spam",
      "harassment",
      "hate",
      "impersonation",
      "other"
    ]
  );

  assert.equal(
    h.element("publicProfileReportTitle").textContent,
    "public_report_title"
  );
});

test(
  "denunciar usuario no impide denunciar una reseña diferente",
  async () => {
    const h = createHarness();

    h.element("publicProfileReportAction").handlers.click();

    h.element("publicProfileReportReason").value = "spam";

    assert.equal(await h.submit(), true);

    assert.equal(
      h.element("publicProfileReportAction").hidden,
      true
    );

    const { button } = h.decorate();
    assert.ok(button);

    button.handlers.click();

    h.element("publicProfileReportReason").value =
      "spoilers";

    assert.equal(await h.submit(), true);

    assert.deepEqual(
      h.calls.map((call) => call.kind),
      ["user", "review"]
    );

    assert.equal(button.hidden, true);
  }
);

test(
  "alternar tipos reconstruye el selector sin duplicados",
  () => {
    const h = createHarness();
    const { button } = h.decorate();

    button.handlers.click();
    button.handlers.click();

    const reviewReasons =
      h.element("publicProfileReportReason").children;

    assert.equal(reviewReasons.length, 7);
    assert.equal(
      reviewReasons.some(
        (option) => option.value === "impersonation"
      ),
      false
    );

    h.element("publicProfileReportAction").handlers.click();

    const userReasons =
      h.element("publicProfileReportReason").children;

    assert.equal(userReasons.length, 6);
    assert.equal(
      userReasons.some(
        (option) => option.value === "spoilers"
      ),
      false
    );
  }
);

test("traducciones españolas e inglesas completas", () => {
  assert.ok(
    translations.includes(
      'public_report_review_button: "Denunciar reseña"'
    )
  );

  assert.ok(
    translations.includes(
      'public_report_review_button: "Report review"'
    )
  );

  assert.ok(
    translations.includes(
      'public_report_review_aria: "Denunciar reseña de {title}"'
    )
  );
});
