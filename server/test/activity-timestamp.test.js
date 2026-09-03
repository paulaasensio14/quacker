import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveActivityCreatedAt
} from "../lib/activity-timestamp.js";

const previousIso = "2026-09-03T07:58:56.719Z";
const nowIso = "2026-09-03T08:00:30.415Z";

function normalizeActivityCreatedAt(value) {
  const safeValue = String(value || "").trim();

  if (!safeValue) {
    return "";
  }

  const parsed = new Date(safeValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

test(
  "una nueva actividad usa nowIso cuando lastActivityAt no se envía explícitamente",
  () => {
    const result = resolveActivityCreatedAt({
      hasExplicitLastActivityAt: false,
      lastActivityAt: previousIso,
      nowIso,
      normalize: normalizeActivityCreatedAt
    });

    assert.equal(result, nowIso);
  }
);

test(
  "respeta lastActivityAt cuando se envía explícitamente y es válido",
  () => {
    const result = resolveActivityCreatedAt({
      hasExplicitLastActivityAt: true,
      lastActivityAt: previousIso,
      nowIso,
      normalize: normalizeActivityCreatedAt
    });

    assert.equal(result, previousIso);
  }
);

test(
  "usa nowIso cuando lastActivityAt explícito no es válido",
  () => {
    const result = resolveActivityCreatedAt({
      hasExplicitLastActivityAt: true,
      lastActivityAt: "fecha-invalida",
      nowIso,
      normalize: normalizeActivityCreatedAt
    });

    assert.equal(result, nowIso);
  }
);
