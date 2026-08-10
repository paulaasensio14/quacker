import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadDetailModule() {
  const source = fs.readFileSync(
    new URL("../../assets/js/app/detail.js", import.meta.url),
    "utf8"
  );

  const backButton = {
    dataset: {
      i18n: "detail_back_to_explore"
    },
    textContent: "Volver a Explorar"
  };

  const translations = {
    detail_back_to_explore: "Volver a Explorar",
    detail_back_to_library: "Volver a Biblioteca"
  };

  const context = {
    window: {
      I18n: {
        t(key) {
          return translations[key] || key;
        }
      }
    },
    document: {
      getElementById(id) {
        return id === "contentDetailBack" ? backButton : null;
      },
      addEventListener() {}
    },
    console
  };

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: "assets/js/app/detail.js"
  });

  return {
    DetailModule: context.window.DetailModule,
    backButton
  };
}

test(
  "Detail adapta la etiqueta Back al origen Library y restaura Explore",
  () => {
    const { DetailModule, backButton } = loadDetailModule();

    DetailModule.setDetailState({
      originView: "library"
    });

    assert.equal(
      backButton.dataset.i18n,
      "detail_back_to_library"
    );

    assert.equal(
      backButton.textContent,
      "Volver a Biblioteca"
    );

    DetailModule.setDetailState({
      originView: "explore"
    });

    assert.equal(
      backButton.dataset.i18n,
      "detail_back_to_explore"
    );

    assert.equal(
      backButton.textContent,
      "Volver a Explorar"
    );
  }
);

test(
  "i18n define la etiqueta Back de Library en español e inglés",
  () => {
    const source = fs.readFileSync(
      new URL("../../assets/js/app/i18n.js", import.meta.url),
      "utf8"
    );

    assert.match(
      source,
      /detail_back_to_library:\s*"Volver a Biblioteca"/
    );

    assert.match(
      source,
      /detail_back_to_library:\s*"Back to Library"/
    );
  }
);
