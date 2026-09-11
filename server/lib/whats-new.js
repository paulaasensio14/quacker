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
