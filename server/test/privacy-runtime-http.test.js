import assert from "node:assert/strict";
import {
  spawn
} from "node:child_process";
import {
  once
} from "node:events";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  fileURLToPath
} from "node:url";

const SERVER_PATH = fileURLToPath(
  new URL("../server.js", import.meta.url)
);

const SERVER_DIRECTORY =
  path.dirname(SERVER_PATH);

function createTemporaryDirectory() {
  return fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "quacker-privacy-runtime-"
    )
  );
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(
      0,
      "127.0.0.1",
      () => {
        const address = server.address();
        const port =
          typeof address === "object" &&
          address
            ? address.port
            : null;

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          if (!port) {
            reject(
              new Error(
                "No se pudo reservar un puerto temporal."
              )
            );
            return;
          }

          resolve(port);
        });
      }
    );
  });
}

function startTestServer({
  dbPath,
  sessionStorePath,
  port
}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let ready = false;

    const child = spawn(
      process.execPath,
      [SERVER_PATH],
      {
        cwd: SERVER_DIRECTORY,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          QUACKER_DB_PATH: dbPath,
          QUACKER_SESSION_STORE_PATH:
            sessionStorePath
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe"
        ]
      }
    );

    const timeout = setTimeout(() => {
      if (ready) return;

      child.kill("SIGKILL");

      reject(
        new Error(
          `El servidor temporal no arrancó.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
        )
      );
    }, 8000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;

      if (
        !ready &&
        stdout.includes(
          `Quacker server running: http://127.0.0.1:${port}`
        )
      ) {
        ready = true;
        clearTimeout(timeout);
        resolve(child);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("error", (error) => {
      if (ready) return;

      clearTimeout(timeout);
      reject(error);
    });

    child.once(
      "exit",
      (code, signal) => {
        if (ready) return;

        clearTimeout(timeout);

        reject(
          new Error(
            `El servidor temporal terminó antes de arrancar (${code ?? signal}).\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
          )
        );
      }
    );
  });
}

async function stopTestServer(child) {
  if (
    !child ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  const gracefulExit = once(
    child,
    "exit"
  );

  child.kill("SIGTERM");

  const exitedGracefully =
    await Promise.race([
      gracefulExit.then(() => true),
      new Promise((resolve) => {
        setTimeout(
          () => resolve(false),
          2000
        );
      })
    ]);

  if (
    exitedGracefully ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  const forcedExit = once(
    child,
    "exit"
  );

  child.kill("SIGKILL");
  await forcedExit;
}

function requestText(url) {
  return new Promise(
    (resolve, reject) => {
      const request = http.get(
        url,
        {
          headers: {
            Accept: "application/json"
          }
        },
        (response) => {
          let body = "";

          response.setEncoding("utf8");

          response.on(
            "data",
            (chunk) => {
              body += chunk;
            }
          );

          response.on(
            "end",
            () => {
              resolve({
                statusCode:
                  response.statusCode,
                body
              });
            }
          );
        }
      );

      request.setTimeout(
        3000,
        () => {
          request.destroy(
            new Error(
              "Timeout HTTP en servidor temporal."
            )
          );
        }
      );

      request.once("error", reject);
    }
  );
}

test(
  "el backend bloquea datos privados mediante HTTP real",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(directory, "db.json");

    const sessionStorePath =
      path.join(directory, "sessions");

    const privateSentinel =
      "PRIVATE_RUNTIME_SENTINEL_DO_NOT_LEAK";

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {
            public_control: {
              profile: {
                id: "public_control",
                email:
                  "public-control@example.test",
                name: "Runtime Public",
                handle: "@runtime_public",
                bio: "Control público"
              },
              privacy: {
                profile: true,
                activity: false,
                library: false,
                lists: false,
                reviews: false,
                stats: false,
                favorites: false
              },
              library: [],
              lists: [],
              activities: [],
              consumptionHistory: [],
              opinions: [],
              favorites: {}
            },
            private_control: {
              profile: {
                id: "private_control",
                email:
                  "private-control@example.test",
                name: "Runtime Private",
                handle: "@runtime_private",
                bio: privateSentinel
              },
              privacy: {
                profile: false,
                activity: true,
                library: true,
                lists: true,
                reviews: true,
                stats: true,
                favorites: true
              },
              library: [
                {
                  title:
                    privateSentinel
                }
              ],
              lists: [
                {
                  name:
                    privateSentinel
                }
              ],
              activities: [
                {
                  title:
                    privateSentinel
                }
              ],
              consumptionHistory: [],
              opinions: [
                {
                  text:
                    privateSentinel
                }
              ],
              favorites: {}
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child = await startTestServer({
        dbPath,
        sessionStorePath,
        port
      });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const publicResponse =
        await requestText(
          `${baseUrl}/api/public/users/runtime_public`
        );

      assert.equal(
        publicResponse.statusCode,
        200,
        "el usuario público de control debe demostrar que se usa la DB temporal"
      );

      assert.match(
        publicResponse.body,
        /Runtime Public/
      );

      const privateResponse =
        await requestText(
          `${baseUrl}/api/public/users/runtime_private`
        );

      assert.equal(
        privateResponse.statusCode,
        404,
        "un perfil privado no debe ser accesible por API pública"
      );

      assert.doesNotMatch(
        privateResponse.body,
        new RegExp(privateSentinel),
        "la respuesta pública no debe filtrar datos privados"
      );

      const protectedResponse =
        await requestText(
          `${baseUrl}/api/user/privacy`
        );

      assert.equal(
        protectedResponse.statusCode,
        401,
        "la privacidad del usuario requiere sesión autenticada"
      );

      assert.doesNotMatch(
        protectedResponse.body,
        new RegExp(privateSentinel),
        "un acceso directo sin sesión no debe filtrar datos"
      );
    } finally {
      await stopTestServer(child);

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

function requestJson(
  url,
  {
    method = "GET",
    body = null,
    cookie = null
  } = {}
) {
  return new Promise(
    (resolve, reject) => {
      const serializedBody =
        body === null
          ? null
          : JSON.stringify(body);

      const headers = {
        Accept: "application/json"
      };

      if (serializedBody !== null) {
        headers["Content-Type"] =
          "application/json";
        headers["Content-Length"] =
          Buffer.byteLength(
            serializedBody
          );
      }

      if (cookie) {
        headers.Cookie = cookie;
      }

      const request = http.request(
        url,
        {
          method,
          headers
        },
        (response) => {
          let text = "";

          response.setEncoding("utf8");

          response.on(
            "data",
            (chunk) => {
              text += chunk;
            }
          );

          response.on(
            "end",
            () => {
              let json = null;

              if (text) {
                try {
                  json =
                    JSON.parse(text);
                } catch {
                  json = null;
                }
              }

              resolve({
                statusCode:
                  response.statusCode,
                headers:
                  response.headers,
                text,
                json
              });
            }
          );
        }
      );

      request.setTimeout(
        3000,
        () => {
          request.destroy(
            new Error(
              "Timeout HTTP en servidor temporal."
            )
          );
        }
      );

      request.once(
        "error",
        reject
      );

      if (serializedBody !== null) {
        request.write(
          serializedBody
        );
      }

      request.end();
    }
  );
}

test(
  "solo el usuario autenticado puede publicar y volver a ocultar su perfil",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(
        directory,
        "db.json"
      );

    const sessionStorePath =
      path.join(
        directory,
        "sessions"
      );

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child =
        await startTestServer({
          dbPath,
          sessionStorePath,
          port
        });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const registration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "runtime-auth@example.test",
              password:
                "runtime-pass-123",
              name:
                "Runtime Auth",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200,
        "el usuario de prueba debe poder registrarse"
      );

      const setCookie =
        registration.headers[
          "set-cookie"
        ];

      assert.ok(
        Array.isArray(setCookie) &&
          setCookie.length > 0,
        "el registro debe devolver una cookie de sesión"
      );

      const sessionCookie =
        setCookie[0]
          .split(";")[0];

      assert.match(
        sessionCookie,
        /^connect\.sid=/,
        "debe recibirse la cookie de sesión real de Quacker"
      );

      const anonymousPatch =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            body: {
              profile: true
            }
          }
        );

      assert.equal(
        anonymousPatch.statusCode,
        401,
        "un cliente sin sesión no puede modificar la privacidad"
      );

      const stillPrivate =
        await requestJson(
          `${baseUrl}/api/public/users/runtime_auth`
        );

      assert.equal(
        stillPrivate.statusCode,
        404,
        "el PATCH anónimo no debe haber publicado el perfil"
      );

      const initialPrivacy =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            cookie:
              sessionCookie
          }
        );

      assert.equal(
        initialPrivacy.statusCode,
        200
      );

      assert.deepEqual(
        initialPrivacy.json,
        {
          profile: false,
          activity: false,
          library: false,
          lists: false,
          reviews: false,
          stats: false,
          favorites: false
        },
        "una cuenta nueva debe comenzar completamente privada"
      );

      const publish =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              sessionCookie,
            body: {
              profile: true
            }
          }
        );

      assert.equal(
        publish.statusCode,
        200,
        "el propietario autenticado debe poder publicar su perfil"
      );

      assert.equal(
        publish.json?.privacy
          ?.profile,
        true
      );

      const publicProfile =
        await requestJson(
          `${baseUrl}/api/public/users/runtime_auth`
        );

      assert.equal(
        publicProfile.statusCode,
        200,
        "el perfil debe aparecer tras el cambio autenticado"
      );

      assert.match(
        publicProfile.text,
        /Runtime Auth/
      );

      assert.doesNotMatch(
        publicProfile.text,
        /runtime-auth@example\.test/,
        "el email privado nunca debe salir en la API pública"
      );

      assert.doesNotMatch(
        publicProfile.text,
        /passwordHash|passwordSalt|authVersion/,
        "la API pública no debe exponer credenciales ni metadatos de autenticación"
      );

      const hideAgain =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              sessionCookie,
            body: {
              profile: false
            }
          }
        );

      assert.equal(
        hideAgain.statusCode,
        200
      );

      assert.equal(
        hideAgain.json?.privacy
          ?.profile,
        false
      );

      const hiddenAgain =
        await requestJson(
          `${baseUrl}/api/public/users/runtime_auth`
        );

      assert.equal(
        hiddenAgain.statusCode,
        404,
        "al volver a privado el perfil debe desaparecer inmediatamente"
      );
    } finally {
      await stopTestServer(
        child
      );

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  "el runtime mantiene privados datos legacy o malformados y rechaza PATCH manipulados",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(
        directory,
        "db.json"
      );

    const sessionStorePath =
      path.join(
        directory,
        "sessions"
      );

    const sentinel =
      "MALFORMED_PRIVACY_SENTINEL_DO_NOT_LEAK";

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {
            legacy_user: {
              profile: {
                id: "legacy_user",
                email:
                  "legacy@example.test",
                name:
                  "Legacy Runtime",
                handle:
                  "@legacy_runtime",
                bio: sentinel
              }
            },
            malformed_user: {
              profile: {
                id:
                  "malformed_user",
                email:
                  "malformed@example.test",
                name:
                  "Malformed Runtime",
                handle:
                  "@malformed_runtime",
                bio: sentinel
              },
              privacy: {
                profile: "true",
                activity: 1,
                library: {},
                lists: [],
                reviews: null,
                stats: "yes",
                favorites: 42
              },
              library: [
                {
                  title: sentinel
                }
              ],
              lists: [
                {
                  name: sentinel
                }
              ],
              activities: [
                {
                  title: sentinel
                }
              ],
              opinions: [
                {
                  text: sentinel
                }
              ],
              favorites: {}
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child =
        await startTestServer({
          dbPath,
          sessionStorePath,
          port
        });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const legacyResponse =
        await requestJson(
          `${baseUrl}/api/public/users/legacy_runtime`
        );

      assert.equal(
        legacyResponse.statusCode,
        404,
        "un usuario legacy sin privacidad debe permanecer privado"
      );

      assert.doesNotMatch(
        legacyResponse.text,
        new RegExp(sentinel),
        "los datos legacy privados no deben filtrarse"
      );

      const malformedResponse =
        await requestJson(
          `${baseUrl}/api/public/users/malformed_runtime`
        );

      assert.equal(
        malformedResponse.statusCode,
        404,
        "valores truthy no booleanos no deben publicar un perfil"
      );

      assert.doesNotMatch(
        malformedResponse.text,
        new RegExp(sentinel),
        "los valores de privacidad malformados no deben provocar fugas"
      );

      const registration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "runtime-invalid-patch@example.test",
              password:
                "runtime-pass-123",
              name:
                "Invalid Patch Runtime",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const sessionCookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const unknownField =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              sessionCookie,
            body: {
              profile: true,
              admin: true
            }
          }
        );

      assert.equal(
        unknownField.statusCode,
        400
      );

      assert.equal(
        unknownField.json?.error,
        "invalid_privacy_field"
      );

      const invalidValue =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            method: "PATCH",
            cookie:
              sessionCookie,
            body: {
              profile: "true"
            }
          }
        );

      assert.equal(
        invalidValue.statusCode,
        400
      );

      assert.equal(
        invalidValue.json?.error,
        "invalid_privacy_value"
      );

      const privacyAfterAttacks =
        await requestJson(
          `${baseUrl}/api/user/privacy`,
          {
            cookie:
              sessionCookie
          }
        );

      assert.equal(
        privacyAfterAttacks.statusCode,
        200
      );

      assert.deepEqual(
        privacyAfterAttacks.json,
        {
          profile: false,
          activity: false,
          library: false,
          lists: false,
          reviews: false,
          stats: false,
          favorites: false
        },
        "los PATCH inválidos no deben alterar ningún permiso"
      );

      const publicAfterAttacks =
        await requestJson(
          `${baseUrl}/api/public/users/runtime_invalid_patch`
        );

      assert.equal(
        publicAfterAttacks.statusCode,
        404,
        "los intentos manipulados no deben hacer público el perfil"
      );
    } finally {
      await stopTestServer(
        child
      );

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);

test(
  "el backend rechaza avatares SVG enviados directamente por API",
  {
    timeout: 15000
  },
  async () => {
    const directory =
      createTemporaryDirectory();

    const dbPath =
      path.join(
        directory,
        "db.json"
      );

    const sessionStorePath =
      path.join(
        directory,
        "sessions"
      );

    fs.writeFileSync(
      dbPath,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      "utf8"
    );

    const port =
      await getAvailablePort();

    let child = null;

    try {
      child =
        await startTestServer({
          dbPath,
          sessionStorePath,
          port
        });

      const baseUrl =
        `http://127.0.0.1:${port}`;

      const registration =
        await requestJson(
          `${baseUrl}/api/auth/register`,
          {
            method: "POST",
            body: {
              email:
                "runtime-avatar@example.test",
              password:
                "runtime-pass-123",
              name:
                "Runtime Avatar",
              language: "es"
            }
          }
        );

      assert.equal(
        registration.statusCode,
        200
      );

      const sessionCookie =
        registration.headers[
          "set-cookie"
        ][0].split(";")[0];

      const dangerousAvatar =
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>";

      const update =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            method: "PATCH",
            cookie:
              sessionCookie,
            body: {
              avatar:
                dangerousAvatar
            }
          }
        );

      assert.equal(
        update.statusCode,
        400,
        "el backend debe rechazar SVG aunque el cliente lo envíe directamente"
      );

      assert.equal(
        update.json?.error,
        "invalid_avatar"
      );

      const profile =
        await requestJson(
          `${baseUrl}/api/user`,
          {
            cookie:
              sessionCookie
          }
        );

      assert.equal(
        profile.statusCode,
        200
      );

      assert.notEqual(
        profile.json?.avatar,
        dangerousAvatar,
        "un avatar rechazado no debe persistirse"
      );
    } finally {
      await stopTestServer(
        child
      );

      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true
        }
      );
    }
  }
);
