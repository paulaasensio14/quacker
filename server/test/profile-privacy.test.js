import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROFILE_PRIVACY,
  normalizeProfilePrivacy
} from "../lib/profile-privacy.js";

const EXPECTED_PRIVATE_DEFAULTS = {
  profile: false,
  profileVisibility: "hidden",
  activity: false,
  library: false,
  lists: false,
  reviews: false,
  stats: false,
  favorites: false
};

test("la privacidad por defecto mantiene todo privado", () => {
  assert.deepEqual(
    DEFAULT_PROFILE_PRIVACY,
    EXPECTED_PRIVATE_DEFAULTS
  );
});

test("una cuenta antigua sin privacidad se normaliza como totalmente privada", () => {
  assert.deepEqual(
    normalizeProfilePrivacy(undefined),
    EXPECTED_PRIVATE_DEFAULTS
  );

  assert.deepEqual(
    normalizeProfilePrivacy(null),
    EXPECTED_PRIVATE_DEFAULTS
  );
});

test("solo un true booleano hace pública una sección", () => {
  assert.deepEqual(
    normalizeProfilePrivacy({
      profile: true,
      activity: false,
      library: "true",
      lists: 1,
      reviews: true,
      stats: null,
      favorites: true
    }),
    {
      profile: true,
      profileVisibility: "public",
      activity: false,
      library: false,
      lists: false,
      reviews: true,
      stats: false,
      favorites: true
    }
  );
});

test("ignora propiedades de privacidad desconocidas", () => {
  assert.deepEqual(
    normalizeProfilePrivacy({
      profile: true,
      secretStuff: true,
      admin: true
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
