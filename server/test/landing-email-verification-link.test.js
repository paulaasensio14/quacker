import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL(
    "../../assets/js/landing/main-landing.js",
    import.meta.url
  ),
  "utf8"
);

const captureStart = source.indexOf(
  "    function captureEmailVerificationTokenFromQuery()"
);

const captureEnd = source.indexOf(
  "\n    function capturePasswordResetTokenFromHash()",
  captureStart
);

assert.ok(captureStart >= 0);
assert.ok(captureEnd > captureStart);

const captureCode = source.slice(
  captureStart,
  captureEnd
);

function capture(search, hash = "") {
  let cleaned = null;

  const token = runInNewContext(
    captureCode +
      "\ncaptureEmailVerificationTokenFromQuery();",
    {
      URLSearchParams,
      document: { title: "Quacker" },
      window: {
        location: {
          pathname: "/",
          search,
          hash
        },
        history: {
          replaceState(_state, _title, url) {
            cleaned = url;
          }
        }
      }
    }
  );

  return { token, cleaned };
}

const initStart = source.lastIndexOf(
  "    if (passwordResetToken) {"
);

assert.ok(initStart >= 0);

const initializationCode = source
  .slice(initStart)
  .trim();

async function simulateVerification({
  token = "A".repeat(43),
  resetToken = "",
  errorCode = null
} = {}) {
  const receivedTokens = [];
  const openedModes = [];
  const selectedModes = [];

  const context = {
    passwordResetToken: resetToken,
    emailVerificationToken: token,
    emailVerificationNotice: null,

    openAuth(mode) {
      openedModes.push(mode);
    },

    setMode(mode) {
      selectedModes.push(mode);
    },

    subtitleEl: {
      setAttribute() {}
    },

    window: {
      ApiClient: {
        async confirmEmailVerification(value) {
          receivedTokens.push(value);

          if (errorCode) {
            const error = new Error(errorCode);
            error.error = errorCode;
            throw error;
          }

          return { ok: true };
        }
      }
    }
  };

  runInNewContext(
    initializationCode,
    context
  );

  // Permitir que finalice la promesa de confirmacion.
  await new Promise(resolve => setImmediate(resolve));

  return {
    receivedTokens,
    openedModes,
    selectedModes,
    notice: context.emailVerificationNotice,
    tokenRemaining: context.emailVerificationToken
  };
}

test("extrae el token de la URL", () => {
  const token = "A".repeat(43);

  const result = capture(
    `?verify_token=${token}&utm_source=email`
  );

  assert.equal(result.token, token);
  assert.equal(
    result.cleaned,
    "/?utm_source=email"
  );
});

test("sin token no modifica la URL", () => {
  const result = capture("?utm_source=web");

  assert.equal(result.token, null);
  assert.equal(result.cleaned, null);
});

test("rechaza tokens duplicados", () => {
  const result = capture(
    "?verify_token=uno&verify_token=dos"
  );

  assert.equal(result.token, "");
  assert.equal(result.cleaned, "/");
});

test("conserva otros parametros y hash", () => {
  const result = capture(
    "?verify_token=incorrecto&x=1",
    "#reset=abc"
  );

  assert.equal(
    result.cleaned,
    "/?x=1#reset=abc"
  );
});

test("una confirmacion correcta permite iniciar sesion", async () => {
  const token = "B".repeat(43);

  const result = await simulateVerification({
    token
  });

  assert.deepEqual(
    result.receivedTokens,
    [token]
  );

  assert.equal(result.notice, "success");
  assert.equal(result.tokenRemaining, null);

  assert.ok(
    result.openedModes.includes("login")
  );
});

test("un token invalido no se envia al servidor", async () => {
  const result = await simulateVerification({
    token: "invalido"
  });

  assert.equal(result.receivedTokens.length, 0);
  assert.equal(result.notice, "invalid");
});

test("un token caducado muestra el estado correspondiente", async () => {
  const result = await simulateVerification({
    errorCode: "invalid_or_expired_verification_token"
  });

  assert.equal(result.receivedTokens.length, 1);
  assert.equal(result.notice, "invalid");
});

test("un error del servidor no se presenta como confirmacion", async () => {
  const result = await simulateVerification({
    errorCode: "verification_save_failed"
  });

  assert.equal(result.notice, "error");
});

test("recuperar contrasena tiene prioridad", async () => {
  const result = await simulateVerification({
    resetToken: "token-de-recuperacion"
  });

  assert.deepEqual(
    result.openedModes,
    ["reset"]
  );

  assert.equal(result.receivedTokens.length, 0);
});

test("no hay redireccion en la confirmacion", () => {
  assert.doesNotMatch(
    initializationCode,
    /location\.(assign|replace)\s*\(/
  );
});

test("mensajes disponibles en español e ingles", () => {
  for (const state of [
    "checking",
    "success",
    "invalid",
    "error"
  ]) {
    for (const field of ["title", "message"]) {
      const key =
        `auth_email_verification_${state}_${field}:`;

      assert.equal(
        source.split(key).length - 1,
        2,
        `Traducciones incorrectas: ${key}`
      );
    }
  }
});

test("mantiene el flujo de recuperacion", () => {
  assert.match(
    source,
    /capturePasswordResetTokenFromHash/
  );

  assert.match(
    source,
    /ApiClient\.confirmPasswordReset/
  );
});
