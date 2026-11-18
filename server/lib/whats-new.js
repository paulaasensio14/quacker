export function normalizeWhatsNewUiState(ui) {
  const safeUi =
    ui &&
    typeof ui === "object" &&
    !Array.isArray(ui)
      ? ui
      : {};

  const lastSeenVersion =
    typeof safeUi.lastSeenVersion === "string"
      ? safeUi.lastSeenVersion.trim()
      : "";

  return {
    lastSeenVersion
  };
}

export function resolveWhatsNewRelease({
  currentVersion,
  lastSeenVersion,
  availableVersions
} = {}) {
  const safeCurrentVersion =
    typeof currentVersion === "string"
      ? currentVersion.trim()
      : "";

  const safeLastSeenVersion =
    typeof lastSeenVersion === "string"
      ? lastSeenVersion.trim()
      : "";

  const safeAvailableVersions =
    Array.isArray(availableVersions)
      ? availableVersions
          .filter((version) => typeof version === "string")
          .map((version) => version.trim())
          .filter(Boolean)
      : [];

  const available =
    safeCurrentVersion !== "" &&
    safeAvailableVersions.includes(
      safeCurrentVersion
    );

  return {
    currentVersion: safeCurrentVersion,
    lastSeenVersion: safeLastSeenVersion,
    available,
    unseen:
      available &&
      safeLastSeenVersion !== safeCurrentVersion
  };
}

const WHATS_NEW_RELEASES = {
  "1.0.6": {
    es: {
      title: "Quacker se ha puesto el casco",
      items: [
        "Más estabilidad y protección para tus datos.",
        "Mejoras internas para recuperar Quacker con más seguridad si algo sale mal.",
        "Pequeños ajustes para que todo siga funcionando como un pato bien organizado."
      ]
    },
    en: {
      title: "Quacker put its helmet on",
      items: [
        "More stability and protection for your data.",
        "Internal improvements to recover Quacker more safely if something goes wrong.",
        "Small tweaks to keep everything running like a surprisingly organized duck."
      ]
    }
  }
};

export function getWhatsNewReleaseContent(
  version,
  language = "es"
) {
  const safeVersion =
    typeof version === "string"
      ? version.trim()
      : "";

  const release =
    WHATS_NEW_RELEASES[safeVersion];

  if (!release) return null;

  const safeLanguage =
    language === "en"
      ? "en"
      : "es";

  const content =
    release[safeLanguage] ||
    release.es;

  return {
    version: safeVersion,
    title: content.title,
    items: [...content.items]
  };
}

// Compara versiones sin considerar una release estable
// anterior a su propia version candidata.
function compareWhatsNewVersions(left, right) {
  const pattern =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

  const a = pattern.exec(left);
  const b = pattern.exec(right);

  if (!a || !b) return null;

  for (let index = 1; index <= 3; index += 1) {
    const difference =
      Number(a[index]) - Number(b[index]);

    if (difference !== 0) {
      return Math.sign(difference);
    }
  }

  if (!a[4] && b[4]) return 1;
  if (a[4] && !b[4]) return -1;
  if (!a[4] && !b[4]) return 0;

  return Math.sign(
    a[4].localeCompare(
      b[4],
      "en",
      { numeric: true }
    )
  );
}

// Permite consultar la ultima release publicada.
// Solo la release de la version actual puede
// abrirse automaticamente como novedad pendiente.
export function getWhatsNewDisplayState({
  currentVersion,
  lastSeenVersion,
  language = "es"
} = {}) {
  const current =
    typeof currentVersion === "string"
      ? currentVersion.trim()
      : "";

  const activeRelease =
    getWhatsNewReleaseContent(current, language);

  const state = resolveWhatsNewRelease({
    currentVersion: current,
    lastSeenVersion,
    availableVersions:
      activeRelease ? [current] : []
  });

  if (activeRelease) {
    return {
      ...state,
      release: activeRelease
    };
  }

  const previousVersions =
    Object.keys(WHATS_NEW_RELEASES)
      .filter((version) => {
        const comparison =
          compareWhatsNewVersions(version, current);

        return comparison !== null &&
          comparison <= 0;
      })
      .sort((a, b) =>
        compareWhatsNewVersions(b, a)
      );

  const previousVersion =
    previousVersions[0] || null;

  const previousRelease =
    previousVersion
      ? getWhatsNewReleaseContent(
          previousVersion,
          language
        )
      : null;

  return {
    ...state,
    available: previousRelease !== null,
    unseen: false,
    release: previousRelease
  };
}
