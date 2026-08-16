import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const profileSource = fs.readFileSync(
  new URL("../../assets/js/app/profile.js", import.meta.url),
  "utf8"
);

test("Avatar Picker abre mediante UIModal con foco inicial dentro del diálogo", () => {
  assert.match(
    profileSource,
    /function\s+openAvatarPickerModal\s*\(\)\s*\{[\s\S]*?window\.UIModal(?:\?\.)?\.?open\s*\([\s\S]*?initialFocusSelector\s*:/,
    "openAvatarPickerModal debe delegar en UIModal.open con initialFocusSelector"
  );
});

test("Avatar Picker cierra mediante UIModal para restaurar el foco", () => {
  assert.match(
    profileSource,
    /function\s+closeAvatarPickerModal\s*\(\)\s*\{[\s\S]*?window\.UIModal(?:\?\.)?\.?close\s*\(/,
    "closeAvatarPickerModal debe delegar en UIModal.close"
  );
});

test("Avatar Picker no conserva gestión manual duplicada de foco o Escape", () => {
  assert.doesNotMatch(
    profileSource,
    /lastAvatarPickerFocus/,
    "Profile no debe conservar restauración manual de foco del Avatar Picker"
  );

  assert.doesNotMatch(
    profileSource,
    /document\.addEventListener\("keydown"[\s\S]*?avatarPickerModal/,
    "Avatar Picker no debe conservar un listener manual de teclado"
  );
});
