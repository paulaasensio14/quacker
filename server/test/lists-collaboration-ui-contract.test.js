import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

const server = read("../server.js");
const html = read("../../dashboard.html");
const client = read("../../assets/js/data/api-client.js");
const lists = read("../../assets/js/app/lists.js");
const notifications = read(
  "../../assets/js/app/home-notifications.js"
);

test("backend dispone de rutas colaborativas", () => {
  const paths = [
    "/api/lists/:id/invites/:username",
    "/api/user/list-invites",
    "/api/user/list-invites/:listId/accept",
    "/api/user/list-invites/:listId",
    "/api/lists/:id/members/me",
    "/api/lists/:id/members/:userId"
  ];

  for (const path of paths) {
    assert.ok(
      server.includes(`"${path}"`),
      `Falta ruta ${path}`
    );
  }
});

test("notificaciones permiten aceptar y rechazar", () => {
  assert.match(
    notifications,
    /ApiClient\.acceptListInvite\(/
  );

  assert.match(
    notifications,
    /ApiClient\.rejectListInvite\(/
  );
});

test("detalle ofrece controles de colaboracion", () => {
  const ids = [
    "listCollaborationPanel",
    "listMemberUsername",
    "btnInviteListMember",
    "listMembersList",
    "btnLeaveCollaborativeList",
    "listCollaborationFeedback"
  ];

  for (const id of ids) {
    assert.ok(
      html.includes(`id="${id}"`),
      `Falta control ${id}`
    );
  }
});

test("ApiClient expone las operaciones de miembros", () => {
  const operations = [
    "inviteListMember",
    "removeListMember",
    "leaveCollaborativeList"
  ];

  for (const operation of operations) {
    assert.ok(
      client.includes(`async function ${operation}(`),
      `Falta funcion ${operation}`
    );

    assert.match(
      client,
      new RegExp(`\\n\\s+${operation},`)
    );
  }
});

test("ListsModule conecta los controles colaborativos", () => {
  const required = [
    "renderListCollaboration",
    "btnInviteListMember",
    "btnLeaveCollaborativeList",
    "listMembersList"
  ];

  for (const name of required) {
    assert.ok(
      lists.includes(name),
      `Falta integracion ${name}`
    );
  }
});
