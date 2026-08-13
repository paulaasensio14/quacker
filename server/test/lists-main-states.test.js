import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const listsSource = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

test(
  "Lists principal dispone de un estado de error con Retry",
  () => {
    assert.match(
      listsSource,
      /function render\(hasError = false\)/
    );

    assert.match(
      listsSource,
      /if \(hasError\)[\s\S]*?lists_load_error[\s\S]*?id="listsRetryLoadBtn"/
    );

    assert.match(
      listsSource,
      /getElementById\("listsRetryLoadBtn"\)\?\.addEventListener\("click"[\s\S]*?load\(\)/
    );
  }
);

test(
  "Lists principal distingue vacío inicial de vacío por filtros",
  () => {
    assert.match(
      listsSource,
      /const isFiltering = listsFilter !== "all" \|\| \(searchTerm \|\| ""\)\.trim\(\)\.length > 0/
    );

    assert.match(
      listsSource,
      /isFiltering[\s\S]*?lists_empty_filtered[\s\S]*?lists_empty_initial/
    );

    assert.match(
      listsSource,
      /id="listsEmptyCreateBtn"/
    );
  }
);

test(
  "Lists principal define sus textos de estado en español e inglés",
  () => {
    for (const key of [
      "lists_load_error",
      "lists_empty_filtered",
      "lists_empty_initial",
      "library_retry",
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
