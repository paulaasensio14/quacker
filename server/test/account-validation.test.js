import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_VALIDATION_LIMITS,
  createInitialAccountHandle,
  normalizeAccountName,
  normalizeAccountEmail,
  validateAccountName,
  validateAccountEmail,
  validateRegistrationPassword,
  validateRegistrationAccount,
  isAccountEmailInUse
} from "../lib/account-validation.js";

test("normaliza espacios interiores y exteriores del nombre", () => {
  assert.equal(
    normalizeAccountName("  Paula   Asensio  "),
    "Paula Asensio"
  );
});

test("rechaza como vacío un nombre que no sea texto", () => {
  assert.equal(normalizeAccountName(null), "");
  assert.equal(normalizeAccountName(123), "");
});

test("normaliza el correo eliminando espacios y mayúsculas", () => {
  assert.equal(
    normalizeAccountEmail("  PAULA@Example.COM "),
    "paula@example.com"
  );
});

test("genera un alias válido a partir de puntos, signos y guiones", () => {
  assert.equal(
    createInitialAccountHandle("paula.asensio@example.com"),
    "@paula_asensio"
  );

  assert.equal(
    createInitialAccountHandle("paula+quacker@example.com"),
    "@paula_quacker"
  );

  assert.equal(
    createInitialAccountHandle("paula-4c@example.com"),
    "@paula_4c"
  );
});

test("completa alias demasiado cortos", () => {
  assert.equal(
    createInitialAccountHandle("a@example.com"),
    "@a_"
  );
});

test("limita el alias inicial a veinte caracteres", () => {
  assert.equal(
    createInitialAccountHandle(
      "abcdefghijklmnopqrstuvwxyz@example.com"
    ),
    "@abcdefghijklmnopqrst"
  );
});

test("normaliza acentos y usa un valor seguro cuando no quedan caracteres", () => {
  assert.equal(
    createInitialAccountHandle("josé@example.com"),
    "@jose"
  );

  assert.equal(
    createInitialAccountHandle("💛@example.com"),
    "@user"
  );
});

test("rechaza como vacío un correo que no sea texto", () => {
  assert.equal(normalizeAccountEmail(null), "");
  assert.equal(normalizeAccountEmail({}), "");
});

test("acepta nombres dentro de los límites permitidos", () => {
  const minimum = validateAccountName("Pa");
  const maximum = validateAccountName(
    "a".repeat(ACCOUNT_VALIDATION_LIMITS.nameMaxLength)
  );

  assert.deepEqual(minimum, {
    ok: true,
    value: "Pa"
  });

  assert.equal(maximum.ok, true);
  assert.equal(
    maximum.value.length,
    ACCOUNT_VALIDATION_LIMITS.nameMaxLength
  );
});

test("rechaza nombres demasiado cortos o demasiado largos", () => {
  assert.deepEqual(validateAccountName("P"), {
    ok: false,
    error: "invalid_name"
  });

  assert.deepEqual(
    validateAccountName(
      "a".repeat(ACCOUNT_VALIDATION_LIMITS.nameMaxLength + 1)
    ),
    {
      ok: false,
      error: "invalid_name"
    }
  );
});

test("acepta y normaliza un correo válido", () => {
  assert.deepEqual(
    validateAccountEmail(" Paula@Example.com "),
    {
      ok: true,
      value: "paula@example.com"
    }
  );
});

test("rechaza correos vacíos o con formato inválido", () => {
  for (const email of [
    "",
    "correo-invalido",
    "paula@",
    "@example.com",
    "paula @example.com",
    "paula@example"
  ]) {
    assert.deepEqual(validateAccountEmail(email), {
      ok: false,
      error: "invalid_email"
    });
  }
});

test("acepta un correo de exactamente 254 caracteres", () => {
  const email = `${"a".repeat(249)}@x.es`;

  assert.equal(email.length, 254);
  assert.equal(validateAccountEmail(email).ok, true);
});

test("rechaza un correo de más de 254 caracteres", () => {
  const email = `${"a".repeat(250)}@x.es`;

  assert.equal(email.length, 255);
  assert.deepEqual(validateAccountEmail(email), {
    ok: false,
    error: "invalid_email"
  });
});

test("acepta contraseñas entre 8 y 128 caracteres", () => {
  const minimum = "a".repeat(
    ACCOUNT_VALIDATION_LIMITS.passwordMinLength
  );

  const maximum = "a".repeat(
    ACCOUNT_VALIDATION_LIMITS.passwordMaxLength
  );

  assert.deepEqual(validateRegistrationPassword(minimum), {
    ok: true,
    value: minimum
  });

  assert.deepEqual(validateRegistrationPassword(maximum), {
    ok: true,
    value: maximum
  });
});

test("rechaza contraseñas demasiado cortas o demasiado largas", () => {
  const tooShort = "a".repeat(
    ACCOUNT_VALIDATION_LIMITS.passwordMinLength - 1
  );

  const tooLong = "a".repeat(
    ACCOUNT_VALIDATION_LIMITS.passwordMaxLength + 1
  );

  assert.deepEqual(validateRegistrationPassword(tooShort), {
    ok: false,
    error: "invalid_password"
  });

  assert.deepEqual(validateRegistrationPassword(tooLong), {
    ok: false,
    error: "invalid_password"
  });
});

test("rechaza contraseñas vacías o formadas solo por espacios", () => {
  for (const password of ["", "        ", null, 12345678]) {
    assert.deepEqual(validateRegistrationPassword(password), {
      ok: false,
      error: "invalid_password"
    });
  }
});

test("conserva los espacios iniciales y finales de la contraseña", () => {
  const password = " contraseña segura ";

  assert.deepEqual(validateRegistrationPassword(password), {
    ok: true,
    value: password
  });
});

test("valida y normaliza una cuenta completa", () => {
  const result = validateRegistrationAccount({
    name: "  Paula   Asensio ",
    email: " PAULA@Example.com ",
    password: " contraseña segura "
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      name: "Paula Asensio",
      email: "paula@example.com",
      password: " contraseña segura "
    }
  });
});

test("distingue campos ausentes de campos presentes pero inválidos", () => {
  assert.deepEqual(
    validateRegistrationAccount({
      name: "",
      email: "paula@example.com",
      password: "12345678"
    }),
    {
      ok: false,
      error: "missing_fields"
    }
  );

  assert.deepEqual(
    validateRegistrationAccount({
      name: "P",
      email: "paula@example.com",
      password: "12345678"
    }),
    {
      ok: false,
      error: "invalid_name"
    }
  );

  assert.deepEqual(
    validateRegistrationAccount({
      name: "Paula",
      email: "correo-invalido",
      password: "12345678"
    }),
    {
      ok: false,
      error: "invalid_email"
    }
  );

  assert.deepEqual(
    validateRegistrationAccount({
      name: "Paula",
      email: "paula@example.com",
      password: "1234"
    }),
    {
      ok: false,
      error: "invalid_password"
    }
  );
});

test("detecta correos usados ignorando mayúsculas y espacios", () => {
  const users = {
    u_1: {
      profile: {
        email: "paula@example.com"
      }
    }
  };

  assert.equal(
    isAccountEmailInUse(users, " PAULA@EXAMPLE.COM "),
    true
  );
});

test("permite conservar el correo de la propia cuenta", () => {
  const users = {
    u_1: {
      profile: {
        email: "paula@example.com"
      }
    },
    u_2: {
      profile: {
        email: "ana@example.com"
      }
    }
  };

  assert.equal(
    isAccountEmailInUse(
      users,
      "paula@example.com",
      { excludeUserId: "u_1" }
    ),
    false
  );

  assert.equal(
    isAccountEmailInUse(
      users,
      "ana@example.com",
      { excludeUserId: "u_1" }
    ),
    true
  );
});

test("tolera colecciones de usuarios ausentes o inválidas", () => {
  assert.equal(
    isAccountEmailInUse(null, "paula@example.com"),
    false
  );

  assert.equal(
    isAccountEmailInUse([], "paula@example.com"),
    false
  );

  assert.equal(
    isAccountEmailInUse({}, ""),
    false
  );
});
