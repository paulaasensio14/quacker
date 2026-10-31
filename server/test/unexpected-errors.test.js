import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import {
  unexpectedErrorHandler
} from "../lib/unexpected-error-handler.js";

function request(server, pathname) {
  return new Promise((resolve, reject) => {
    const address = server.address();

    const req = http.get(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: pathname
      },
      (res) => {
        let body = "";

        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            type: res.headers["content-type"] || "",
            body
          });
        });
      }
    );

    req.on("error", reject);
  });
}

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve, reject) => {
      if (server.listening) {
        resolve();
        return;
      }

      server.once("listening", resolve);
      server.once("error", reject);
    });

    await callback(server);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test(
  "los errores inesperados de API devuelven JSON seguro",
  async () => {
    const app = express();

    app.get("/api/test-error", () => {
      throw new Error(
        "QUACKER_INTERNAL_SECRET_DO_NOT_EXPOSE"
      );
    });

    app.use(unexpectedErrorHandler);

    await withServer(app, async (server) => {
      const response = await request(
        server,
        "/api/test-error"
      );

      assert.equal(response.status, 500);

      assert.match(
        response.type,
        /application\/json/
      );

      assert.deepEqual(
        JSON.parse(response.body),
        {
          error: "internal_server_error"
        }
      );

      assert.doesNotMatch(
        response.body,
        /QUACKER_INTERNAL_SECRET_DO_NOT_EXPOSE/
      );

      assert.doesNotMatch(
        response.body,
        /Error:|at .+\.js:/
      );
    });
  }
);

test(
  "un JSON malformado devuelve un 400 sin revelar el contenido",
  async () => {
    const app = express();

    app.use(express.json());

    app.post("/api/test-json", (_req, res) => {
      res.json({ ok: true });
    });

    app.use(unexpectedErrorHandler);

    await withServer(app, async (server) => {
      const response = await new Promise((resolve, reject) => {
        const address = server.address();

        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: address.port,
            path: "/api/test-json",
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            }
          },
          (res) => {
            let body = "";

            res.setEncoding("utf8");
            res.on("data", (chunk) => {
              body += chunk;
            });

            res.on("end", () => {
              resolve({
                status: res.statusCode,
                type: res.headers["content-type"] || "",
                body
              });
            });
          }
        );

        req.on("error", reject);
        req.end('{"secret":"DO_NOT_EXPOSE",');
      });

      assert.equal(response.status, 400);
      assert.match(response.type, /application\/json/);

      assert.deepEqual(
        JSON.parse(response.body),
        { error: "invalid_request" }
      );

      assert.doesNotMatch(
        response.body,
        /DO_NOT_EXPOSE|SyntaxError/
      );
    });
  }
);

test(
  "los errores inesperados de páginas no muestran detalles internos",
  async () => {
    const app = express();

    app.get("/test-error", () => {
      throw new Error(
        "PRIVATE_HTML_ERROR_DO_NOT_EXPOSE"
      );
    });

    app.use(unexpectedErrorHandler);

    await withServer(app, async (server) => {
      const response = await request(
        server,
        "/test-error"
      );

      assert.equal(response.status, 500);
      assert.match(response.type, /text\/plain/);
      assert.equal(
        response.body,
        "Internal Server Error"
      );

      assert.doesNotMatch(
        response.body,
        /PRIVATE_HTML_ERROR_DO_NOT_EXPOSE/
      );
    });
  }
);

test(
  "el controlador delega cuando las cabeceras ya fueron enviadas",
  () => {
    const error = new Error("stream interrupted");
    const req = {
      method: "GET",
      path: "/api/stream"
    };
    const res = {
      headersSent: true
    };

    let forwarded = null;

    const result = unexpectedErrorHandler(
      error,
      req,
      res,
      (received) => {
        forwarded = received;
      }
    );

    assert.equal(forwarded, error);
    assert.equal(result, undefined);
  }
);
