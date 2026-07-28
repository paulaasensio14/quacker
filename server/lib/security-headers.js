export const CONTENT_SECURITY_POLICY_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'report-sample'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com 'report-sample'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://image.tmdb.org https://media.rawg.io https://covers.openlibrary.org https://books.google.com",
  "connect-src 'self'",
  "frame-src 'none'",
  "media-src 'self'",
  "worker-src 'none'",
  "manifest-src 'self'"
].join("; ");

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
  ].join(", "),
  "Content-Security-Policy-Report-Only":
    CONTENT_SECURITY_POLICY_REPORT_ONLY
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
