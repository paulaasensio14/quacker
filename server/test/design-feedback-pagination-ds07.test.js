import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function read(path) {
  return fs.readFileSync(
    new URL("../../" + path, import.meta.url),
    "utf8"
  );
}

const css = read("assets/css/design-feedback.css");
const explore = read("assets/js/app/explore.js");
const html = read("dashboard.html");

const marker = "/* DS-07.6: counters and expansion */";

const index = css.indexOf(marker);
const block = index >= 0 ? css.slice(index) : "";

test("DS-07.6: estilos limitados a controles activos", () => {
  assert.ok(index >= 0);

  for (const selector of [
    "#btnGoLibraryFromContinue",
    "#contentDetailCastToggle",
    "#profileOpinionsViewAll",
    "#continueCountLabel",
    "#listDetailShowing",
    ".explore-results-head"
  ]) {
    assert.ok(block.includes(selector), selector);
  }

  assert.doesNotMatch(block, /data-explore-section-action/);
  assert.doesNotMatch(block, /\.content-detail-card-link\s*\{/);
});

test("DS-07.6: controles accesibles y variantes semanticas", () => {
  assert.match(block, /min-height:\s*44px/);
  assert.match(block, /:focus-visible/);
  assert.match(block, /outline:\s*2px solid var\(--q-info\)/);
  assert.match(block, /background:\s*var\(--q-brand\)/);
  assert.match(block, /background:\s*var\(--q-surface\)/);
  assert.match(block, /box-shadow:\s*none/);
  assert.match(block, /prefers-reduced-motion/);
});

test("DS-07.6: contadores legibles y adaptables", () => {
  assert.match(block, /font-variant-numeric:\s*tabular-nums/);
  assert.match(block, /color:\s*var\(--q-text-2\)/);
  assert.match(block, /white-space:\s*normal/);
  assert.match(block, /overflow-wrap:\s*anywhere/);
  assert.match(block, /flex-wrap:\s*wrap/);
  assert.match(block, /max-width:\s*100%/);
});

test("DS-07.6: reparto declara su region y estado inicial", () => {
  const match = html.match(
    /<button\b[^>]*id="contentDetailCastToggle"[^>]*>/s
  );

  assert.ok(match);

  assert.match(
    match[0],
    /aria-controls="contentDetailCast"/
  );

  assert.match(
    match[0],
    /aria-expanded="false"/
  );

  assert.match(match[0], /\bhidden\b/);

  assert.match(
    block,
    /#contentDetailCastToggle\[aria-expanded="true"\]/
  );
});

test("DS-07.6: reparto mantiene limites y estado accesible", () => {
  const start = explore.indexOf(
    "  function _renderContentDetailCast("
  );

  const end = explore.indexOf(
    "  function _formatExploreRegionName(",
    start
  );

  assert.ok(start >= 0 && end > start);

  const context = {
    window: {
      I18n: { t: key => key }
    },

    _safeText: value => String(value ?? ""),
    _escapeHtml: value => String(value ?? "")
  };

  vm.runInNewContext(
    "let __detailCastExpanded = false;\n" +
    explore.slice(start, end) +
    "\nglobalThis.renderCast = _renderContentDetailCast;" +
    "\nglobalThis.setExpanded = value => {" +
    "__detailCastExpanded = value;};",
    context
  );

  const cast = { innerHTML: "" };

  const button = {
    hidden: false,
    textContent: "",
    attributes: {},

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };

  const people = Array.from({ length: 12 }, (_, i) => ({
    name: "Persona " + i,
    character: "Personaje " + i,
    profile: ""
  }));

  function countPeople() {
    return (
      cast.innerHTML.match(
        /class="content-detail-cast-person"/g
      ) || []
    ).length;
  }

  context.renderCast(cast, people, button);

  assert.equal(countPeople(), 8);
  assert.equal(button.hidden, false);
  assert.equal(button.attributes["aria-expanded"], "false");

  assert.equal(
    button.textContent,
    "explore_detail_cast_show_more"
  );

  context.setExpanded(true);
  context.renderCast(cast, people, button);

  assert.equal(countPeople(), 12);
  assert.equal(button.attributes["aria-expanded"], "true");

  assert.equal(
    button.textContent,
    "explore_detail_cast_show_less"
  );

  context.setExpanded(false);
  context.renderCast(cast, people, button);

  assert.equal(countPeople(), 8);
  assert.equal(button.attributes["aria-expanded"], "false");

  context.renderCast(cast, people.slice(0, 3), button);

  assert.equal(countPeople(), 3);
  assert.equal(button.hidden, true);
  assert.equal(button.attributes["aria-expanded"], "false");
});

test("DS-07.6: controles ocultos siguen ocultos", () => {
  assert.match(block, /\[hidden\]/);
  assert.match(block, /display:\s*none\s*!important/);
  assert.match(block, /#continueCountLabel:empty/);
  assert.match(block, /#listDetailShowing:empty/);
});

test("DS-07.6: cambio de tema sin transicion de fondo", () => {
  const controls = block.match(
    /body\s+:is\(\s*#btnGoLibraryFromContinue,\s*#contentDetailCastToggle,\s*#profileOpinionsViewAll\s*\)\s*\{([^}]+)\}/
  );

  assert.ok(controls, "Falta la regla compartida");

  assert.match(
    controls[1],
    /transition:\s*none\s*;/,
    "Texto y fondo deben cambiar simultaneamente"
  );

  assert.doesNotMatch(
    controls[1],
    /transition[^:]*:[^;]*background-color/
  );

  const arrow = block.match(
    /body #contentDetailCastToggle::after\s*\{([^}]+)\}/
  );

  assert.ok(arrow);

  assert.match(
    arrow[1],
    /transition:\s*transform 160ms ease/
  );
});
