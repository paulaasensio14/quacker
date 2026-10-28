import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL(
    "../../assets/js/app/home-lists-ui.js",
    import.meta.url
  ),
  "utf8"
);

function fakeElement() {
  return {
    dataset: {},
    hidden: false,
    disabled: false,
    textContent: "",
    innerHTML: "",
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    setAttribute() {}
  };
}

async function renderWithActivity(lastActivity = null) {
  const button = fakeElement();
  const errorState = fakeElement();
  const errors = [];

  const document = {
    documentElement: {
      dataset: {}
    },
    querySelector(selector) {
      return selector === "#btnMarkLastActivity"
        ? button
        : null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      return id === "homeDashboardError"
        ? errorState
        : null;
    },
    addEventListener() {}
  };

  const context = {
    document,
    console: {
      error(...args) {
        errors.push(args);
      },
      log() {}
    },
    ApiClient: {
      async getHomeStats() {
        return {
          weeklyMinutes: 0,
          todayMinutes: 0,
          inProgressCount: 0,
          completedThisYear: 0,
          completedToday: 0,
          streakDays: 0
        };
      },
      async getLastActivityDetailed() {
        return lastActivity;
      },
      async getMonthlyChallenge() {
        return null;
      },
      async getBacklogItems() {
        return [];
      }
    }
  };

  context.window = context;
  context.I18n = {
    t(key) {
      return key;
    }
  };

  vm.createContext(context);

  vm.runInContext(source, context, {
    filename: "home-lists-ui.js"
  });

  await vm.runInContext(
    "renderHomeDashboard()",
    context
  );

  return { button, errorState, errors };
}

function assertNoRenderErrors(result) {
  const messages = result.errors.map(
    ([message, error]) =>
      `${message}: ${error?.name}: ${error?.message}`
  );

  assert.deepEqual(messages, []);
  assert.equal(
    result.errorState.hidden,
    true,
    "Inicio no debe mostrar el estado de error"
  );
}

test(
  "Inicio funciona con una cuenta nueva y sin actividad",
  async () => {
    const result = await renderWithActivity();

    assertNoRenderErrors(result);

    assert.equal(result.button.disabled, true);
    assert.equal(result.button.dataset.itemId, "");

    assert.match(
      result.button.innerHTML,
      /<svg[\s\S]*<\/svg>/
    );

    assert.match(
      result.button.innerHTML,
      /home_last_activity_button_idle/
    );

    assert.match(
      result.button.innerHTML,
      /aria-hidden="true"/
    );
  }
);

test(
  "Inicio conserva el botón cuando hay actividad",
  async () => {
    const result = await renderWithActivity({
      id: "contenido_qa",
      title: "Contenido de prueba",
      progressPercent: 35
    });

    assertNoRenderErrors(result);

    assert.equal(
      result.button.dataset.itemId,
      "contenido_qa"
    );

    assert.equal(result.button.disabled, false);

    assert.match(
      result.button.innerHTML,
      /home_last_activity_button_progress_done/
    );
  }
);
