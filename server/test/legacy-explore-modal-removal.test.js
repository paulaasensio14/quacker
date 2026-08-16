import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const exploreSource = fs.readFileSync(
  new URL("../../assets/js/app/explore.js", import.meta.url),
  "utf8"
);

test("Explore no conserva el modal legacy addFromExploreModal", () => {
  assert.doesNotMatch(
    dashboardSource,
    /id="addFromExploreModal"/,
    "dashboard.html no debe conservar addFromExploreModal"
  );

  assert.doesNotMatch(
    dashboardSource,
    /id="modalAddToLibrary"|id="modalAddToLists"|id="modalCancelExplore"/,
    "dashboard.html no debe conservar los controles del modal legacy"
  );
});

test("Explore no conserva la lógica legacy del modal eliminado", () => {
  assert.doesNotMatch(
    exploreSource,
    /function\s+openAddToLibraryModal\s*\(/,
    "explore.js no debe conservar openAddToLibraryModal"
  );

  assert.doesNotMatch(
    exploreSource,
    /function\s+closeAddFromExploreModal\s*\(/,
    "explore.js no debe conservar closeAddFromExploreModal"
  );
});
