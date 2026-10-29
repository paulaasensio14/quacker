export function unexpectedErrorHandler(
  error,
  req,
  res,
  next
) {
  if (res.headersSent) {
    return next(error);
  }

  const rawStatus = Number(
    error?.status ?? error?.statusCode
  );

  const status =
    Number.isInteger(rawStatus) &&
    rawStatus >= 400 &&
    rawStatus < 500
      ? rawStatus
      : 500;

  const isApi =
    req.path === "/api" ||
    req.path.startsWith("/api/");

  res.set("Cache-Control", "no-store");

  if (status >= 500) {
    console.error(
      "[quacker] unexpected_request_error",
      {
        method: req.method,
        path: req.path,
        status
      }
    );
  }

  if (isApi) {
    return res.status(status).json({
      error:
        status === 500
          ? "internal_server_error"
          : "invalid_request"
    });
  }

  return res
    .status(status)
    .type("text/plain")
    .send(
      status === 500
        ? "Internal Server Error"
        : "Bad Request"
    );
}
