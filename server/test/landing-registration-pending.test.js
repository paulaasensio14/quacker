import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/landing/main-landing.js",
    import.meta.url
  ),
  "utf8"
);

function extractHelper() {
  const start = source.indexOf(
    "    function applyPendingRegistrationResult("
  );

  const end = source.indexOf(
    "\n    function closeAuth(",
    start
  );

  assert.ok(start >= 0);
  assert.ok(end > start);

  return source.slice(start, end);
}

function executeHelper(registration) {
  const calls = [];
  const attributes = {};

  const context = {
    registration,
    email: "qa@example.test",

    passwordInput: { value: "secret" },
    nameInput: { value: "QA" },

    emailInput: {
      value: "",
      focus() {
        calls.push("focus");
      }
    },

    subtitleEl: {
      setAttribute(name, value) {
        attributes[name] = value;
      }
    },

    setMode(mode) {
      calls.push(`mode:${mode}`);
    },

    setSubmitLoading(loading) {
      calls.push(`loading:${loading}`);
    },

    updateSubmitEnabled() {
      calls.push("update");
    }
  };

  vm.runInNewContext(
    `
    let registrationPendingNotice = false;

    ${extractHelper()}

    globalThis.__result =
      applyPendingRegistrationResult(
        registration,
        email
      );

    globalThis.__pending =
      registrationPendingNotice;
    `,
    context
  );

  return {
    result: context.__result,
    pending: context.__pending,
    email: context.emailInput.value,
    password: context.passwordInput.value,
    name: context.nameInput.value,
    calls,
    attributes
  };
}

test("registro pendiente muestra acceso sin contraseña", () => {
  const result = executeHelper({
    ok: true,
    verificationRequired: true
  });

  assert.equal(result.result, true);
  assert.equal(result.pending, true);

  assert.equal(
    result.email,
    "qa@example.test"
  );

  assert.equal(result.password, "");
  assert.equal(result.name, "");

  assert.deepEqual(result.calls, [
    "mode:login",
    "loading:false",
    "update",
    "focus"
  ]);

  assert.equal(
    result.attributes.role,
    "status"
  );

  assert.equal(
    result.attributes["aria-live"],
    "polite"
  );
});

test("una respuesta no pendiente no activa el aviso", () => {
  for (const registration of [
    null,
    {},
    { ok: true },
    { ok: false, verificationRequired: true }
  ]) {
    const result = executeHelper(registration);

    assert.equal(result.result, false);
    assert.equal(result.pending, false);
    assert.equal(result.password, "secret");
    assert.equal(result.name, "QA");
    assert.equal(result.email, "");
    assert.deepEqual(result.calls, []);
  }
});

test("el aviso tiene traducciones en español e inglés", () => {
  const start = source.indexOf(
    "    const translations = {"
  );

  const end = source.indexOf(
    "\n    let currentLang = 'en';",
    start
  );

  assert.ok(start >= 0 && end > start);

  const expression = source
    .slice(start, end)
    .trim()
    .replace(/^const translations = /, "")
    .replace(/;\s*$/, "");

  const translations = vm.runInNewContext(
    `(${expression})`
  );

  for (const language of ["es", "en"]) {
    const dict = translations[language];

    assert.ok(
      dict.auth_registration_pending_title
    );

    assert.ok(
      dict.auth_registration_pending_message
    );

    assert.ok(
      dict.error_verification_pending
    );

    assert.ok(
      dict.error_verification_unavailable
    );
  }

  assert.equal(
    translations.es.auth_registration_pending_title,
    "Revisa tu correo"
  );

  assert.equal(
    translations.en.auth_registration_pending_title,
    "Check your email"
  );
});

test("el registro pendiente sale antes de comprobar la sesión", () => {
  const start = source.indexOf(
    "        if (submitMode === 'login') {"
  );

  const end = source.indexOf(
    "\n        let session = null;",
    start
  );

  assert.ok(start >= 0 && end > start);

  const block = source.slice(start, end);

  assert.match(
    block,
    /applyPendingRegistrationResult/
  );

  assert.match(
    block,
    /if\s*\([\s\S]*?applyPendingRegistrationResult[\s\S]*?\)\s*\{\s*return;/
  );

  assert.match(
    block,
    /invalid_registration_response/
  );

  assert.ok(
    block.indexOf("applyPendingRegistrationResult") <
    block.indexOf("sessionStorage.setItem")
  );

  assert.match(
    source,
    /capturePasswordResetTokenFromHash/
  );

  assert.match(
    source,
    /ApiClient\.confirmPasswordReset/
  );
});
