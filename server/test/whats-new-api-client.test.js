import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const apiClientSource = fs.readFileSync(
  new URL(
    "../../assets/js/data/api-client.js",
    import.meta.url
  ),
  "utf8"
);

test(
  "ApiClient expone las operaciones de Qué hay de nuevo",
  () => {
    assert.match(
      apiClientSource,
      /async function getWhatsNewUIState\(\)/
    );

    assert.match(
      apiClientSource,
      /_httpJson\(\s*["']GET["'],\s*["']\/user\/ui\/whats-new["']\s*\)/
    );

    assert.match(
      apiClientSource,
      /async function markWhatsNewSeen\(\)/
    );

    assert.match(
      apiClientSource,
      /_httpJson\(\s*["']PATCH["'],\s*["']\/user\/ui\/whats-new["']/
    );

    assert.match(
      apiClientSource,
      /\bgetWhatsNewUIState\b[\s\S]*\bmarkWhatsNewSeen\b/
    );
  }
);
