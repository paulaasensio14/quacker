import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const listsSource = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test(
  "List Detail dispone de un estado de error independiente del estado vacío",
  () => {
    assert.match(
      dashboard,
      /id="listDetailError"[^>]*hidden/
    );

    assert.match(
      dashboard,
      /data-i18n="lists_detail_load_error_title"/
    );

    assert.match(
      dashboard,
      /data-i18n="lists_detail_load_error_text"/
    );

    assert.match(
      dashboard,
      /id="listDetailErrorRetry"/
    );

    assert.match(
      dashboard,
      /data-i18n="lists_detail_load_error_cta"/
    );
  }
);

test(
  "List Detail define textos de error de carga en español e inglés",
  () => {
    for (const key of [
      "lists_detail_load_error_title",
      "lists_detail_load_error_text",
      "lists_detail_load_error_cta",
    ]) {
      const matches =
        i18nSource.match(
          new RegExp(`${key}:\\s*"[^"]+"`, "g")
        ) || [];

      assert.ok(
        matches.length >= 2,
        `debe existir ${key} en ES y EN`
      );
    }
  }
);

test(
  "List Detail muestra un fallo de biblioteca como error y permite reintentar",
  () => {
    assert.match(
      listsSource,
      /_getEl\("listDetailError"\)/
    );

    assert.match(
      listsSource,
      /catch\s*\(e\)\s*\{[\s\S]*?empty\.classList\.add\("is-initially-hidden"\)[\s\S]*?error\.classList\.remove\("is-initially-hidden"\)[\s\S]*?return/
    );

    assert.match(
      listsSource,
      /getElementById\("listDetailErrorRetry"\)\?\.addEventListener\("click"[\s\S]*?renderActiveListItems\(\)\.catch\(console\.error\)/
    );
  }
);
