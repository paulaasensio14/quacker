import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(
    new URL(path, import.meta.url),
    "utf8"
  );
}

const html = read("../../dashboard.html");
const lists = read("../../assets/js/app/lists.js");
const css = read("../../assets/css/dashboard.css");
const i18n = read("../../assets/js/app/i18n.js");

const implemented =
  html.includes('id="listDetailTabs"');

function elementTag(id) {
  const start = html.match(
    new RegExp(
      `<(?:button|div|section)\\b[^>]*\\bid="${id}"[^>]*>`,
      "m"
    )
  );

  assert.ok(start, `Elemento ausente: ${id}`);
  return start[0];
}

test(
  "QK-184-UI-TABS: existen tres pestanas",
  () => {
    assert.ok(
      implemented,
      "Falta la navegacion por pestanas"
    );

    assert.match(
      html,
      /role="tablist"/
    );

    for (const name of [
      "Content",
      "Polls",
      "People"
    ]) {
      assert.ok(
        html.includes(`id="listDetailTab${name}"`),
        `Falta pestana ${name}`
      );
    }
  }
);

test(
  "QK-184-UI-TABS: botones accesibles",
  { skip: !implemented },
  () => {
    const cases = [
      ["Content", "content"],
      ["Polls", "polls"],
      ["People", "people"]
    ];

    for (const [name, value] of cases) {
      const tag = elementTag(
        `listDetailTab${name}`
      );

      assert.match(tag, /^<button\b/);
      assert.match(tag, /role="tab"/);

      assert.ok(
        tag.includes(
          `data-list-detail-tab="${value}"`
        )
      );

      assert.ok(
        tag.includes(
          `aria-controls="listDetailPane${name}"`
        )
      );
    }
  }
);

test(
  "QK-184-UI-TABS: contenido activo por defecto",
  { skip: !implemented },
  () => {
    const content = elementTag(
      "listDetailTabContent"
    );

    const polls = elementTag(
      "listDetailTabPolls"
    );

    const people = elementTag(
      "listDetailTabPeople"
    );

    assert.match(
      content,
      /aria-selected="true"/
    );

    assert.match(
      polls,
      /aria-selected="false"/
    );

    assert.match(
      people,
      /aria-selected="false"/
    );

    assert.doesNotMatch(
      elementTag("listDetailPaneContent"),
      /\bhidden(?:\s|=|>)/
    );

    for (const name of ["Polls", "People"]) {
      assert.match(
        elementTag(`listDetailPane${name}`),
        /\bhidden(?:\s|=|>)/
      );
    }
  }
);

test(
  "QK-184-UI-TABS: secciones en orden correcto",
  { skip: !implemented },
  () => {
    const content = html.indexOf(
      'id="listDetailPaneContent"'
    );

    const polls = html.indexOf(
      'id="listDetailPanePolls"'
    );

    const people = html.indexOf(
      'id="listDetailPanePeople"'
    );

    assert.ok(
      content >= 0 &&
      polls > content &&
      people > polls
    );

    const contentMarkup =
      html.slice(content, polls);

    const pollMarkup =
      html.slice(polls, people);

    const peopleMarkup =
      html.slice(people);

    assert.match(
      contentMarkup,
      /class="list-detail-items"/
    );

    assert.match(
      pollMarkup,
      /id="listDetailPolls"/
    );

    assert.match(
      peopleMarkup,
      /id="listCollaborationPanel"/
    );

    assert.match(
      peopleMarkup,
      /id="btnLeaveCollaborativeList"/
    );
  }
);

test(
  "QK-184-UI-TABS: integracion JavaScript",
  { skip: !implemented },
  () => {
    assert.match(
      lists,
      /function activateListDetailTab\(/
    );

    assert.match(
      lists,
      /activateListDetailTab\(\s*["']content["']\s*\)/
    );

    assert.match(
      lists,
      /listDetailTabs/
    );

    assert.match(
      lists,
      /aria-selected/
    );
  }
);

test(
  "QK-184-UI-TABS: traducciones ES y EN",
  { skip: !implemented },
  () => {
    for (const key of [
      "lists_detail_tab_content",
      "lists_detail_tab_polls",
      "lists_detail_tab_people"
    ]) {
      const matches =
        i18n.match(
          new RegExp(
            `^\\s*${key}\\s*:`,
            "gm"
          )
        ) || [];

      assert.equal(
        matches.length,
        2,
        `Falta traduccion ES/EN: ${key}`
      );
    }
  }
);

test(
  "QK-184-UI-TABS: estilos y foco visible",
  { skip: !implemented },
  () => {
    assert.match(
      css,
      /#listDetailTabs/
    );

    assert.match(
      css,
      /\.list-detail-tab/
    );

    assert.match(
      css,
      /\.list-detail-tab:focus-visible/
    );
  }
);
