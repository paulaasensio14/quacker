import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

const prefix =
  "body:not(.dark-theme) #listPollModal";

function getRule(selector) {
  const start = css.indexOf(`${selector} {`);

  assert.notEqual(
    start,
    -1,
    `Falta regla de foco: ${selector}`
  );

  const end = css.indexOf("}", start);

  assert.ok(
    end > start,
    `Regla incompleta: ${selector}`
  );

  return css.slice(start, end + 1);
}

const controls = [
  [
    "campos de texto y fecha",
    `${prefix} .modal-field input:not([type="checkbox"]):focus-visible`
  ],
  [
    "casilla de voto multiple",
    `${prefix} #lpm_multiple:focus-visible`
  ],
  [
    "opciones de votacion",
    `${prefix} .list-poll-modal-option:focus-within`
  ],
  [
    "botones de accion",
    `${prefix} .modal-actions button:focus-visible`
  ],
  [
    "boton de cierre",
    `${prefix} .modal-close:focus-visible`
  ]
];

for (const [name, selector] of controls) {
  test(
    `foco visible en modo claro: ${name}`,
    () => {
      const rule = getRule(selector);

      assert.match(
        rule,
        /outline:\s*3px solid #1d4ed8;/
      );

      assert.match(
        rule,
        /outline-offset:\s*2px;/
      );
    }
  );
}
