export const SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": [
    "accelerometer=()",
    "autoplay=()",
    "camera=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "payment=()",
    "usb=()"
  ].join(", ")
});

export function applySecurityHeaders(
  request,
  response,
  next
) {
  for (const [name, value] of Object.entries(
    SECURITY_HEADERS
  )) {
    response.setHeader(name, value);
  }

  next();
}
