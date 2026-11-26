import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

const legacy = fs.readFileSync(
  new URL("assets/css/dashboard.css", root),
  "utf8"
);

const controls = fs.readFileSync(
  new URL("assets/css/design-controls.css", root),
  "utf8"
);

function withoutLegacy(name, expression) {
  test(name, () => {
    assert.doesNotMatch(legacy, expression);
  });
}

withoutLegacy(
  "DS-04: Inicio sin filtro oscuro duplicado",
  /body\.dark-theme #view-home \.pill-filter-sm\s*\{/
);

withoutLegacy(
  "DS-04: Explorar sin filtro oscuro duplicado",
  /body\.dark-theme #view-explore \.pill-filter-sm\s*\{/
);

withoutLegacy(
  "DS-04: Listas sin filtro oscuro duplicado",
  /body\.dark-theme #view-lists \.pill-filter\s*\{/
);

withoutLegacy(
  "DS-04: Biblioteca sin filtros oscuros duplicados",
  /body\.dark-theme #view-library \.pill-filter\s*,/
);

withoutLegacy(
  "DS-04: accion principal sin estilo oscuro antiguo",
  /body\.dark-theme #view-lists \.empty-state-actions \.btn-primary\s*\{/
);

withoutLegacy(
  "DS-04: perfil sin boton secundario duplicado",
  /body\.dark-theme \.profile-card \.btn-secondary\s*\{/
);

withoutLegacy(
  "DS-04: selector avatar sin boton duplicado",
  /body\.dark-theme #avatarPickerModal \.q-modal__footer \.btn-secondary\s*\{/
);

withoutLegacy(
  "DS-04: estados Biblioteca sin color antiguo",
  /#view-library \.lib-status-badge\.is-in_progress\s*\{/
);

test("DS-04: colores suaves recalculados en oscuro", () => {
  assert.match(
    controls,
    /body\.dark-theme\s*\{[^}]*--q-warning-soft:/
  );
  assert.match(
    controls,
    /body\.dark-theme\s*\{[^}]*--q-success-soft:/
  );
  assert.match(
    controls,
    /body\.dark-theme\s*\{[^}]*--q-danger-soft-bg:/
  );
});

test("DS-04: boton oscuro unificado en todos los tamanos", () => {
  assert.match(
    controls,
    /body\.dark-theme \.btn-primary,\s*\.q-btn--primary/
  );
  assert.match(
    controls,
    /body\.dark-theme \.profile-card \.btn-secondary/
  );
});
