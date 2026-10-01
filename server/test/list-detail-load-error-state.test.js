import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(
  new URL("../../dashboard.html", import.meta.url),
  "utf8"
);

const listsSource = fs.readFileSync(
  new URL("../../assets/js/app/lists.js", import.meta.url),
  "utf8"
);

const i18nSource = fs.readFileSync(
  new URL("../../assets/js/app/i18n.js", import.meta.url),
  "utf8"
);

const dashboardCssSource = fs.readFileSync(
  new URL("../../assets/css/dashboard.css", import.meta.url),
  "utf8"
);

test(
  "List Detail dispone de un estado de error independiente del estado vacío",
  () => {
    assert.match(
      dashboard,
      /id="listDetailError"[^>]*hidden/
    );

    assert.match(
      dashboard,
      /data-i18n="lists_detail_load_error_title"/
    );

    assert.match(
      dashboard,
      /data-i18n="lists_detail_load_error_text"/
    );

    assert.match(
      dashboard,
      /id="listDetailErrorRetry"/
    );

    assert.match(
      dashboard,
      /data-i18n="lists_detail_load_error_cta"/
    );
  }
);

test(
  "List Detail define textos de error de carga en español e inglés",
  () => {
    for (const key of [
      "lists_detail_load_error_title",
      "lists_detail_load_error_text",
      "lists_detail_load_error_cta",
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

test(
  "List Detail muestra un fallo de biblioteca como error y permite reintentar",
  () => {
    assert.match(
      listsSource,
      /_getEl\("listDetailError"\)/
    );

    assert.match(
      listsSource,
      /catch\s*\(e\)\s*\{[\s\S]*?empty\.classList\.add\("is-initially-hidden"\)[\s\S]*?error\.classList\.remove\("is-initially-hidden"\)[\s\S]*?return/
    );

    assert.match(
      listsSource,
      /getElementById\("listDetailErrorRetry"\)\?\.addEventListener\("click"[\s\S]*?renderActiveListItems\(\)\.catch\(console\.error\)/
    );
  }
);

test(
  "List Detail reserva una sección independiente para votaciones",
  () => {
    assert.match(
      dashboard,
      /id="listDetailPolls"/
    );

    assert.match(
      dashboard,
      /id="btnCreateListPoll"/
    );

    assert.match(
      dashboard,
      /id="listDetailPollsList"/
    );

    assert.match(
      dashboard,
      /id="listDetailPolls"[\s\S]*?id="listDetailPollsList"[\s\S]*?class="list-detail-items"/
    );
  }
);

test(
  "List Detail renderiza las votaciones al abrir y refrescar una lista",
  () => {
    assert.match(
      listsSource,
      /async function renderActiveListPolls\s*\(/
    );

    assert.match(
      listsSource,
      /async function openListDetail[\s\S]*?_renderActiveListDetailHeader\(list\)[\s\S]*?await renderActiveListPolls\(\)[\s\S]*?await renderActiveListItems\(\)/
    );

    assert.match(
      listsSource,
      /detailOpen[\s\S]*?_renderActiveListDetailHeader\(activeList\)[\s\S]*?await renderActiveListPolls\(\)[\s\S]*?await renderActiveListItems\(\)/
    );
  }
);

test(
  "List Detail dispone de un modal accesible para crear votaciones",
  () => {
    assert.match(
      dashboard,
      /id="listPollModal"[^>]*aria-hidden="true"/
    );

    assert.match(
      dashboard,
      /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="listPollModalTitle"/
    );

    assert.match(
      dashboard,
      /id="listPollModalTitle"/
    );

    assert.match(
      dashboard,
      /id="lpm_title"/
    );

    assert.match(
      dashboard,
      /id="lpm_options"/
    );

    assert.match(
      dashboard,
      /id="lpm_multiple"/
    );

    assert.match(
      dashboard,
      /id="lpm_deadline"/
    );

    assert.match(
      dashboard,
      /id="listPollModalErrors"/
    );

    assert.match(
      dashboard,
      /id="cancelListPollModal"/
    );

    assert.match(
      dashboard,
      /id="saveListPollModal"/
    );
  }
);

test(
  "El modal de votación se abre con opciones canónicas de la lista activa",
  () => {
    assert.match(
      listsSource,
      /function openListPollModal\s*\(/
    );

    assert.match(
      listsSource,
      /window\.ItemIdentity[\s\S]*?getCanonicalContentKey/
    );

    assert.match(
      listsSource,
      /_resolveListItemEntry\([\s\S]*?listsOverviewLibrary[\s\S]*?\)/
    );

    assert.match(
      listsSource,
      /getCanonicalContentKey\(item\)/
    );

    assert.match(
      listsSource,
      /name="listPollOption"/
    );

    assert.match(
      listsSource,
      /value="\$\{_safeAttr\(contentKey\)\}"/
    );

    assert.match(
      listsSource,
      /UIModal\?\.open\(modal,\s*\{\s*initialFocusSelector:\s*"#lpm_title"\s*\}\)/
    );

    assert.match(
      listsSource,
      /getElementById\("btnCreateListPoll"\)\?\.addEventListener\("click",\s*openListPollModal\)/
    );
  }
);

test(
  "El modal crea una votación con las opciones seleccionadas y refresca el detalle",
  () => {
    assert.match(
      listsSource,
      /async function saveListPollFromModal\s*\(/
    );

    assert.match(
      listsSource,
      /querySelectorAll\(\s*['"]input\[name="listPollOption"\]:checked['"]\s*\)/
    );

    assert.match(
      listsSource,
      /optionContentKeys\.length\s*<\s*2/
    );

    assert.match(
      listsSource,
      /document\.getElementById\("lpm_multiple"\)\?\.checked/
    );

    assert.match(
      listsSource,
      /new Date\(deadlineRaw\)\.toISOString\(\)/
    );

    assert.match(
      listsSource,
      /await ApiClient\.createListPoll\(\s*listId,\s*\{[\s\S]*?title,[\s\S]*?optionContentKeys,[\s\S]*?allowMultipleVotes,[\s\S]*?deadlineAt[\s\S]*?\}\s*\)/
    );

    assert.match(
      listsSource,
      /UIModal\?\.close\(modal\)[\s\S]*?await load\(\)[\s\S]*?await openListDetail\(listId\)/
    );

    assert.match(
      listsSource,
      /getElementById\("saveListPollModal"\)\?\.addEventListener\("click",\s*saveListPollFromModal\)/
    );
  }
);

test(
  "List Detail conserva la identidad del usuario actual para sus votaciones",
  () => {
    assert.match(
      listsSource,
      /let currentUserId\s*=\s*""/
    );

    assert.match(
      listsSource,
      /async function _ensureCurrentUserId\s*\(/
    );

    assert.match(
      listsSource,
      /if\s*\(currentUserId\)\s*return currentUserId/
    );

    assert.match(
      listsSource,
      /await ApiClient\.getCurrentSession\(\)/
    );

    assert.match(
      listsSource,
      /currentUserId\s*=\s*_normalizeId\(session\?\.user\?\.id\)/
    );

    assert.match(
      listsSource,
      /async function load\s*\(\)[\s\S]*?await _ensureCurrentUserId\(\)[\s\S]*?allLists\s*=\s*await ApiClient\.getLists\(\)/
    );
  }
);

test(
  "List Detail renderiza el voto propio con controles simples o múltiples",
  () => {
    assert.match(
      listsSource,
      /poll\?\.votesByUserId\?\.\[currentUserId\]/
    );

    assert.match(
      listsSource,
      /allowMultipleVotes[\s\S]*?\?\s*"checkbox"\s*:\s*"radio"/
    );

    assert.match(
      listsSource,
      /name="listPollVote-\$\{pollId\}"/
    );

    assert.match(
      listsSource,
      /data-poll-option-key="\$\{contentKey\}"/
    );

    assert.match(
      listsSource,
      /ownVotes\.includes\(\s*option\?\.contentKey\s*\)/
    );

    assert.match(
      listsSource,
      /checked\s*\?\s*"checked"\s*:\s*""/
    );

    assert.match(
      listsSource,
      /closed\s*\?\s*"disabled"\s*:\s*""/
    );

    assert.match(
      listsSource,
      /data-action="save-poll-vote"/
    );
  }
);

test(
  "List Detail guarda el voto propio mediante ApiClient y refresca la lista activa",
  () => {
    assert.match(
      listsSource,
      /async function saveListPollVote\s*\(pollId\)/
    );

    assert.match(
      listsSource,
      /querySelectorAll\(\s*['"]input\[data-poll-option-key\]:checked['"]\s*\)/
    );

    assert.match(
      listsSource,
      /\.map\([\s\S]*?dataset\.pollOptionKey[\s\S]*?\)/
    );

    assert.match(
      listsSource,
      /await ApiClient\.voteListPoll\(\s*listId,\s*safePollId,\s*contentKeys\s*\)/
    );

    assert.match(
      listsSource,
      /dataset\.busy\s*===\s*"1"/
    );

    assert.match(
      listsSource,
      /await load\(\)[\s\S]*?await openListDetail\(listId\)/
    );

    assert.match(
      listsSource,
      /getElementById\("listDetailPollsList"\)\?\.addEventListener\("click",[\s\S]*?data-action="save-poll-vote"[\s\S]*?saveListPollVote/
    );
  }
);

test(
  "List Detail muestra cerrar votación solo al owner de la lista o creador de la votación",
  () => {
    assert.match(
      listsSource,
      /const isListOwner\s*=\s*_normalizeId\(list\?\.ownerUserId\)\s*===\s*currentUserId/
    );

    assert.match(
      listsSource,
      /const isPollCreator\s*=\s*_normalizeId\(poll\?\.createdByUserId\)\s*===\s*currentUserId/
    );

    assert.match(
      listsSource,
      /const canClosePoll\s*=\s*!closed\s*&&\s*\(isListOwner\s*\|\|\s*isPollCreator\)/
    );

    assert.match(
      listsSource,
      /data-action="close-poll"/
    );

    assert.match(
      listsSource,
      /canClosePoll[\s\S]*?t\("lists_poll_close"\)/
    );
  }
);

test(
  "List Detail cierra una votación mediante ApiClient y refresca la lista activa",
  () => {
    assert.match(
      listsSource,
      /async function closeListPollFromDetail\s*\(pollId\)/
    );

    assert.match(
      listsSource,
      /const safePollId\s*=\s*_normalizeId\(pollId\)/
    );

    assert.match(
      listsSource,
      /dataset\.busy\s*===\s*"1"/
    );

    assert.match(
      listsSource,
      /await ApiClient\.closeListPoll\(\s*listId,\s*safePollId\s*\)/
    );

    assert.match(
      listsSource,
      /await load\(\)[\s\S]*?await openListDetail\(listId\)/
    );

    assert.match(
      listsSource,
      /data-action="close-poll"[\s\S]*?closeListPollFromDetail/
    );
  }
);

test(
  "List Detail carga y muestra los resultados de una votación mediante ApiClient",
  () => {
    assert.match(
      listsSource,
      /data-action="show-poll-results"/
    );

    assert.match(
      listsSource,
      /data-poll-results-for="\$\{pollId\}"/
    );

    assert.match(
      listsSource,
      /async function loadListPollResults\s*\(pollId\)/
    );

    assert.match(
      listsSource,
      /await ApiClient\.getListPollResults\(\s*listId,\s*safePollId\s*\)/
    );

    assert.match(
      listsSource,
      /results\.totalVotes/
    );

    assert.match(
      listsSource,
      /results\.counts/
    );

    assert.match(
      listsSource,
      /results\.winnerContentKey/
    );

    assert.match(
      listsSource,
      /results\.tied/
    );

    assert.match(
      listsSource,
      /data-action="show-poll-results"[\s\S]*?loadListPollResults/
    );
  }
);

test(
  "Las votaciones de List Detail usan i18n en español e inglés",
  () => {
    const pollKeys = [
      "lists_poll_section_title",
      "lists_poll_section_subtitle",
      "lists_poll_create",
      "lists_poll_empty",
      "lists_poll_status_open",
      "lists_poll_status_closed",
      "lists_poll_save_vote",
      "lists_poll_close",
      "lists_poll_show_results",
      "lists_poll_loading",
      "lists_poll_saving",
      "lists_poll_closing",
      "lists_poll_results_total",
      "lists_poll_winner",
      "lists_poll_result_has_winner",
      "lists_poll_result_tied",
      "lists_poll_result_no_winner",
      "lists_poll_results_error",
      "lists_poll_modal_title",
      "lists_poll_modal_question_label",
      "lists_poll_modal_multiple",
      "lists_poll_modal_deadline",
    ];

    for (const key of pollKeys) {
      const matches =
        i18nSource.match(
          new RegExp(`${key}:\\s*"[^"]+"`, "g")
        ) || [];

      assert.ok(
        matches.length >= 2,
        `debe existir ${key} en ES y EN`
      );
    }

    for (const key of [
      "lists_poll_section_title",
      "lists_poll_section_subtitle",
      "lists_poll_create",
      "lists_poll_modal_title",
      "lists_poll_modal_question_label",
      "lists_poll_modal_multiple",
      "lists_poll_modal_deadline",
    ]) {
      assert.match(
        dashboard,
        new RegExp(`data-i18n="${key}"`)
      );
    }

    for (const key of [
      "lists_poll_empty",
      "lists_poll_status_open",
      "lists_poll_status_closed",
      "lists_poll_save_vote",
      "lists_poll_close",
      "lists_poll_show_results",
      "lists_poll_loading",
      "lists_poll_saving",
      "lists_poll_closing",
      "lists_poll_results_total",
      "lists_poll_winner",
      "lists_poll_result_has_winner",
      "lists_poll_result_tied",
      "lists_poll_result_no_winner",
      "lists_poll_results_error",
    ]) {
      assert.match(
        listsSource,
        new RegExp(`t\\("${key}"\\)`)
      );
    }
  }
);


test(
  "Las votaciones de List Detail tienen estilos propios y responsive",
  () => {
    for (const selector of [
      ".list-detail-polls",
      ".list-polls-header",
      ".list-polls-list",
      ".list-poll-card",
      ".list-poll-card-head",
      ".list-poll-status",
      ".list-poll-options",
      ".list-poll-option-label",
      ".list-poll-results",
      ".list-poll-results-list",
      ".list-poll-result-row",
      ".list-poll-winner",
      ".list-poll-modal-options",
      ".list-poll-modal-option",
    ]) {
      assert.match(
        dashboardCssSource,
        new RegExp(
          selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          "\\s*\\{"
        ),
        `debe existir estilo para ${selector}`
      );
    }

    assert.match(
      dashboardCssSource,
      /\.list-detail-polls\s*\{[\s\S]*?border:\s*3px solid var\(--border-strong\)[\s\S]*?background:\s*var\(--bg-card\)/
    );

    assert.match(
      dashboardCssSource,
      /@media\s*\(max-width:\s*[^)]+\)[\s\S]*?\.list-polls-header/
    );
  }
);

test(
  "List Detail oculta las votaciones fuera de listas colaborativas",
  () => {
    assert.match(
      listsSource,
      /listDetailPolls[\s\S]*?visibility\s*!==\s*"collab"[\s\S]*?hidden/
    );

    assert.match(
      listsSource,
      /function openListPollModal\(\)[\s\S]*?visibility\s*!==\s*"collab"[\s\S]*?return/
    );
  }
);

test(
  "el título de cada votación usa una clase estilizada por dashboard.css",
  () => {
    assert.match(
      listsSource,
      /class="list-poll-card-title"/
    );

    assert.match(
      dashboardCssSource,
      /\.list-poll-card-title\s*\{/
    );
  }
);

test(
  "las tarjetas de listas reservan editar y eliminar al propietario",
  () => {
    assert.match(
      listsSource,
      /const canManageList\s*=\s*_normalizeId\(list\?\.ownerUserId\)\s*===\s*currentUserId/
    );

    assert.match(
      listsSource,
      /canManageList\s*\?\s*`[\s\S]*?data-action="edit-list"[\s\S]*?data-action="delete-list"[\s\S]*?`\s*:\s*""/
    );
  }
);
