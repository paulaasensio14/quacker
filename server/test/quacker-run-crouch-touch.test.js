import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../../404.html", import.meta.url),
  "utf8"
);

const source = fs.readFileSync(
  new URL("../../assets/js/quacker-run.js", import.meta.url),
  "utf8"
);

const css = fs.readFileSync(
  new URL("../../assets/css/quacker-run.css", import.meta.url),
  "utf8"
);

test("Quacker Run ofrece un control táctil para agacharse", () => {
  assert.match(
    html,
    /id=["']quackerRunCrouch["']/,
    "debe existir un control táctil para agacharse"
  );

  assert.match(
    html,
    /data-i18n=["']quacker_run_crouch["']/,
    "el control debe ser traducible"
  );
});

test("mantener pulsado el control táctil agacha a Quacker", () => {
  assert.match(
    source,
    /quackerRunCrouch/
  );

  assert.match(
    source,
    /pointerdown[\s\S]*?setCrouching\(true\)/
  );
});

test("soltar o cancelar el control táctil levanta a Quacker", () => {
  assert.match(
    source,
    /pointerup[\s\S]*?setCrouching\(false\)/
  );

  assert.match(
    source,
    /pointercancel[\s\S]*?setCrouching\(false\)/
  );
});


test("el control táctil de crouch se muestra en pantallas móviles", () => {
  const mobileStart = css.indexOf("@media (max-width: 600px)");
  const nextMedia = css.indexOf("@media", mobileStart + 1);

  assert.notEqual(
    mobileStart,
    -1,
    "debe existir el breakpoint móvil"
  );

  const mobileCss = css.slice(
    mobileStart,
    nextMedia === -1 ? css.length : nextMedia
  );

  assert.match(
    mobileCss,
    /\.run-touch-controls\s*\{[\s\S]*?display:\s*flex/,
    "en <=600px los controles táctiles deben mostrarse aunque Safari no simule pointer: coarse"
  );
});
