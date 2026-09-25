import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProfilePrivacy
} from "../lib/profile-privacy.js";

test("la privacidad legacy pública se interpreta como public", () => {
  assert.deepEqual(
    normalizeProfilePrivacy({
      profile: true
    }),
    {
      profile: true,
      profileVisibility: "public",
      activity: false,
      library: false,
      lists: false,
      reviews: false,
      stats: false,
      favorites: false
    }
  );
});

test("la privacidad legacy privada se interpreta como hidden", () => {
  assert.deepEqual(
    normalizeProfilePrivacy({
      profile: false
    }),
    {
      profile: false,
      profileVisibility: "hidden",
      activity: false,
      library: false,
      lists: false,
      reviews: false,
      stats: false,
      favorites: false
    }
  );
});

test("profileVisibility admite los cuatro niveles y deriva profile de forma segura", () => {
  const cases = [
    ["public", true],
    ["followers", false],
    ["friends", false],
    ["hidden", false]
  ];

  for (const [profileVisibility, expectedProfile] of cases) {
    const privacy = normalizeProfilePrivacy({
      profile: true,
      profileVisibility
    });

    assert.equal(
      privacy.profileVisibility,
      profileVisibility
    );

    assert.equal(
      privacy.profile,
      expectedProfile
    );
  }
});

test("un profileVisibility inválido conserva la compatibilidad legacy", () => {
  assert.equal(
    normalizeProfilePrivacy({
      profile: true,
      profileVisibility: "desconocido"
    }).profileVisibility,
    "public"
  );

  assert.equal(
    normalizeProfilePrivacy({
      profile: false,
      profileVisibility: "desconocido"
    }).profileVisibility,
    "hidden"
  );
});
