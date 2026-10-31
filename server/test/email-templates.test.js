import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeEmailHtml,
  renderEmailLayout,
  renderEmailButton,
  renderEmailPanel
} from "../lib/email-templates.js";

test("email HTML escapes user-controlled content", () => {
  assert.equal(
    escapeEmailHtml('<script>"&'),
    "&lt;script&gt;&quot;&amp;"
  );
});

test("email layout uses Quacker branding", () => {
  const html = renderEmailLayout({
    title: "Bienvenida",
    eyebrow: "QUACKER",
    content: "<p>Contenido</p>"
  });

  assert.match(html, /logo-quacker\.png/);
  assert.match(html, /#f2c230/);
  assert.match(html, /#0d3340/);
  assert.match(html, /lang="es"/);
  assert.match(html, /Contenido/);
});

test("email layout escapes titles", () => {
  const html = renderEmailLayout({
    title: '<script>alert("x")</script>',
    content: ""
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("email button accepts Quacker HTTPS URLs", () => {
  const html = renderEmailButton({
    label: "Entrar",
    url: "https://quacker.es/#reset=example"
  });

  assert.match(html, /https:\/\/quacker\.es\/#reset=example/);
});

test("email button rejects external URLs", () => {
  assert.throws(() => renderEmailButton({
    label: "Entrar",
    url: "https://example.com/"
  }), /invalid_email_action_url/);
});

test("email panel wraps content", () => {
  const html = renderEmailPanel("Texto");

  assert.match(html, /Texto/);
  assert.match(html, /role="presentation"/);
});
