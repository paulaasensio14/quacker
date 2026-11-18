import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const css = readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

const js = readFileSync(
  new URL(
    "../../assets/js/app/whats-new.js",
    import.meta.url
  ),
  "utf8"
);

test(
  "novedades permanece en el menu sin tarjeta en Ajustes",
  () => {
    assert.match(
      html,
      /data-profile-action="whats-new"/
    );

    assert.doesNotMatch(
      html,
      /id="profileWhatsNewCard"/
    );

    assert.doesNotMatch(
      html,
      /id="profileWhatsNewBtn"/
    );
  }
);

test(
  "el modulo de novedades no depende de la tarjeta eliminada",
  () => {
    assert.doesNotMatch(
      js,
      /profileWhatsNewCard|profileWhatsNewBtn|profileCard|profileButton/
    );

    assert.match(
      js,
      /menuItem\.hidden\s*=\s*!available/
    );

    assert.match(
      js,
      /UIModal\.open/
    );
  }
);

test(
  "se eliminan los estilos exclusivos de la tarjeta antigua",
  () => {
    assert.doesNotMatch(
      css,
      /\.profile-whats-new-card\b/
    );
  }
);

test(
  "el avatar compacto permite abrir el menu en movil",
  () => {
    const mobileStart = css.indexOf(
      "@media (max-width: 640px) {"
    );

    assert.ok(mobileStart >= 0);

    const mobile = css.slice(mobileStart);

    assert.match(
      mobile,
      /\.profile-chip\s*\{[^}]*display:\s*(?:inline-flex|flex)\s*;/,
      "El avatar debe ser visible en movil"
    );

    assert.match(
      mobile,
      /\.profile-chip\s+#profileChipName\s*,\s*\.profile-chip\s*>\s*svg\s*\{[^}]*display:\s*none\s*;/,
      "El avatar movil debe ocultar texto y flecha"
    );

    assert.match(
      html,
      /id="profileChip"/
    );
  }
);
