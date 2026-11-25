import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cssUrl = new URL(
  "../../assets/css/design-components.css",
  import.meta.url
);

const source = fs.readFileSync(
  cssUrl,
  "utf8"
);

function rule(selector) {
  const escaped = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const regex = new RegExp(
    "(?:^|\\n)\\s*" +
    escaped +
    "\\s*\\{([^{}]*)\\}",
    "m"
  );

  return source.match(regex)?.[1] || "";
}

function has(selector, property, value) {
  const block = rule(selector);

  const escaped = value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  assert.match(
    block,
    new RegExp(
      property + "\\s*:\\s*" + escaped + "\\s*;"
    ),
    selector + " debe usar " + property + ": " + value
  );
}

test(
  "DS-01: banner amarillo de marca y borde sutil",
  () => {
    has(".welcome-banner", "background",
      "var(--q-brand)");
    has(".welcome-banner", "border",
      "1px solid var(--q-border)");
    has("body.dark-theme .welcome-banner", "background",
      "var(--q-brand)");
  }
);

test(
  "DS-01: insignias y avatar sin bordes negros",
  () => {
    has(".welcome-badge", "border",
      "1px solid var(--q-border)");
    has(".welcome-chip", "background",
      "var(--q-surface)");
    has(".welcome-duck", "border",
      "1px solid var(--q-border)");
    has("#homeBannerAvatar", "box-shadow", "none");
  }
);

test(
  "DS-01: grupos y tarjetas de favoritos en claro",
  () => {
    has(".profile-favorites-group", "background",
      "var(--q-surface-2)");
    has(".profile-favorites-group", "border",
      "1px solid var(--q-border)");
    has(".profile-favorite-slot", "background",
      "var(--q-surface)");
    has(".profile-favorite-slot", "border",
      "1px solid var(--q-border)");
  }
);

test(
  "DS-01: portadas y posiciones conservan identidad",
  () => {
    has(".profile-favorite-cover-frame", "background",
      "var(--q-surface-2)");
    has(".profile-favorite-slot-position", "background",
      "var(--q-brand)");
    has(".profile-favorite-slot-title", "color",
      "var(--q-text)");
    has(
      "body.dark-theme .profile-favorite-slot-position",
      "color",
      "var(--q-bg)"
    );
  }
);

test(
  "DS-01: favoritos oscuros sin superficies azules",
  () => {
    has("body.dark-theme .profile-favorites-group",
      "background", "var(--q-surface-2)");
    has("body.dark-theme .profile-favorite-slot",
      "background", "var(--q-surface)");
    has("body.dark-theme .profile-favorite-slot--empty",
      "background", "var(--q-surface)");
    has("body.dark-theme .profile-favorite-cover-frame",
      "background", "var(--q-surface-2)");
  }
);

test(
  "DS-01: acciones y selector usan tokens",
  () => {
    has(".profile-favorite-action", "background",
      "var(--q-surface)");
    has(".profile-favorite-pick", "color",
      "var(--q-text)");
    has("body.dark-theme .profile-favorite-action",
      "background", "var(--q-surface)");
    has("body.dark-theme .profile-favorite-pick",
      "background", "var(--q-surface)");
    has(".favorite-picker-search input", "border",
      "1px solid var(--q-border)");
    has("body.dark-theme .favorite-picker-result",
      "background", "var(--q-surface)");
    has("body.dark-theme .favorite-picker-result:hover",
      "background", "var(--q-surface-2)");
  }
);

test(
  "DS-01: texto del banner legible en ambos temas",
  () => {
    has(".welcome-banner", "color",
      "var(--q-text)");
    has("body.dark-theme .welcome-banner", "color",
      "var(--q-bg)");
    has(".welcome-banner .welcome-subtitle", "color",
      "var(--q-text)");
    has(
      "body.dark-theme .welcome-banner .welcome-subtitle",
      "color",
      "var(--q-bg)"
    );
  }
);
