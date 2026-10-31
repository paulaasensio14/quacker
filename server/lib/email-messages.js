import {
  escapeEmailHtml as esc,
  renderEmailLayout,
  renderEmailButton,
  renderEmailPanel
} from "./email-templates.js";

const HOME = "https://quacker.es/";

function paragraph(value, extra = "") {
  return `<p style="margin:0 0 18px;color:#405b64;font-size:15px;line-height:1.7;${extra}">${esc(value)}</p>`;
}

function heading(value) {
  return `<h2 style="margin:26px 0 14px;color:#0d3340;font-size:18px;line-height:1.4;">${esc(value)}</h2>`;
}

function details(items) {
  return items.map(({ title, body, number }) =>
    renderEmailPanel(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="38" valign="top" style="font-size:20px;font-weight:800;color:#0d3340;">${esc(number)}</td>
          <td style="color:#0d3340;">
            <strong style="font-size:15px;">${esc(title)}</strong>
            <div style="margin-top:4px;color:#526a72;font-size:14px;">${esc(body)}</div>
          </td>
        </tr>
      </table>`
    )
  ).join("");
}

export function buildWelcomeEmail({
  name = "",
  language = "es"
} = {}) {
  const en = language === "en";
  const who = String(name).trim();

  const copy = en ? {
    subject: "Welcome to Quacker!",
    eyebrow: "WELCOME TO QUACKER",
    title: "Welcome to your nest!",
    greeting: who ? `Hi ${who},` : "Hi,",
    intro: "Your Quacker account is ready. One place for everything you watch, read and play.",
    stepsTitle: "Start exploring",
    steps: [
      ["Explore", "Discover movies, series, books and games."],
      ["Save", "Build your own personal library."],
      ["Keep track", "Follow your progress and create lists."]
    ],
    button: "Open Quacker",
    support: "Questions or suggestions? Write to hello@quacker.es.",
    closing: "See you in the nest!",
    footer: "Your entertainment, all in one place."
  } : {
    subject: "¡Bienvenido a Quacker!",
    eyebrow: "BIENVENIDO A QUACKER",
    title: "¡Bienvenido a tu nido!",
    greeting: who ? `Hola ${who},` : "Hola,",
    intro: "Tu cuenta de Quacker ya está lista. Un lugar para organizar todo lo que ves, lees y juegas.",
    stepsTitle: "Empieza a explorar",
    steps: [
      ["Explora", "Descubre películas, series, libros y videojuegos."],
      ["Guarda", "Crea tu biblioteca personal."],
      ["Sigue avanzando", "Controla tu progreso y organiza listas."]
    ],
    button: "Entrar en Quacker",
    support: "¿Dudas o sugerencias? Escríbenos a hello@quacker.es.",
    closing: "¡Nos vemos en el nido!",
    footer: "Todo lo que disfrutas, en un mismo lugar."
  };

  const content =
    paragraph(copy.greeting, "font-weight:700;color:#0d3340;") +
    paragraph(copy.intro) +
    heading(copy.stepsTitle) +
    details(copy.steps.map(([title, body], index) => ({
      title,
      body,
      number: index + 1
    }))) +
    renderEmailButton({ label: copy.button, url: HOME }) +
    paragraph(copy.support, "font-size:13px;text-align:center;") +
    paragraph(copy.closing, "font-weight:700;color:#0d3340;");

  return {
    subject: copy.subject,
    text: [
      copy.greeting,
      copy.intro,
      copy.stepsTitle,
      ...copy.steps.map(([title, body], index) =>
        `${index + 1}. ${title}: ${body}`
      ),
      `${copy.button}: ${HOME}`,
      copy.support,
      copy.closing
    ].join("\n\n"),
    html: renderEmailLayout({
      language,
      title: copy.title,
      eyebrow: copy.eyebrow,
      content,
      footer: copy.footer
    })
  };
}

export function buildPasswordResetEmail({
  name = "",
  language = "es",
  resetUrl,
  expiryMinutes = 30
} = {}) {
  if (
    !Number.isInteger(expiryMinutes) ||
    expiryMinutes < 1
  ) {
    throw new TypeError("invalid_reset_expiry");
  }

  const en = language === "en";
  const who = String(name).trim();

  const copy = en ? {
    subject: "Reset your Quacker password",
    eyebrow: "ACCOUNT SECURITY",
    title: "Reset your password",
    greeting: who ? `Hi ${who},` : "Hi,",
    intro: "We received a request to reset your Quacker password.",
    action: "Use the button below to choose a new password.",
    button: "Reset password",
    warning: `This link expires in ${expiryMinutes} minutes and can only be used once.`,
    fallback: "If the button does not work, copy this link into your browser:",
    ignore: "If you did not request this, you can ignore the email. Your password will remain unchanged.",
    safety: "Quacker will never ask you to send your password by email.",
    support: "Need help? Write to hello@quacker.es."
  } : {
    subject: "Restablece tu contraseña de Quacker",
    eyebrow: "SEGURIDAD DE TU CUENTA",
    title: "Recupera tu contraseña",
    greeting: who ? `Hola ${who},` : "Hola,",
    intro: "Hemos recibido una solicitud para restablecer tu contraseña de Quacker.",
    action: "Utiliza este botón para elegir una contraseña nueva.",
    button: "Restablecer contraseña",
    warning: `Este enlace caduca en ${expiryMinutes} minutos y solo se puede utilizar una vez.`,
    fallback: "Si el botón no funciona, copia este enlace en tu navegador:",
    ignore: "Si no has solicitado este cambio, puedes ignorar el correo. Tu contraseña seguirá siendo la misma.",
    safety: "Quacker nunca te pedirá que envíes tu contraseña por correo.",
    support: "¿Necesitas ayuda? Escríbenos a hello@quacker.es."
  };

  const action = renderEmailButton({
    label: copy.button,
    url: resetUrl
  });

  const safeUrl = esc(new URL(resetUrl).href);

  const content =
    paragraph(copy.greeting, "font-weight:700;color:#0d3340;") +
    paragraph(copy.intro) +
    paragraph(copy.action) +
    action +
    renderEmailPanel(
      `<strong>${esc(copy.warning)}</strong>`
    ) +
    paragraph(copy.fallback, "font-size:13px;") +
    `<p style="margin:0 0 24px;overflow-wrap:anywhere;word-break:break-all;font-size:12px;">
      <a href="${safeUrl}" style="color:#0d5b72;">${safeUrl}</a>
    </p>` +
    paragraph(copy.ignore) +
    paragraph(copy.safety, "font-weight:700;") +
    paragraph(copy.support, "font-size:13px;");

  return {
    subject: copy.subject,
    text: [
      copy.greeting,
      copy.intro,
      copy.action,
      resetUrl,
      copy.warning,
      copy.ignore,
      copy.safety,
      copy.support
    ].join("\n\n"),
    html: renderEmailLayout({
      language,
      title: copy.title,
      eyebrow: copy.eyebrow,
      content
    })
  };
}

export function buildContactEmail({
  name,
  email,
  message,
  language = "es"
}) {
  const sender = String(name ?? "").trim();
  const address = String(email ?? "").trim();
  const body = String(message ?? "");

  const fields = [
    ["Nombre", sender],
    ["Correo electrónico", address],
    ["Idioma", language === "en" ? "English" : "Español"]
  ];

  const content =
    paragraph("Se ha recibido un mensaje desde el formulario de contacto de Quacker.") +
    renderEmailPanel(fields.map(([label, value]) =>
      `<p style="margin:0 0 10px;">
        <strong>${esc(label)}:</strong> ${esc(value)}
      </p>`
    ).join("")) +
    heading("Mensaje") +
    renderEmailPanel(
      `<div style="white-space:pre-wrap;overflow-wrap:anywhere;">${esc(body)}</div>`
    );

  return {
    subject: `[Quacker] Nuevo mensaje de ${sender.replace(/[\r\n]/g, " ")}`,
    text: [
      "Nuevo mensaje desde Quacker",
      ...fields.map(([label, value]) => `${label}: ${value}`),
      "Mensaje:",
      body
    ].join("\n\n"),
    html: renderEmailLayout({
      language: "es",
      title: "Nuevo mensaje de contacto",
      eyebrow: "FORMULARIO WEB",
      content,
      footer: "Notificación interna de Quacker."
    })
  };
}
