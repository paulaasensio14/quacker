import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test(
  "el modal de Actividad queda limitado al viewport y hace scroll interno",
  () => {
    assert.match(
      css,
      /#activityModal\s+\.modal-card\s*\{[^}]*max-height\s*:[^;}]*(?:100vh|100dvh)[^;}]*;[^}]*display\s*:\s*flex\s*;[^}]*flex-direction\s*:\s*column\s*;/s
    );

    assert.match(
      css,
      /#activityModal\s+\.modal-content\s*\{[^}]*min-height\s*:\s*0\s*;[^}]*overflow-y\s*:\s*auto\s*;/s
    );
  }
);
