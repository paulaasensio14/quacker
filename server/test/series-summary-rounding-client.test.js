import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../assets/js/data/api-client.js", import.meta.url),
  "utf8"
);

test(
  "QA-02-002: resumen canónico evita 100 por ciento prematuro",
  () => {
    const start = source.indexOf(
      "function _buildSeriesConsumptionSummary("
    );

    const end = source.indexOf(
      "async function getSeriesConsumptionSummary(",
      start
    );

    assert.ok(start >= 0);
    assert.ok(end > start);

    const block = source.slice(start, end);

    const currentFormula =
      /const progress = totalEpisodes > 0\s*\?\s*Math\.round\(\(watchedKeys\.size \/ totalEpisodes\) \* 100\)/;

    assert.doesNotMatch(
      block,
      currentFormula,
      "El resumen no debe redondear a 100 si queda algún episodio pendiente"
    );
  }
);

test(
  "QA-02-002: resumen calcula 0, 1, 199 y 200 de 200",
  () => {
    const start = source.indexOf(
      "function _buildSeriesConsumptionSummary("
    );

    const end = source.indexOf(
      "async function getSeriesConsumptionSummary(",
      start
    );

    assert.ok(start >= 0 && end > start);

    const block = source.slice(start, end);

    const match = block.match(
      /const progress =[\s\S]*?;/
    );

    assert.ok(match, "Falta la fórmula de progreso");

    const calculate = Function(
      "watchedKeys",
      "totalEpisodes",
      `"use strict"; ${match[0]} return progress;`
    );

    const watched = (count) => ({
      size: count
    });

    assert.equal(calculate(watched(0), 200), 0);
    assert.equal(calculate(watched(1), 200), 1);
    assert.equal(calculate(watched(199), 200), 99);
    assert.equal(calculate(watched(200), 200), 100);
    assert.equal(calculate(watched(0), 0), 0);
  }
);
