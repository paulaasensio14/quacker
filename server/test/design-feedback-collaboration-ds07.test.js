import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function read(relative) {
  return fs.readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8"
  );
}

const source = read("assets/js/app/lists.js");
const css = read("assets/css/design-feedback.css");

function createFeedback() {
  const start = source.indexOf(
    "  function _setListCollaborationFeedback("
  );

  const end = source.indexOf(
    "  let collaborationIdentityRequestVersion",
    start
  );

  assert.ok(start >= 0 && end > start);

  const element = {
    textContent: "",
    attributes: {},

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };

  const context = {
    _getEl(id) {
      assert.equal(id, "listCollaborationFeedback");
      return element;
    }
  };

  vm.createContext(context);

  vm.runInContext(
    source.slice(start, end),
    context
  );

  return {
    element,
    update: context._setListCollaborationFeedback
  };
}

test("DS-07.2: conserva mensajes y roles originales", () => {
  const { element, update } = createFeedback();

  update("Informacion");

  assert.equal(element.textContent, "Informacion");
  assert.equal(element.attributes.role, "status");

  update("Error de conexion", true);

  assert.equal(element.textContent, "Error de conexion");
  assert.equal(element.attributes.role, "alert");
});

test("DS-07.2: exito confirmado mantiene role status", () => {
  const { element, update } = createFeedback();

  update("Invitacion enviada", false, "success");

  assert.equal(element.attributes.role, "status");

  assert.equal(
    element.attributes["data-feedback-tone"],
    "success"
  );
});

test("DS-07.2: advertencia y error conservan role alert", () => {
  const { element, update } = createFeedback();

  update("Revisa el nombre", true, "warning");

  assert.equal(element.attributes.role, "alert");

  assert.equal(
    element.attributes["data-feedback-tone"],
    "warning"
  );

  update("Error de conexion", true);

  assert.equal(element.attributes.role, "alert");

  assert.equal(
    element.attributes["data-feedback-tone"],
    "error"
  );
});

test("DS-07.2: reinicio no conserva colores anteriores", () => {
  const { element, update } = createFeedback();

  update("Invitacion enviada", false, "success");
  update();

  assert.equal(element.textContent, "");
  assert.equal(element.attributes.role, "status");

  assert.equal(
    element.attributes["data-feedback-tone"],
    "info"
  );

  update("Mensaje", false, "desconocido");

  assert.equal(
    element.attributes["data-feedback-tone"],
    "info"
  );

  update("Error", true, "success");

  assert.equal(
    element.attributes["data-feedback-tone"],
    "error"
  );
});

test("DS-07.2: operaciones reales usan variantes adecuadas", () => {
  assert.match(
    source,
    /_setListCollaborationFeedback\(\s*t\("lists_collab_invite_success"\),\s*false,\s*"success"\s*\)/
  );

  assert.match(
    source,
    /_setListCollaborationFeedback\(\s*t\("lists_collab_remove_success"\),\s*false,\s*"success"\s*\)/
  );

  assert.match(
    source,
    /_setListCollaborationFeedback\(\s*t\("lists_collab_invite_error"\),\s*true,\s*"warning"\s*\)/
  );

  for (const [role, tone] of [
    ["status", "success"],
    ["alert", "warning"]
  ]) {
    const selector =
      `.list-collaboration-feedback[role="${role}"]` +
      `[data-feedback-tone="${tone}"]`;

    const escaped = selector.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const rule = css.match(
      new RegExp(escaped + "\\s*\\{([^{}]*)\\}")
    );

    assert.ok(rule, selector);

    for (const token of ["bg", "ink", "icon"]) {
      assert.ok(
        rule[1].includes(
          `var(--q-alert-${tone}-${token})`
        )
      );
    }
  }
});
