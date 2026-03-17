// Helpers globales (no sobrescribir si ya existen)
window.$ = window.$ || ((sel) => document.querySelector(sel));
window.$all = window.$all || ((sel) => document.querySelectorAll(sel));

// Labels globales (no sobrescribir si ya existen)
window.TYPE_LABELS = window.TYPE_LABELS || {
  serie: "Serie",
  pelicula: "Película",
  book: "Libro",
  game: "Videojuego"
};
window.typeLabel = window.typeLabel || ((t) => window.TYPE_LABELS[t] || "Contenido");

// Meta visible (serie/libro/otros) para cards del Home
function formatMetaLine(item) {
  const type = item?.type || "";
  const meta = item?.meta || {};

  if (type === "serie") {
    const s = Number(meta.season || 0);
    const e = Number(meta.episode || 0);
    if (s > 0 && e > 0) return `T${s} · E${e}`;
    return "";
  }

  if (type === "book") {
    const read = Number(meta.pagesRead || 0);
    const total = Number(meta.totalPages || 0);
    if (total > 0) return `${read} / ${total} páginas`;
    return "";
  }

  if (type === "pelicula" || type === "game") {
    const pct = Math.max(0, Math.min(100, Number(item?.progressPercent ?? item?.progress ?? 0)));
    return pct ? `${pct}%` : "";
  }

  return "";
}

// ===== HOME DASHBOARD RENDER (usando ApiClient) =====
function formatMinutesLabel(totalMinutes) {
  const m = totalMinutes || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  if (!rest) return `${h} h`;
  return `${h}h ${rest}m`;
}

function getWeekdayLabelEs(date = new Date()) {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dias[date.getDay()];
}

async function renderHomeDashboard() {
  try {
    const [
      stats,
      lastActivity,
      challenge,
      backlog
    ] = await Promise.all([
      ApiClient.getHomeStats(),
      ApiClient.getLastActivityDetailed(),
      ApiClient.getMonthlyChallenge(),
      ApiClient.getBacklogItems(4,7)
    ]);

    window._lastActivityForButton = lastActivity;

    // Métricas
    const weeklyTimeEl = $("#metricWeeklyTime");
    const inProgressEl = $("#metricInProgress");
    const completedEl = $("#metricCompletedYear");
    const streakEl = $("#metricStreak");
    const welcomeStreakChip = $("#welcomeStreakChip");
    const welcomeTodayTimeChip = $("#welcomeTodayTimeChip");
    const welcomeDayLabel = $("#welcomeDayLabel");
    const welcomeInProgress = $("#welcomeInProgress");
    const weeklyTodayPill = $("#metricWeeklyTodayPill");
    const completedTodayPill = $("#metricCompletedTodayPill");

    if (stats) {
      // Tiempo semana
      if (weeklyTimeEl) weeklyTimeEl.textContent = formatMinutesLabel(stats.weeklyMinutes);

      // Tiempo hoy (pill)
      if (weeklyTodayPill) {
        if (stats.todayMinutes && stats.todayMinutes > 0) {
          weeklyTodayPill.textContent = `Hoy: ${formatMinutesLabel(stats.todayMinutes)}`;
        } else {
          weeklyTodayPill.textContent = "Hoy: 0 min";
        }
      }

      // Contenidos en progreso
      if (inProgressEl) animateNumber(inProgressEl, stats.inProgressCount ?? 0);

      // Completados este año
      if (completedEl) animateNumber(completedEl, stats.completedThisYear ?? 0);

      // Completados hoy (pill)
      if (completedTodayPill) {
        const n = stats.completedToday ?? 0;
        completedTodayPill.textContent = `Hoy: ${n}`;
      }

      // Racha (UX: si es 0, estado neutro; si >0, animación)
      {
        const s = Number(stats?.streakDays ?? 0);

        if (streakEl) {
          if (s <= 0) {
            streakEl.textContent = "—";
          } else {
            animateNumber(streakEl, s, s === 1 ? " día" : " días");
          }
        }
      }

      // Chips del saludo (racha + hoy)
      if (welcomeDayLabel) {
        welcomeDayLabel.textContent = getWeekdayLabelEs(new Date());
      }

      if (welcomeTodayTimeChip) {
        const mins = Number(stats?.todayMinutes ?? 0);
        welcomeTodayTimeChip.textContent = `Hoy: ${formatMinutesLabel(mins)}`;
      }

      // Saludo (usar la misma fuente de verdad que "Continúa donde lo dejaste")
      const subtitleEl = $("#welcomeSubtitle");

      // cwAllItems viene de initContinueWatching() y ya usa status calculado por progreso
      const inProgressRealCount = Array.isArray(cwAllItems)
        ? cwAllItems.filter((it) => it.status === "in_progress").length
        : Number(stats?.inProgressCount ?? 0);

      // Número
      if (welcomeInProgress) welcomeInProgress.textContent = String(inProgressRealCount);

      // Texto coherente (0 / 1 / plural)
      if (subtitleEl) {
        if (inProgressRealCount <= 0) {
          subtitleEl.textContent = "No tienes contenidos en progreso todavía. Empieza algo en tu biblioteca.";
        } else if (inProgressRealCount === 1) {
          subtitleEl.innerHTML = `Tienes <strong>1 contenido</strong> en progreso. Sigue con tus rachas`;
        } else {
          subtitleEl.innerHTML = `Tienes <strong>${inProgressRealCount} contenidos</strong> en progreso. Sigue con tus rachas`;
        }
      }

    }

      // Chips del saludo
      if (welcomeStreakChip) {
        const s = Number(stats?.streakDays ?? 0);
        const label = `Racha: ${s} día${s === 1 ? "" : "s"}`;

        // SVGs (sin emojis)
        const svgSpark = `
          <svg class="streak-ico" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"></path>
          </svg>
        `;

        const svgFlame = `
          <svg class="streak-ico" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 22c4.4 0 8-3.1 8-7.5 0-3.2-2-5.6-3.9-7.3-1.2-1.1-2.1-2.6-2.3-4.2C12.5 4.2 11 6 10.5 7.6c-.5 1.6-.3 3.4.6 4.8-2.3-1.1-3.9-3.4-3.9-6 0 0-3.2 2.6-3.2 8.1C4 18.9 7.6 22 12 22z"></path>
          </svg>
        `;

        // clases base
        welcomeStreakChip.classList.add("streak-badge");
        welcomeStreakChip.classList.remove("is-warm", "is-hot");

        // ocultar si es menor a 3
        welcomeStreakChip.classList.toggle("is-hidden", s < 3);

        // contenido + estado visual
        if (s >= 7) {
          welcomeStreakChip.classList.add("is-hot");
          welcomeStreakChip.innerHTML = `${svgFlame}<span>${label}</span>`;
        } else if (s >= 3) {
          welcomeStreakChip.classList.add("is-warm");
          welcomeStreakChip.innerHTML = `${svgSpark}<span>${label}</span>`;
        } else {
          welcomeStreakChip.innerHTML = "";
        }

        // Pop cuando sube la racha (feedback inmediato)
        const prev = Number(welcomeStreakChip.dataset.prevStreak ?? "0");

        if (s > prev) {
          welcomeStreakChip.classList.remove("is-pop");
          void welcomeStreakChip.offsetWidth; // reinicia animación
          welcomeStreakChip.classList.add("is-pop");
          setTimeout(() => welcomeStreakChip.classList.remove("is-pop"), 220);
        }

        welcomeStreakChip.dataset.prevStreak = String(s);

      }

      if (welcomeTodayTimeChip) {
        const mins = stats.todayMinutes || 0;
        welcomeTodayTimeChip.textContent = `Hoy: ${formatMinutesLabel(mins)}`;
      }

      if (welcomeDayLabel) {
        welcomeDayLabel.textContent = getWeekdayLabelEs();
      }

      // Última actividad
    {
      const titleEl = $("#lastActivityTitle");
      const metaEl = $("#lastActivityMeta");
      const timeEl = $("#lastActivityTime");
      const barFill = $("#lastActivityProgressFill");
      const labelEl = $("#lastActivityProgressLabel");
      const coverEl = document.querySelector(".last-activity-cover");
      const typeIconEl = $("#lastActivityTypeIcon");

      const hasLast = !!(lastActivity && typeof lastActivity === "object" && lastActivity.id);

      if (!hasLast) {
        if (titleEl) titleEl.textContent = "Tu actividad aparecerá aquí";
        if (metaEl) metaEl.textContent = "Haz progreso o completa algo para ver tu último movimiento.";
        if (timeEl) timeEl.textContent = "";
        if (barFill) barFill.style.width = "0%";
        if (labelEl) labelEl.textContent = "";

        if (coverEl) coverEl.style.backgroundImage = "";
        if (typeIconEl) typeIconEl.innerHTML = getTypeIconSvg("book"); // icono neutro

      } else {
        if (titleEl) titleEl.textContent = lastActivity.title || "—";
        if (metaEl) metaEl.textContent = lastActivity.meta || "—";
        if (timeEl) timeEl.textContent = lastActivity.timeAgo || "";
        if (barFill) barFill.style.width = (lastActivity.progressPercent || 0) + "%";
        if (labelEl) labelEl.textContent = lastActivity.progressLabel || "";

        if (coverEl) {
          coverEl.style.backgroundImage = lastActivity.cover ? `url('${lastActivity.cover}')` : "";
        }

        if (typeIconEl) {
          typeIconEl.innerHTML = getTypeIconSvg(lastActivity.type);
        }
      }

      // ===== Hacer la card clicable y navegar a Biblioteca =====
      const card = document.querySelector(".last-activity-card");
      if (card) {
        // reset
        card.classList.remove("is-clickable");
        card.classList.toggle("is-empty", !hasLast);
        card.removeAttribute("role");
        card.removeAttribute("tabindex");
        card.removeAttribute("aria-label");
        card.dataset.itemId = "";

        if (hasLast) {
          card.classList.add("is-clickable");
          card.setAttribute("role", "button");
          card.setAttribute("tabindex", "0");
          card.setAttribute("aria-label", "Abrir en Mi biblioteca");
          card.dataset.itemId = String(lastActivity.id);

          const goToLibrary = () => {
            const itemId = card.dataset.itemId;
            if (!itemId) return;

            // 1) Cambiar vista
            if (window.Router && typeof window.Router.showView === "function") {
              window.Router.showView("library");
            } else {
              // fallback: simular click en la sidebar si existe
              document.querySelector('.nav-item-btn[data-view="library"]')?.click();
            }

            // 2) Esperar a que la biblioteca renderice y enfocar el item
            window.setTimeout(() => {
              // Buscar por título (bueno para filtrar rápido)
              const title = (lastActivity.title || "").trim();
              if (window.LibraryUI && typeof window.LibraryUI.setSearchTerm === "function") {
                window.LibraryUI.setSearchTerm(title);
              } else {
                // fallback: si algún día falta LibraryUI
                const global = document.getElementById("globalSearch");
                if (global) global.value = title;
              }

              // 3) Scroll + highlight por id real (si la card existe)
              const target = document.querySelector(`.lib-card[data-id="${CSS.escape(String(itemId))}"]`);
              if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "center" });
                target.classList.add("is-highlight");
                window.setTimeout(() => target.classList.remove("is-highlight"), 900);
              }
            }, 60);
          };

          // Evitar listeners duplicados: guardamos handlers en el propio nodo
          if (!card.__quackerBound) {
            card.addEventListener("click", (e) => {
              // si clicas un botón interno (ej. Progreso hecho), no navegamos
              if (e.target.closest("button")) return;
              goToLibrary();
            });

            card.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goToLibrary();
              }
            });

            card.__quackerBound = true;
          }
        }
      }
    }

    // Reto mensual
    if (challenge) {
      const titleEl = $("#challengeTitle");
      const descEl = $("#challengeDescription");
      const countEl = $("#challengeCount");
      const daysEl = $("#challengeDays");
      const barFill = $("#challengeProgressFill");
      const rewardEl = $("#challengeReward");
      const cardEl = document.querySelector(".challenge-card");

      const pct =
        challenge.target > 0
          ? Math.max(0, Math.min(100, (challenge.current / challenge.target) * 100))
          : 0;

      const isCompleted =
        challenge.target > 0 && challenge.current >= challenge.target;

      if (titleEl) titleEl.textContent = challenge.title;
      if (descEl) descEl.textContent = challenge.description;

      // Chip de progreso
      if (countEl) {
        if (isCompleted) {
          countEl.textContent = "Reto completado";
        } else {
          countEl.textContent = `${challenge.current}/${challenge.target} completados`;
        }
      }

      // Chip de días
      if (daysEl) {
        if (isCompleted) {
          daysEl.textContent = "¡Objetivo conseguido!";
        } else {
          const d = challenge.daysRemaining ?? 0;
          daysEl.textContent = d + (d === 1 ? " día restante" : " días restantes");
        }
      }

      // Barra de progreso
      if (barFill) {
        barFill.style.width = pct + "%";
        barFill.style.backgroundColor = isCompleted ? "#22c55e" : "";
      }

      // Recompensa
      if (rewardEl) {
        if (isCompleted) {
          rewardEl.textContent = `Completado · ${challenge.rewardLabel}`;
        } else {
          rewardEl.textContent = challenge.rewardLabel || "–";
        }
      }

      // Clase visual de tarjeta completada
      if (cardEl) {
        cardEl.classList.toggle("challenge-card--completed", isCompleted);
      }
    }

    // --- Estado del botón según progreso ---
    const markBtn = document.querySelector("#btnMarkLastActivity");

    if (markBtn) {
      // Guardamos el id para usarlo en el listener global
      if (lastActivity && lastActivity.id) {
        markBtn.dataset.itemId = lastActivity.id;
      } else {
        markBtn.dataset.itemId = "";
      }

      if (!lastActivity?.id) {
        markBtn.innerHTML = `
          <span class="btn-progress-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14"></path>
              <path d="M5 12h14"></path>
            </svg>
          </span>
          Sin actividad
        `;
        markBtn.disabled = true;
        markBtn.classList.remove("completed");
      } else if ((lastActivity?.progressPercent || 0) >= 100) {
        // Ya está completado
        markBtn.innerHTML = "Completado";
        markBtn.disabled = true;
        markBtn.classList.add("completed");
      } else {
        // Aún no completado
        markBtn.innerHTML = `
          <span class="btn-progress-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12l4 4 10-10"></path>
            </svg>
          </span>
          Progreso hecho
        `;
        markBtn.disabled = false;
        markBtn.classList.remove("completed");
      }
    }

    // Glow en la barra si está completado
    const barFill = $("#lastActivityProgressFill");
    const isCompleted = (lastActivity?.progressPercent || 0) >= 100;
    if (barFill) {
      barFill.classList.toggle("complete", isCompleted);
    }

    // Evitar duplicados con dato (no DOM):
    // cwVisibleIds contiene los IDs realmente visibles en “Continúa” (limit + filtros).
    const backlogClean = (backlog || []).filter((it) => {
      if (!it || !it.id) return false;
      return true;
    });

    // Backlog olvidado
    const backlogContainer = $("#backlogList");
    if (backlogContainer) {

      // Dedupe defensivo: por ID y también por (type + title)
      const seenIds = new Set();
      const seenKeys = new Set();

      const backlogUnique = (backlogClean || []).filter((it) => {
        if (!it) return false;

        // 1) Dedupe por ID (si viene duplicado desde datos)
        if (it.id) {
          if (seenIds.has(String(it.id))) return false;
          seenIds.add(String(it.id));
        }

        // 2) Dedupe por clave lógica: type + title (evita duplicados “visuales”)
        const t = String(it.type || "").trim().toLowerCase();
        const title = String(it.title || "").trim().toLowerCase();
        const key = `${t}||${title}`;

        if (!title) return false; // si no hay título, no pintamos
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);

        return true;
      });

      if (!backlogUnique || !backlogUnique.length) {
        // Empty state útil: no duplicamos “Continúa”, pero mantenemos el bloque vivo.
        // Si el usuario tiene cosas en progreso pero no cumplen “olvidado”, se lo explicamos.
        const hasInProgress = (cwAllItems || []).some((it) => {
          const pct = Number(it?.progressPercent ?? 0);
          return pct > 0 && pct < 100;
        });

        const title = hasInProgress
          ? "No tienes backlog olvidado"
          : "Todavía no hay backlog";

        const text = hasInProgress
          ? "Vas al día. Si dejas un contenido sin avanzar durante una semana, aparecerá aquí."
          : "Empieza un contenido y, si lo dejas aparcado unos días, lo verás aquí para retomarlo.";

        backlogContainer.innerHTML = `
          <div class="empty-state home-backlog-empty">
            <div class="empty-state-card" role="status" aria-live="polite">
              <div class="empty-state-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
                  <path d="M8 9h8"></path>
                  <path d="M8 13h6"></path>
                </svg>
              </div>

              <div class="empty-state-main">
                <h3 class="empty-state-title">${title}</h3>
                <p class="empty-state-text">${text}</p>

                <div class="empty-state-actions">
                  <button type="button" class="btn-secondary btn-sm" id="btnBacklogGoLibrary">
                    Ver mi biblioteca
                  </button>
                  <button type="button" class="btn-ghost btn-sm" id="btnBacklogGoExplore">
                    Explorar contenido
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        backlogContainer.innerHTML = backlogUnique
          .map((item) => {
            const typeName = item.type ? (window.typeLabel(item.type) || "Contenido") : "Contenido";
            const typeIcon = getTypeIconSvg(item.type);
            // Chip de días olvidado (limpio: sin SVG dentro del texto)
            const days = Number(item.daysSinceLast || 0);
            const isHot = days >= 14;  // 2 semanas
            const isWarm = days >= 7;  // 1 semana

            let backlogChip = "";
            if (isHot) {
              backlogChip = `<span class="backlog-chip chip-hot">${days} días</span>`;
            } else if (isWarm) {
              backlogChip = `<span class="backlog-chip chip-warm">${days} días</span>`;
            }


            const pct = Math.max(0, Math.min(100, item.progressPercent || 0));

            const progressText =
              pct >= 100
                ? "Completado"
                : `${pct}% · ${item.progressLabel || ""}`;

            const coverStyle = item.cover
              ? `style="background-image:url('${item.cover}');"`
              : "";

            return `
              <article class="backlog-card" data-id="${item.id}" data-type="${item.type || ""}">
                <div class="backlog-card-cover" ${coverStyle}></div>
                <div class="backlog-card-body">
                  
                  <div class="backlog-card-type-row">
                    <span class="backlog-type-chip">
                      ${typeIcon}
                      <span>${typeName}</span>
                    </span>
                    ${backlogChip}
                  </div>

                  <h4 class="backlog-card-title">${item.title}</h4>
                  <div class="backlog-meta">${formatMetaLine(item)}</div>

                  <div class="backlog-card-progress-text">${progressText}</div>

                  <div class="backlog-card-progress-bar">
                    <div class="backlog-card-progress-fill" style="width:${pct}%;"></div>
                  </div>

                  <button class="btn-retomar" data-id="${item.id}">
                    <span class="btn-retomar-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 4"></path>
                      </svg>
                    </span>
                    Retomar
                  </button>
                </div>
              </article>
            `;
          })
          .join("");

          // Listeners Retomar (Backlog)
          backlogContainer.querySelectorAll(".btn-retomar").forEach((btn) => {
            btn.addEventListener("click", () => {
              const id = btn.dataset.id;
              if (!id) return;

              const card = btn.closest(".backlog-card");
              if (!card) return;

              retomarItem(id, card);
            });
          });

      }
      // Navegación desde empty state (si existe)
      const btnGoLib = document.getElementById("btnBacklogGoLibrary");
      if (btnGoLib) {
        btnGoLib.onclick = () => {
          const btn = document.querySelector('.nav-item-btn[data-view="library"]');
          if (btn) btn.click();
        };
      }

      const btnGoExplore = document.getElementById("btnBacklogGoExplore");
      if (btnGoExplore) {
        btnGoExplore.onclick = () => {
          const btn = document.querySelector('.nav-item-btn[data-view="explore"]');
          if (btn) btn.click();
        };
      }
    }
  } catch (err) {
    console.error("Error al renderizar el dashboard de inicio", err);
  }

}

  function animateNumber(el, to, suffix = "", duration = 400) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const target = typeof to === "number" ? to : parseInt(to, 10) || 0;

    function frame(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const value = Math.round(start + (target - start) * progress);
      el.textContent = value + suffix;
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }


    // ===== CONTINÚA DONDE LO DEJASTE =====
  const CONTINUE_LIMIT = 4; // <-- ajusta a 6, 8, 10...
  const continueGrid = $("#continueGrid");
  const cwTypeButtons = $all(".cw-type-pill");
  const cwStatusButtons = $all(".cw-status-pill");
  const continueCountLabel = $("#continueCountLabel");

  let cwAllItems = [];
  let cwVisibleIds = new Set();
  let cwTypeFilter = "all";
  let cwStatusFilter = "in_progress";
  let lastResumedItemId = null;

  function renderContinueSkeleton(count = CONTINUE_LIMIT) {
    if (!continueGrid) return;

    const n = Math.max(1, Math.min(8, Number(count) || CONTINUE_LIMIT));

    continueGrid.innerHTML = Array.from({ length: n })
      .map(() => {
        return `
          <article class="cw-card cw-card--skeleton" aria-hidden="true">
            <div class="cw-cover skel"></div>
            <div class="cw-body">
              <div class="cw-skel-chip skel"></div>
              <div class="cw-skel-line lg skel" style="width: 78%;"></div>
              <div class="cw-skel-line sm skel"></div>
              <div class="cw-skel-line skel" style="width: 92%;"></div>
              <div class="cw-skel-line skel" style="width: 88%;"></div>
              <div class="cw-footer-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div class="cw-skel-line sm skel" style="width: 48px;"></div>
                <div class="cw-skel-btn skel"></div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderBacklogSkeleton(count = 3) {
    const backlogContainer = document.querySelector("#backlogList");
    if (!backlogContainer) return;

    const n = Math.max(1, Math.min(6, Number(count) || 3));

    backlogContainer.innerHTML = Array.from({ length: n })
      .map(() => {
        return `
          <article class="backlog-card backlog-card--skeleton" aria-hidden="true">
            <div class="backlog-card-cover skel"></div>
            <div class="backlog-card-body">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div class="bg-skel-chip skel"></div>
                <div class="bg-skel-line sm skel" style="width: 64px;"></div>
              </div>

              <div class="bg-skel-line lg skel" style="width: 82%;"></div>
              <div class="bg-skel-line sm skel"></div>

              <div class="bg-skel-line skel" style="width: 96%;"></div>
              <div class="bg-skel-line skel" style="width: 90%;"></div>

              <div class="bg-skel-btn skel"></div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function getTypeIconSvg(type) {
    switch (type) {
      case "serie":
        // Pantalla / TV
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="12" rx="2"></rect>
            <path d="M8 19h8"></path>
          </svg>
        `;
      case "pelicula":
        // Claqueta
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="2"></rect>
            <path d="M3 7l3-4 4 4 3-4 4 4 3-4"></path>
          </svg>
        `;
      case "book":
        // Libro abierto
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3-3V5z"></path>
            <path d="M20 5h-7a3 3 0 0 0-3 3v11h7a3 3 0 0 1 3-3V5z"></path>
          </svg>
        `;
      case "game":
        // Mando
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 15l2-2h8l2 2"></path>
            <path d="M7 9h2"></path>
            <path d="M8 8v2"></path>
            <circle cx="16.5" cy="9.5" r="1"></circle>
            <circle cx="19" cy="11" r="1"></circle>
          </svg>
        `;
      default:
        // Contenido genérico
        return `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3"></rect>
          </svg>
        `;
    }
  }

  function statusMatches(item, statusFilter) {
    if (statusFilter === "in_progress") {
      return ["watching", "reading", "playing", "in_progress"].includes(item.status);
    }
    if (statusFilter === "not_started") {
      return item.status === "not_started";
    }
    if (statusFilter === "completed") {
      return item.status === "completed";
    }
    return true;
  }

  // ===== HELPER GENERAL: aplicar progreso rápido a un contenido (con Deshacer) =====
  async function applyProgressTick(itemId, sourceBtn = null) {
    if (!itemId) return;

    // Evitar doble click si el mismo botón dispara varias veces
    if (sourceBtn && sourceBtn.dataset.busy === "1") return;
    if (sourceBtn) sourceBtn.dataset.busy = "1";

    // Snapshot antes del cambio (para Deshacer)
    let snapshotBefore = null;
    try {
      snapshotBefore = await ApiClient.getLibraryItemById(itemId);
      if (!snapshotBefore || !snapshotBefore.id) snapshotBefore = null;
    } catch (e) {
      snapshotBefore = null;
    }

    // Estado visual del botón (si lo tenemos)
    const prevHtml = sourceBtn ? sourceBtn.innerHTML : null;
    if (sourceBtn) {
      sourceBtn.disabled = true;
      sourceBtn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Actualizando…</span>
      `;
    }

    try {
      // Marca temporal para deshacer activities creadas por ESTE click (racha/estadísticas coherentes)
      const sinceIso = new Date(Date.now() - 2000).toISOString();

      // Nuevo motor: progreso rápido por tipo
      const res = await (ApiClient.applyQuickProgress
        ? ApiClient.applyQuickProgress(itemId)
        : ApiClient.progressLibraryItem(itemId, 5)
      );

      const title = res?.justCompleted ? "Contenido completado" : "Progreso actualizado";
      const message = res?.justCompleted
        ? "Se ha marcado como finalizado."
        : (res?.deltaLabel ? `Actualizado: ${res.deltaLabel}` : "Progreso actualizado");

      if (res?.justCompleted) {
        playCompleteFx(itemId);
      }

      window.toast?.({
        title,
        message,
        type: res?.justCompleted ? "success" : "info",
        duration: 5200,
        actionLabel: snapshotBefore ? "Deshacer" : null,
        onAction: snapshotBefore
          ? async () => {
              try {
                await ApiClient.updateLibraryItem(snapshotBefore, { logActivity: false });

                // Importante: borrar las activities generadas por el progreso rápido
                if (ApiClient.undoActivitiesForItemSince) {
                  await ApiClient.undoActivitiesForItemSince(itemId, sinceIso);
                }

                // UI: si quedó una card optimista/pending en "Continúa", la quitamos ya
                const pending = document.querySelector(`.cw-card.is-pending[data-id="${CSS.escape(String(itemId))}"]`);
                if (pending) pending.remove();

                // Evitar highlight si se deshace
                if (lastResumedItemId === itemId) lastResumedItemId = null;

                window.toast?.({
                  title: "Cambios revertidos",
                  message: "Se ha restaurado el estado anterior.",
                  type: "success",
                  duration: 2400
                });
              } catch (e) {
                console.error(e);
                window.toast?.({
                  title: "No se pudo deshacer",
                  message: "Inténtalo de nuevo.",
                  type: "error",
                  duration: 3200
                });
              }
            }
          : null
      });

      // No refrescamos manualmente:
      // ApiClient emite "quacker:data-changed" y app-core dispara "quacker:home-refresh"

    } catch (e) {
      console.error(e);
      window.toast?.({
        title: "No se pudo guardar",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3600
      });
    } finally {
      if (sourceBtn) {
        sourceBtn.disabled = false;
        sourceBtn.dataset.busy = "0";
        // La UI real se re-renderiza con eventos; pero restauramos el HTML por si tarda un frame
        sourceBtn.innerHTML = prevHtml || sourceBtn.innerHTML;
      }
    }
  }

  function playCompleteFx(itemId) {
    // 1) Botón de última actividad (si coincide)
    const lastBtn = document.querySelector("#btnMarkLastActivity");
    if (lastBtn && String(lastBtn.dataset.itemId) === String(itemId)) {
      lastBtn.classList.remove("btn-complete-fx");
      void lastBtn.offsetWidth;
      lastBtn.classList.add("btn-complete-fx");

      const bar = document.querySelector("#lastActivityProgressFill");
      if (bar) {
        bar.classList.remove("complete-fx-bar");
        void bar.offsetWidth;
        bar.classList.add("complete-fx-bar");
      }
    }

    // 2) Card del grid “Continúa donde lo dejaste”
    const cwCard = document.querySelector(`.cw-card[data-id="${itemId}"]`);
    if (cwCard) {
      cwCard.classList.remove("complete-fx");
      void cwCard.offsetWidth;
      cwCard.classList.add("complete-fx");
    }

    // 3) Botón “Progreso hecho” del grid
    const cwBtn = document.querySelector(`.cw-tick-btn[data-id="${itemId}"]`);
    if (cwBtn) {
      cwBtn.classList.remove("btn-complete-fx");
      void cwBtn.offsetWidth;
      cwBtn.classList.add("btn-complete-fx");
    }

    // Limpieza por si se queda pegada la clase
    setTimeout(() => {
      if (cwCard) cwCard.classList.remove("complete-fx");
      if (cwBtn) cwBtn.classList.remove("btn-complete-fx");
      if (lastBtn) lastBtn.classList.remove("btn-complete-fx");
      const bar = document.querySelector("#lastActivityProgressFill");
      if (bar) bar.classList.remove("complete-fx-bar");
    }, 700);
  }

  // Helper defensivo (por si no existe en este archivo)
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function retomarItem(itemId, card) {
    if (!itemId || !card) return;

    // Evitar doble click
    if (card.dataset.busy === "1") return;
    card.dataset.busy = "1";

    // Snapshot del item ANTES de tocar nada (para Deshacer)

    // Marca de tiempo para deshacer: debe capturarse antes de cualquier operación async
    // para poder revertir con precisión las activities creadas por este flujo.
    const undoSinceIso = new Date().toISOString();

    let snapshotBefore = null;
    try {
      snapshotBefore = await ApiClient.getLibraryItemById(itemId);
      if (!snapshotBefore || !snapshotBefore.id) snapshotBefore = null;
    } catch (_) {
      snapshotBefore = null;
    }

    const btn = card.querySelector(".btn-retomar");
    const prevBtnHtml = btn ? btn.innerHTML : "";

    if (btn && btn.dataset.busy === "1") return;
    if (btn) btn.dataset.busy = "1";

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Retomando…</span>
      `;
    }

    // Animación de salida
    card.classList.add("is-removing");

    try {
      await new Promise((r) => setTimeout(r, 220));

      // 1) Marcar como retomado (no cuenta para racha)
      const resumeRes = await ApiClient.resumeLibraryItem(itemId);
      if (!resumeRes || resumeRes.ok !== true) {
        throw new Error(resumeRes?.reason || "resume_failed");
      }

      // 2) Aplicar mini progreso real (sí cuenta para racha)
      const progRes = await (ApiClient.applyQuickProgress
        ? ApiClient.applyQuickProgress(itemId)
        : ApiClient.progressLibraryItem(itemId, 5)
      );
      if (!progRes || progRes.ok !== true) {
        throw new Error(progRes?.reason || "quick_progress_failed");
      }

      // No quitamos la card manualmente.
      // ApiClient emite "quacker:data-changed" y app-core refresca Home (quacker:home-refresh).

      const days = Math.max(0, Number(resumeRes?.daysSinceLast ?? 0));
      const delta = progRes?.deltaLabel
        ? `Actualizado: ${progRes.deltaLabel}`
        : "Progreso actualizado";

      const toastTitle = progRes?.justCompleted
        ? "Contenido completado"
        : (days >= 7 ? `Retomado tras ${days} días` : "Contenido retomado");

      const toastMessage = progRes?.justCompleted
        ? "Se ha marcado como finalizado."
        : delta;

      window.toast?.({
        title: toastTitle,
        message: toastMessage,
        type: "success",
        duration: 5200,
        actionLabel: snapshotBefore ? "Deshacer" : null,
        onAction: snapshotBefore
          ? async () => {
              try {
                // 1) Restaurar el item sin crear nueva activity
                await ApiClient.updateLibraryItem(snapshotBefore, { logActivity: false });

                // Feedback defensivo: si quedara alguna card "pending" por estados anteriores, la retiramos.
                try {
                  const safeId = (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);
                  const pending = document.querySelector(`#continueGrid .cw-card.is-pending[data-id="${safeId}"]`);
                  if (pending && pending.parentElement) pending.remove();
                } catch (_) {
                  // defensivo
                }
                // 2) Eliminar las activities creadas por el flujo "Retomar"
                if (ApiClient.transport !== "http" && ApiClient.undoActivitiesForItemSince) {
                  const undoActsRes = await ApiClient.undoActivitiesForItemSince(itemId, undoSinceIso);
                  if (undoActsRes && undoActsRes.ok === false) {
                    throw new Error(undoActsRes.reason || "undo_activities_failed");
                  }
                }

                window.toast?.({
                  title: "Cambios revertidos",
                  message: "Se ha restaurado el estado anterior.",
                  type: "success",
                  duration: 2400
                });
              } catch (e) {
                console.error(e);
                window.toast?.({
                  title: "No se pudo deshacer",
                  message: "Inténtalo de nuevo.",
                  type: "error",
                  duration: 3200
                });
              }
            }
          : null
      });

      lastResumedItemId = itemId;

    } catch (err) {

      card.classList.remove("is-removing");

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prevBtnHtml || "Retomar";
      }

      if (btn) btn.dataset.busy = "0";
      
      card.dataset.busy = "0";

      // No reinsertamos HTML ni re-enganchamos listeners.
      // Si algo falla, restauramos estado visual y el render oficial (home-refresh) se encargará del DOM.

      window.toast?.({
        title: "No se pudo retomar",
        message: "Inténtalo de nuevo.",
        type: "error",
        duration: 3600
      });

      console.error("[Home] resumeLibraryItem failed", err);
    }
  }

  function renderContinueWatching() {
    if (!continueGrid) return;

    let items = cwAllItems.slice();

    // Filtros (con progreso real)
    items = items.filter((item) => {
      const pct = Number(item.progressPercent ?? 0);

      // Tipo
      if (cwTypeFilter !== "all" && item.type !== cwTypeFilter) return false;

      // Estado basado en progreso real
      if (cwStatusFilter === "in_progress") {
        // SOLO 1..99
        if (!(pct > 0 && pct < 100)) return false;
      } else if (cwStatusFilter === "not_started") {
        // SOLO 0
        if (!(pct <= 0)) return false;
      } else if (cwStatusFilter === "completed") {
        // SOLO 100
        if (!(pct >= 100 || item.status === "completed")) return false;
      } else {
        // all -> no hacemos nada
      }

      // Además, respetamos tu statusMatches por compatibilidad
      if (!statusMatches(item, cwStatusFilter)) return false;

      return true;
    });

    // Ordenar por última actividad (más reciente primero)
    items.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
    const total = items.length;
    const showAllBtn = document.getElementById("btnGoLibraryFromContinue");
    const hasMoreThanLimit = total > CONTINUE_LIMIT;
    const visibleItems = items.slice(0, CONTINUE_LIMIT);

    // Guardar IDs visibles (los que realmente se pintan en "Continúa")
    cwVisibleIds = new Set(visibleItems.map((it) => it.id));

    // Contador
    if (continueCountLabel) {
      continueCountLabel.textContent =
        total + (total === 1 ? " contenido" : " contenidos");
    }

    // Botón "Ver todo"
    if (showAllBtn) {
      showAllBtn.style.display = hasMoreThanLimit ? "inline-flex" : "none";
    }

    if (!total) {
      const hasLibraryItems = Array.isArray(cwAllItems) && cwAllItems.length > 0;
      const isFilteredView = cwTypeFilter !== "all" || cwStatusFilter !== "in_progress";

      const emptyTitle = hasLibraryItems
        ? (isFilteredView ? "No hay resultados para este filtro" : "No tienes nada para continuar")
        : "Tu zona de Continue está vacía";

      const emptyText = hasLibraryItems
        ? (isFilteredView
            ? "Prueba a cambiar el tipo o el estado para ver otros contenidos."
            : "Cuando avances en una serie, película, libro o videojuego, aparecerá aquí para que puedas retomarlo rápido.")
        : "Añade contenido a tu biblioteca y haz progreso en algo para verlo aquí.";

      const primaryActionHtml = isFilteredView
        ? `
            <button type="button" class="btn-primary btn-sm" id="btnContinueResetFilters">
              Restablecer filtros
            </button>
          `
        : `
            <button type="button" class="btn-primary btn-sm" id="btnContinueGoLibrary">
              Ver mi biblioteca
            </button>
          `;

      const secondaryActionHtml = `
        <button type="button" class="btn-secondary btn-sm" id="btnContinueGoExplore">
          Explorar contenido
        </button>
      `;

      continueGrid.innerHTML = `
        <div class="empty-state home-continue-empty">
          <div class="empty-state-card" role="status" aria-live="polite">
            <div class="empty-state-icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 17A2.5 2.5 0 0 0 4 14.5V6.5A2.5 2.5 0 0 1 6.5 4H20v13"></path>
              </svg>
            </div>

            <div class="empty-state-main">
              <h3 class="empty-state-title">${emptyTitle}</h3>
              <p class="empty-state-text">${emptyText}</p>

              <div class="empty-state-actions">
                ${primaryActionHtml}
                ${secondaryActionHtml}
              </div>
            </div>
          </div>
        </div>
      `;

      const btnContinueResetFilters = document.getElementById("btnContinueResetFilters");
      if (btnContinueResetFilters) {
        btnContinueResetFilters.addEventListener("click", () => {
          cwTypeFilter = "all";
          cwStatusFilter = "in_progress";

          document.querySelectorAll(".cw-type-pill").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.type === "all");
          });

          document.querySelectorAll(".cw-status-pill").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.status === "in_progress");
          });

          renderContinueWatching();
        });
      }

      const btnContinueGoLibrary = document.getElementById("btnContinueGoLibrary");
      if (btnContinueGoLibrary) {
        btnContinueGoLibrary.addEventListener("click", () => {
          const libraryBtn = document.querySelector('.nav-item-btn[data-view="library"]');
          if (libraryBtn) libraryBtn.click();
          document.querySelector("main.app-main")?.scrollTo({ top: 0, behavior: "smooth" });
        });
      }

      const btnContinueGoExplore = document.getElementById("btnContinueGoExplore");
      if (btnContinueGoExplore) {
        btnContinueGoExplore.addEventListener("click", () => {
          const exploreBtn = document.querySelector('.nav-item-btn[data-view="explore"]');
          if (exploreBtn) exploreBtn.click();
          document.querySelector("main.app-main")?.scrollTo({ top: 0, behavior: "smooth" });
        });
      }

      return;
    }

    continueGrid.innerHTML = visibleItems
    .map((item) => {
      const pct = Math.max(0, Math.min(100, item.progressPercent || 0));
      const disabled = pct >= 100 ? "disabled" : "";
      const completedClass = pct >= 100 ? " cw-card--completed" : "";
      const typeChipClass = `cw-type-chip cw-type-chip--${item.type || "other"}`;
      const platformHtml = item.platform
        ? `<span class="cw-platform-pill">${item.platform}</span>`
        : "";
      const footerLabel = pct >= 100 ? "Completado" : `${pct}%`;
      const isCompleted = pct >= 100;
      const typeIconSvg = getTypeIconSvg(item.type);
      const buttonInnerHtml = isCompleted
        ? "Completado"
        : `
            <span class="cw-tick-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12l4 4 10-10"></path>
              </svg>
            </span>
            Progreso hecho
          `;

      return `
      <article class="cw-card${completedClass}" data-id="${item.id}">
        <div class="cw-cover" style="background-image:url('${item.cover || ""}');"></div>
        <div class="cw-body">
          <div class="${typeChipClass}">
            ${typeIconSvg}
            <span>${typeLabel(item.type)}</span>
          </div>
          <div class="cw-title-row">
            <div class="cw-title-with-icon">
              <div class="cw-title">${item.title}</div>
            </div>
            ${platformHtml}
          </div>
          <div class="cw-meta">${formatMetaLine(item)}</div>
          <div class="cw-progress-label">${item.progressLabel}</div>
          <div class="cw-progress-bar">
            <div class="cw-progress-fill" style="width:${pct}%;"></div>
          </div>
          <div class="cw-footer-row">
            <span>${footerLabel}</span>
            <button class="cw-tick-btn" data-id="${item.id}" ${disabled}>
              ${buttonInnerHtml}
            </button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

    // Micro-feedback: resaltar el item retomado cuando aparece en "Continúa..."
    if (lastResumedItemId) {
      const el = continueGrid.querySelector(`.cw-card[data-id="${lastResumedItemId}"]`);

      if (el) {
        el.classList.remove("is-highlight");
        void el.offsetWidth; // reinicia animación
        el.classList.add("is-highlight");

        // Scroll suave solo si no está visible
        const rect = el.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      // Importante: limpiar para que solo ocurra una vez
      lastResumedItemId = null;
    }

    // Listeners de los ticks
    continueGrid.querySelectorAll(".cw-tick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (!id) return;
        if (btn.disabled) return;
        if (btn.dataset.busy === "1") return;

        // --- 1) ANIMACIÓN POP SUAVE DEL BOTÓN ---
        btn.classList.remove("btn-progress-anim");
        void btn.offsetWidth; // reinicia animación
        btn.classList.add("btn-progress-anim");

        // --- 2) LÓGICA DEL PROGRESO ---
        applyProgressTick(id, btn);

        // (El re-render lo hace applyProgressTick internamente)
      });
    });
  }

  async function initContinueWatching() {
    try {
      cwAllItems = await ApiClient.getContinueWatchingItems();

      // Orden inteligente: más reciente primero
      cwAllItems.sort((a, b) => {
        const ap = Number(a.progressPercent ?? 0);
        const bp = Number(b.progressPercent ?? 0);

        const aBucket = ap >= 100 ? 2 : ap <= 0 ? 1 : 0; // 0=in_progress,1=not_started,2=completed
        const bBucket = bp >= 100 ? 2 : bp <= 0 ? 1 : 0;

        if (aBucket !== bBucket) return aBucket - bBucket;

        const aDate = new Date(a.lastActivityAt || a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.lastActivityAt || b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });

      renderContinueWatching();
    } catch (e) {
      console.error("Error cargando 'Continúa donde lo dejaste'", e);

      if (continueGrid) {
        continueGrid.innerHTML = `
          <div class="empty-card">
            <div class="empty-card-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10z"></path>
                <path d="M12 8v5"></path>
                <path d="M12 16h.01"></path>
              </svg>
            </div>
            <div class="empty-card-main">
              <div class="empty-card-title">No se pudo cargar</div>
              <div class="empty-card-text">Vuelve a intentarlo recargando la vista.</div>
            </div>
          </div>
        `;
      }
    }
  }

  // ===== INITS HOME =====

  // Anti-parpadeo: agrupar refreshs si llegan en ráfaga
  let __homeRefreshInFlight = false;
  let __homeRefreshQueued = false;

  async function refreshHomeIfActive(opts = {}) {
    const isHomeActive = document.querySelector("#view-home")?.classList.contains("is-active");
    if (!isHomeActive) return;

    // Si ya hay un refresh corriendo, lo encolamos (evita doble repintado)
    if (__homeRefreshInFlight) {
      __homeRefreshQueued = true;
      return;
    }
    __homeRefreshInFlight = true;

    // Estado visual mínimo mientras carga (sin recargar página)
    const weeklyTimeEl = document.querySelector("#metricWeeklyTime");
    const inProgressEl = document.querySelector("#metricInProgress");
    const completedYearEl = document.querySelector("#metricCompletedYear");
    const streakEl = document.querySelector("#metricStreak");

    function setMetricLoading(el, on) {
      if (!el) return;
      if (on) {
        el.classList.add("is-skeleton");
        // texto “base” para evitar saltos de ancho antes de que el CSS aplique
        el.textContent = "000";
      } else {
        el.classList.remove("is-skeleton");
      }
    }

    if (!opts.silent) {
      setMetricLoading(weeklyTimeEl, true);
      setMetricLoading(inProgressEl, true);
      setMetricLoading(completedYearEl, true);
      setMetricLoading(streakEl, true);
    }

    try {
      
      // Soft refresh: si ya hay contenido pintado, NO metemos skeletons otra vez (evita parpadeo)
      const backlogContainer = document.querySelector("#backlogList");

      const hasContinueContent = !!(continueGrid && (
        continueGrid.querySelector(".cw-card:not(.cw-card--skeleton)") ||
        continueGrid.querySelector(".empty-state, .empty-card")
      ));

      const hasBacklogContent = !!(backlogContainer && (
        backlogContainer.querySelector(".backlog-card:not(.backlog-card--skeleton)") ||
        backlogContainer.querySelector(".empty-card")
      ));

      // Solo usamos skeletons si NO es silent y todavía no hay contenido real visible
      const shouldUseSkeletons = !opts.silent && !(hasContinueContent && hasBacklogContent);

      if (shouldUseSkeletons) {
        renderContinueSkeleton(CONTINUE_LIMIT);
        renderBacklogSkeleton(3);
      } else {
        // Feedback mínimo mientras refresca (sin borrar contenido)
        continueGrid?.classList.add("is-loading");
        backlogContainer?.classList.add("is-loading");
      }

      // 1) Primero pinta “Continúa…” (y rellena cwVisibleIds)
      await initContinueWatching();

      // 2) Después pinta métricas + última actividad + backlog (sin duplicar)
      await renderHomeDashboard();

      setMetricLoading(weeklyTimeEl, false);
      setMetricLoading(inProgressEl, false);
      setMetricLoading(completedYearEl, false);
      setMetricLoading(streakEl, false);

    } catch (e) {
      console.error(e);

      setMetricLoading(weeklyTimeEl, false);
      setMetricLoading(inProgressEl, false);
      setMetricLoading(completedYearEl, false);
      setMetricLoading(streakEl, false);

      // Si falla, vuelve a un estado neutro (defensivo)
      if (weeklyTimeEl) weeklyTimeEl.textContent = "–";
      if (inProgressEl) inProgressEl.textContent = "–";
      if (completedYearEl) completedYearEl.textContent = "–";
      if (streakEl) streakEl.textContent = "–";
    } finally {
      // Quitar estados de loading suaves (si se pusieron)
      continueGrid?.classList.remove("is-loading");
      document.querySelector("#backlogList")?.classList.remove("is-loading");

      // Liberar el lock del refresh
      __homeRefreshInFlight = false;

      // Si llegó otro refresh mientras estábamos pintando, lanzamos UNO más (silencioso)
      if (__homeRefreshQueued) {
        __homeRefreshQueued = false;
        refreshHomeIfActive({ silent: true }).catch(console.error);
      }
    }
  }

  // ===== Modal: Actividad (toda la actividad) =====
  let __activityFilter = "all";
  let __activityLastFocusEl = null;

  function __isActivityModalOpen() {
    const modal = document.getElementById("activityModal");
    return !!(modal && modal.classList.contains("is-open"));
  }

  let __activityRefreshQueued = false;

  function __refreshActivityModalIfOpen() {
    if (!__isActivityModalOpen()) return;
    if (__activityRefreshQueued) return;

    __activityRefreshQueued = true;

    // Micro-debounce para agrupar varios "home-refresh" seguidos
    requestAnimationFrame(() => {
      __activityRefreshQueued = false;
      __renderActivityModal({ preserveScroll: true, soft: true }).catch(console.error);
    });
  }

  function __activityIconSvg(type) {
    if (type === "completed") {
      return `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
      `;
    }
    // progress
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 6v6l4 2"></path>
        <circle cx="12" cy="12" r="9"></circle>
      </svg>
    `;
  }

async function __renderActivityModal({ preserveScroll = false, soft = false } = {}) {
  const activityList = document.getElementById("activityList");
  const activityEmpty = document.getElementById("activityEmpty");
  const activityLoading = document.getElementById("activityLoading");

  if (!activityList || !activityEmpty) return;

  if (typeof ApiClient === "undefined" || typeof ApiClient.getRecentActivitiesDetailed !== "function") {
    if (activityLoading) activityLoading.hidden = true;
    activityList.innerHTML = "";
    activityEmpty.hidden = false;
    return;
  }

  // "Todo" no se pasa como "all" al ApiClient
  const apiFilter = __activityFilter === "all" ? undefined : __activityFilter;

  const prevScrollTop = preserveScroll ? activityList.scrollTop : 0;

  try {
    // Estado: loading suave
    if (activityLoading) activityLoading.hidden = false;
    activityEmpty.hidden = true;

    // Soft refresh: NO vaciamos la lista al inicio (evita parpadeo)
    if (soft) {
      activityList.classList.add("is-loading");
    } else {
      activityList.innerHTML = "";
    }

    const items = await ApiClient.getRecentActivitiesDetailed(40, apiFilter);

    if (!items || items.length === 0) {
      activityList.innerHTML = "";
      activityEmpty.hidden = false;
      if (activityLoading) activityLoading.hidden = true;
      activityList.classList.remove("is-loading");
      return;
    }

    activityEmpty.hidden = true;
    if (activityLoading) activityLoading.hidden = true;

    activityList.innerHTML = items
      .map((a) => {
        const meta = [a.label, a.itemMeta].filter(Boolean).join(" · ");
        return `
          <div class="activity-row" role="button" tabindex="0" data-item-id="${escapeHtml(a.targetId || "")}">
            <div class="activity-ico">${__activityIconSvg(a.type)}</div>
            <div class="activity-main">
              <p class="activity-title">${escapeHtml(a.itemTitle || "Contenido")}</p>
              <p class="activity-meta">${escapeHtml(meta)}</p>
            </div>
            <div class="activity-time">${escapeHtml(a.timeAgo || "")}</div>
          </div>
        `;
      })
      .join("");

    activityList.classList.remove("is-loading");

    // Restaurar scroll si procede
    if (preserveScroll) {
      activityList.scrollTop = prevScrollTop;
    }
  } catch (err) {
    console.error(err);

    if (activityLoading) activityLoading.hidden = true;

    activityList.classList.remove("is-loading");
    activityList.innerHTML = "";
    activityEmpty.hidden = false;
  }
}

function __openActivityModal() {
  const modal = document.getElementById("activityModal");
  if (!modal) return;

  __activityLastFocusEl = document.activeElement;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  // Reset a "Todo" al abrir
  __activityFilter = "all";
  document.querySelectorAll("[data-activity-filter]").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-activity-filter="all"]')?.classList.add("active");

  __renderActivityModal().catch(console.error);

  window.setTimeout(() => {
    document.getElementById("closeActivityModal")?.focus();
  }, 0);
}

function __closeActivityModal({ restoreFocus = true } = {}) {
  const modal = document.getElementById("activityModal");
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");

  if (restoreFocus) {
    const el = __activityLastFocusEl;
    if (el && typeof el.focus === "function") window.setTimeout(() => el.focus(), 0);
  }
}

window.HomeUI = {
    init() {
    // Evitar doble init
    if (window.HomeUI?._inited) return;
    window.HomeUI._inited = true;

    // ===== Home: listeners principales (solo una vez) =====

    // Filtros de "Continúa donde lo dejaste"
    cwTypeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        cwTypeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        cwTypeFilter = btn.dataset.type || "all";
        renderContinueWatching();
      });
    });

    cwStatusButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        cwStatusButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        cwStatusFilter = btn.dataset.status || "in_progress";
        renderContinueWatching();
      });
    });

    // Cada vez que volvemos a Home
    document.addEventListener("quacker:view-change", (e) => {
      if (e.detail?.viewId === "home") {
        refreshHomeIfActive();
      }
    });

    document.addEventListener("quacker:home-refresh", () => {
      refreshHomeIfActive();
      __refreshActivityModalIfOpen();
    });

    // Render inicial defensivo (por si el router aún no disparó el primer view-change)
    refreshHomeIfActive();

    // Botón "Ver todo" -> ir a Mi Biblioteca
    const btnGoLibraryFromContinue = document.getElementById("btnGoLibraryFromContinue");
    if (btnGoLibraryFromContinue) {
      btnGoLibraryFromContinue.addEventListener("click", () => {
        const libraryBtn = document.querySelector('.nav-item-btn[data-view="library"]');
        if (libraryBtn) libraryBtn.click();
        document.querySelector("main.app-main")?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Botón de "Progreso hecho" en Última actividad
    const markLastActivityBtn = document.querySelector("#btnMarkLastActivity");
    if (markLastActivityBtn) {
      markLastActivityBtn.addEventListener("click", () => {
        // Guard clauses (premium): si está deshabilitado o ocupado, no hacemos nada
        if (markLastActivityBtn.disabled) return;
        if (markLastActivityBtn.dataset.busy === "1") return;

        const itemId = markLastActivityBtn.dataset.itemId;
        if (!itemId) return;

        // Micro-FX solo si realmente vamos a ejecutar la acción
        markLastActivityBtn.classList.remove("btn-progress-anim");
        void markLastActivityBtn.offsetWidth;
        markLastActivityBtn.classList.add("btn-progress-anim");

        applyProgressTick(itemId, markLastActivityBtn);
      });
    }

    function __jumpToLibraryFromActivity({ itemId, searchText }) {
      if (!itemId) return;

      // 1) Ir a Biblioteca
      if (window.Router?.showView) window.Router.showView("library");

      // 2) Aplicar búsqueda en globalSearch + LibraryUI (sin depender solo de eventos)
      const global = document.getElementById("globalSearch");
      const text = (searchText || "").trim();

      // Esperamos un tick para asegurar que Router ya habilitó el input y que Biblioteca está activa
      window.setTimeout(() => {
        if (global) {
          global.value = text;
          // Disparamos input para reusar el listener existente en library.js
          global.dispatchEvent(new Event("input", { bubbles: true }));
          global.focus();
          if (typeof global.select === "function") global.select();
        }

        // Además, si existe el API público, lo aplicamos directamente (más robusto)
        if (window.LibraryUI?.setSearchTerm) {
          window.LibraryUI.setSearchTerm(text);
        }

        // 3) Scroll + highlight del card (con reintentos suaves por si aún no se pintó)
        const safeId = (window.CSS && CSS.escape) ? CSS.escape(String(itemId)) : String(itemId);

        let tries = 0;
        const maxTries = 10;

        const tryFind = () => {
          tries += 1;

          const target = document.querySelector(`.lib-card[data-id="${safeId}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.remove("is-highlight");
            void target.offsetWidth;
            target.classList.add("is-highlight");
            window.setTimeout(() => target.classList.remove("is-highlight"), 950);
            return;
          }

          if (tries < maxTries) {
            requestAnimationFrame(tryFind);
          }
        };

        requestAnimationFrame(tryFind);
      }, 60);
    }

    // Modal Activity: listeners (solo una vez)
    if (!document.__quackerActivityModalBound) {

      // Botón "Ver toda la actividad" (ojo)
      const btnViewAllActivity = document.getElementById("btnViewAllActivity");
      if (btnViewAllActivity) {
        btnViewAllActivity.addEventListener("click", () => {
          __openActivityModal();
        });
      }

      // Cierres del modal
      document.getElementById("closeActivityModal")?.addEventListener("click", () => __closeActivityModal());
      document.getElementById("closeActivityModalFooter")?.addEventListener("click", () => __closeActivityModal());

      // Click fuera
      document.getElementById("activityModal")?.addEventListener("click", (e) => {
        if (e.target && e.target.id === "activityModal") __closeActivityModal({ restoreFocus: false });
      });

      // Filtros
      document.querySelectorAll("[data-activity-filter]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          document.querySelectorAll("[data-activity-filter]").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          __activityFilter = btn.dataset.activityFilter || "all";
          await __renderActivityModal();
        });
      });

      // Click en fila -> ir a Biblioteca + buscar + highlight
      document.getElementById("activityList")?.addEventListener("click", (e) => {
        const row = e.target.closest(".activity-row");
        if (!row) return;

        const itemId = row.dataset.itemId;
        if (!itemId) return;

        const titleEl = row.querySelector(".activity-title");
        const searchText = (titleEl?.textContent || "").trim();

        __closeActivityModal({ restoreFocus: false });

        __jumpToLibraryFromActivity({ itemId, searchText });
      });

      // Teclado en filas
      document.getElementById("activityList")?.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const row = e.target.closest(".activity-row");
        if (!row) return;
        e.preventDefault();
        row.click();
      });

      document.__quackerActivityModalBound = true;
    }

  },
  refresh: refreshHomeIfActive
};
