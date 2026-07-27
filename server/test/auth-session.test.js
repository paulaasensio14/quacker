import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_COOKIE_NAME,
  createSessionCookieOptions,
  createSessionClearCookieOptions,
  getAuthenticatedUserId,
  regenerateAuthenticatedSession,
  destroyRequestSession
} from "../lib/auth-session.js";

test("utiliza el nombre estándar de cookie de express-session", () => {
  assert.equal(SESSION_COOKIE_NAME, "connect.sid");
});

test("crea una cookie de sesión segura para producción", () => {
  assert.deepEqual(
    createSessionCookieOptions({
      isProduction: true,
      ttlSeconds: 60
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60_000
    }
  );
});

test("crea una cookie de sesión no segura fuera de producción", () => {
  const options = createSessionCookieOptions({
    isProduction: false,
    ttlSeconds: 120
  });

  assert.equal(options.secure, false);
  assert.equal(options.maxAge, 120_000);
});

test("rechaza duraciones de sesión inválidas", () => {
  for (const ttlSeconds of [0, -1, Number.NaN, Infinity]) {
    assert.throws(
      () => createSessionCookieOptions({ ttlSeconds }),
      (error) => error?.code === "INVALID_SESSION_TTL"
    );
  }
});

test("crea opciones coherentes para eliminar la cookie", () => {
  assert.deepEqual(
    createSessionClearCookieOptions({
      isProduction: true
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/"
    }
  );
});

test("reconoce una sesión cuando el usuario existe", () => {
  const users = {
    user_1: {
      profile: {
        id: "user_1"
      }
    }
  };

  assert.equal(
    getAuthenticatedUserId(
      {
        userId: " user_1 "
      },
      users
    ),
    "user_1"
  );
});

test("rechaza sesiones sin usuario o con usuario inexistente", () => {
  const users = {
    user_1: {
      profile: {
        id: "user_1"
      }
    }
  };

  assert.equal(
    getAuthenticatedUserId({}, users),
    null
  );

  assert.equal(
    getAuthenticatedUserId(
      {
        userId: "user_2"
      },
      users
    ),
    null
  );

  assert.equal(
    getAuthenticatedUserId(
      {
        userId: "user_1"
      },
      null
    ),
    null
  );
});

test("rechaza usuarios cuya entrada no sea un objeto válido", () => {
  assert.equal(
    getAuthenticatedUserId(
      {
        userId: "user_1"
      },
      {
        user_1: null
      }
    ),
    null
  );

  assert.equal(
    getAuthenticatedUserId(
      {
        userId: "user_1"
      },
      {
        user_1: []
      }
    ),
    null
  );
});

test("regenera la sesión antes de asociar al usuario", async () => {
  const previousSession = {
    previousValue: "no-debe-conservarse"
  };

  const req = {
    session: previousSession
  };

  previousSession.regenerate = (callback) => {
    req.session = {
      save(saveCallback) {
        saveCallback();
      }
    };

    callback();
  };

  const result = await regenerateAuthenticatedSession(
    req,
    " user_1 "
  );

  assert.equal(result, "user_1");
  assert.equal(req.session.userId, "user_1");
  assert.equal(
    req.session.previousValue,
    undefined
  );
});

test("rechaza la regeneración sin un identificador de usuario", async () => {
  await assert.rejects(
    regenerateAuthenticatedSession(
      {
        session: {}
      },
      "   "
    ),
    (error) => error?.code === "INVALID_SESSION_USER"
  );
});

test("rechaza sesiones que no se puedan regenerar", async () => {
  await assert.rejects(
    regenerateAuthenticatedSession(
      {
        session: {}
      },
      "user_1"
    ),
    (error) =>
      error?.code === "SESSION_REGENERATE_UNAVAILABLE"
  );
});

test("propaga un fallo al regenerar la sesión", async () => {
  const req = {
    session: {
      regenerate(callback) {
        callback(
          new Error("fallo de regeneración")
        );
      }
    }
  };

  await assert.rejects(
    regenerateAuthenticatedSession(req, "user_1"),
    (error) =>
      error?.code === "SESSION_REGENERATE_FAILED" &&
      error?.cause?.message === "fallo de regeneración"
  );
});

test("rechaza una sesión regenerada que no pueda guardarse", async () => {
  const req = {
    session: {
      regenerate(callback) {
        req.session = {};
        callback();
      }
    }
  };

  await assert.rejects(
    regenerateAuthenticatedSession(req, "user_1"),
    (error) =>
      error?.code === "SESSION_SAVE_UNAVAILABLE"
  );
});

test("propaga un fallo al guardar la nueva sesión", async () => {
  const req = {
    session: {
      regenerate(callback) {
        req.session = {
          save(saveCallback) {
            saveCallback(
              new Error("fallo de guardado")
            );
          }
        };

        callback();
      }
    }
  };

  await assert.rejects(
    regenerateAuthenticatedSession(req, "user_1"),
    (error) =>
      error?.code === "SESSION_SAVE_FAILED" &&
      error?.cause?.message === "fallo de guardado"
  );
});

test("destruye correctamente la sesión actual", async () => {
  let destroyed = false;

  const req = {
    session: {
      destroy(callback) {
        destroyed = true;
        callback();
      }
    }
  };

  await destroyRequestSession(req);

  assert.equal(destroyed, true);
});

test("permite cerrar sesión cuando no existe una sesión activa", async () => {
  await assert.doesNotReject(
    destroyRequestSession({})
  );
});

test("rechaza sesiones que no se puedan destruir", async () => {
  await assert.rejects(
    destroyRequestSession({
      session: {}
    }),
    (error) =>
      error?.code === "SESSION_DESTROY_UNAVAILABLE"
  );
});

test("propaga un fallo al destruir la sesión", async () => {
  const req = {
    session: {
      destroy(callback) {
        callback(
          new Error("fallo de destrucción")
        );
      }
    }
  };

  await assert.rejects(
    destroyRequestSession(req),
    (error) =>
      error?.code === "SESSION_DESTROY_FAILED" &&
      error?.cause?.message === "fallo de destrucción"
  );
});
