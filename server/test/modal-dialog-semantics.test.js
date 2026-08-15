import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboardSource = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const dialogs = [
  {
    modalId: "confirmClearNotifsModal",
    titleId: "confirmClearNotifsTitle",
  },
  {
    modalId: "confirmDeleteListModal",
    titleId: "confirmDeleteListTitle",
  },
  {
    modalId: "listModal",
    titleId: "listModalTitle",
  },
  {
    modalId: "progressModal",
    titleId: "progressModalTitle",
  },
  {
    modalId: "addLibraryModal",
    titleId: "addLibraryModalTitle",
  },
  {
    modalId: "addToListModal",
    titleId: "addToListModalTitle",
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const { modalId, titleId } of dialogs) {
  test(
    `${modalId} expone semántica de diálogo accesible`,
    () => {
      const modalPattern = new RegExp(
        `id="${escapeRegExp(modalId)}"[\\s\\S]*?` +
        `<div class="modal-card[^"]*"[^>]*` +
        `role="dialog"[^>]*` +
        `aria-modal="true"[^>]*` +
        `aria-labelledby="${escapeRegExp(titleId)}"[^>]*>`
      );

      assert.match(
        dashboardSource,
        modalPattern,
        `${modalId} debe declarar role=dialog, aria-modal=true y aria-labelledby`
      );

      const titlePattern = new RegExp(
        `<h3[^>]*id="${escapeRegExp(titleId)}"[^>]*>`
      );

      assert.match(
        dashboardSource,
        titlePattern,
        `${modalId} debe disponer del título ${titleId}`
      );
    }
  );
}
