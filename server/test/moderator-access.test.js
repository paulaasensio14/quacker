import assert from "node:assert/strict";
import test from "node:test";

import {
  isModeratorUserId,
  normalizeModeratorUserIds
} from "../lib/moderator-access.js";

const alice = "u_1761000000000_a1b2c3";
const bob = "u_1761000000001_d4e5f6";

test("sin configuración no existen moderadores", () => {
  assert.deepEqual(
    normalizeModeratorUserIds(undefined),
    []
  );

  assert.equal(
    isModeratorUserId(alice, undefined),
    false
  );

  assert.equal(
    isModeratorUserId(alice, ""),
    false
  );
});

test("acepta identificadores configurados explícitamente", () => {
  assert.equal(
    isModeratorUserId(alice, alice),
    true
  );
});

test("rechaza usuarios que no aparecen en la configuración", () => {
  assert.equal(
    isModeratorUserId(bob, alice),
    false
  );
});

test("admite varios moderadores sin duplicados", () => {
  assert.deepEqual(
    normalizeModeratorUserIds(
      ` ${alice},${bob},${alice} `
    ),
    [alice, bob]
  );
});

test("rechaza identificadores de configuración malformados", () => {
  assert.deepEqual(
    normalizeModeratorUserIds(
      `${alice},usuario con espacios,,${"x".repeat(129)}`
    ),
    [alice]
  );
});

test("la comparación exige el identificador exacto", () => {
  assert.equal(
    isModeratorUserId(
      ` ${alice} `,
      alice
    ),
    false
  );

  assert.equal(
    isModeratorUserId(
      alice.toUpperCase(),
      alice
    ),
    false
  );

  assert.equal(
    isModeratorUserId(null, alice),
    false
  );
});

test("un objeto con roles manipulados no concede acceso", () => {
  assert.equal(
    isModeratorUserId(
      {
        id: bob,
        role: "admin",
        isModerator: true
      },
      alice
    ),
    false
  );
});
