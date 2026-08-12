function _normalizeRequestPath(value) {
  const path = String(value || "").trim();

  if (!path) {
    return "/";
  }

  return path.startsWith("/")
    ? path
    : `/${path}`;
}

export function shouldServePublicNotFound({
  method = "",
  path = ""
} = {}) {
  const normalizedMethod =
    String(method || "").trim().toUpperCase();

  if (
    normalizedMethod !== "GET" &&
    normalizedMethod !== "HEAD"
  ) {
    return false;
  }

  const normalizedPath =
    _normalizeRequestPath(path);

  if (
    normalizedPath === "/api" ||
    normalizedPath.startsWith("/api/")
  ) {
    return false;
  }

  if (
    normalizedPath === "/assets" ||
    normalizedPath.startsWith("/assets/")
  ) {
    return false;
  }

  return true;
}

export function createPublicNotFoundHandler(
  notFoundHtmlPath
) {
  const filePath =
    String(notFoundHtmlPath || "").trim();

  if (!filePath) {
    throw new TypeError(
      "notFoundHtmlPath es obligatorio"
    );
  }

  return (req, res, next) => {
    if (
      !shouldServePublicNotFound({
        method: req?.method,
        path: req?.path
      })
    ) {
      return next();
    }

    res.status(404);

    return res.sendFile(
      filePath,
      (error) => {
        if (error) {
          next(error);
        }
      }
    );
  };
}
