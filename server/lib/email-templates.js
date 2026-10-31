const BRAND = Object.freeze({
  yellow: "#f2c230",
  navy: "#0d3340",
  beige: "#f8f6ef",
  muted: "#526a72",
  border: "#ded9c9",
  white: "#ffffff",
  logo: "https://quacker.es/assets/img/logo-quacker.png",
  url: "https://quacker.es"
});

export function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderEmailLayout({
  language = "es",
  title,
  eyebrow = "",
  content,
  footer
}) {
  const lang = language === "en" ? "en" : "es";

  if (typeof content !== "string") {
    throw new TypeError("email_content_required");
  }

  const safeTitle = escapeEmailHtml(title);
  const safeEyebrow = escapeEmailHtml(eyebrow);
  const safeFooter = escapeEmailHtml(
    footer || (
      lang === "en"
        ? "One place for everything you watch, read and play."
        : "Un solo sitio para todo lo que ves, lees y juegas."
    )
  );

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f0e7;font-family:Arial,Helvetica,sans-serif;color:${BRAND.navy};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f0e7;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
<tr><td style="background:${BRAND.yellow};padding:22px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td><img src="${BRAND.logo}" alt="Quacker" width="48" height="48" style="display:block;width:48px;height:48px;"></td>
<td style="padding-left:12px;font-size:26px;font-weight:800;color:${BRAND.navy};">Quacker</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:30px 34px;">
${safeEyebrow ? `<p style="margin:0 0 12px;color:#966900;font-size:12px;font-weight:700;letter-spacing:1px;">${safeEyebrow}</p>` : ""}
<h1 style="margin:0 0 24px;color:${BRAND.navy};font-size:29px;line-height:1.25;">${safeTitle}</h1>
${content}
</td></tr>
<tr><td align="center" style="background:${BRAND.navy};padding:20px 22px;color:#ffffff;">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;">${safeFooter}</p>
<p style="margin:0;font-size:12px;color:#b5c5c9;">quacker.es · hello@quacker.es</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmailButton({
  label,
  url
}) {
  const safeLabel = escapeEmailHtml(label);
  const parsed = new URL(String(url));

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "quacker.es" ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    throw new TypeError("invalid_email_action_url");
  }

  const safeUrl = escapeEmailHtml(parsed.href);

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
<tr><td align="center" style="background:${BRAND.navy};border-radius:999px;">
<a href="${safeUrl}" style="display:inline-block;padding:15px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${safeLabel} →</a>
</td></tr></table>`;
}

export function renderEmailPanel(content) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background:${BRAND.beige};border:1px solid ${BRAND.border};border-radius:10px;">
<tr><td style="padding:18px 20px;font-size:15px;line-height:1.6;color:${BRAND.navy};">${content}</td></tr>
</table>`;
}
