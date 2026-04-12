// ─────────────────────────────────────────────────────────────────────────────
// HiChapi · plantillas de email branded
// Lenguaje claro en español, paleta naranja (#FF6B35), responsive, modo dark.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_ORANGE = '#FF6B35'
const BRAND_DARK   = '#0A0A14'
const BRAND_PANEL  = '#161622'

interface BaseLayoutOpts {
  title:    string
  preview:  string
  bodyHtml: string
}

function baseLayout({ title, preview, bodyHtml }: BaseLayoutOpts): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_DARK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preview)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND_DARK};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr><td align="center" style="padding-bottom:24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${BRAND_ORANGE};width:44px;height:44px;border-radius:12px;text-align:center;vertical-align:middle;color:#fff;font-weight:800;font-size:18px;">hi</td>
                <td style="padding-left:12px;color:#fff;font-weight:700;font-size:18px;">HiChapi</td>
              </tr>
            </table>
          </td></tr>

          <!-- Card -->
          <tr><td style="background:${BRAND_PANEL};border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 32px;color:#fff;">
            ${bodyHtml}
          </td></tr>

          <!-- Footer -->
          <tr><td align="center" style="padding-top:24px;color:rgba(255,255,255,0.35);font-size:12px;line-height:1.5;">
            HiChapi · Panel de gestión para restaurantes en Chile<br/>
            ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@hichapi.com" style="color:${BRAND_ORANGE};text-decoration:none;">soporte@hichapi.com</a>
          </td></tr>
          <tr><td align="center" style="padding-top:8px;color:rgba(255,255,255,0.2);font-size:11px;">
            Si no esperabas este correo, puedes ignorarlo. Tu cuenta seguirá segura.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Invitación al equipo ─────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin:      'Administrador',
  supervisor: 'Supervisor',
  garzon:     'Garzón',
  waiter:     'Garzón',
  cocina:     'Cocina',
  anfitrion:  'Anfitrión',
}

interface InviteEmailOpts {
  restaurantName: string
  role:           string
  actionUrl:      string
  invitedByName?: string
}

export function teamInviteEmail(opts: InviteEmailOpts): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABEL[opts.role] ?? opts.role
  const subject   = `Te invitaron a ${opts.restaurantName} en HiChapi`

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">¡Te dieron acceso a HiChapi!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      ${opts.invitedByName ? escapeHtml(opts.invitedByName) + ' te' : 'Te'} sumó al equipo de
      <strong style="color:#fff;">${escapeHtml(opts.restaurantName)}</strong> con el rol de
      <strong style="color:${BRAND_ORANGE};">${escapeHtml(roleLabel)}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Para activar tu cuenta y elegir tu contraseña, hace click en el botón.
      Solo te tomará un minuto.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.actionUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          Aceptar invitación
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.actionUrl}
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0 20px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.4);">
      Este enlace expira en 24 horas. Si no fuiste tú o no esperabas esta invitación, podés ignorar este correo.
    </p>
  `

  const text = [
    `¡Te dieron acceso a HiChapi!`,
    ``,
    `${opts.invitedByName ? opts.invitedByName + ' te' : 'Te'} sumó al equipo de ${opts.restaurantName} con el rol de ${roleLabel}.`,
    ``,
    `Para activar tu cuenta, abrí este enlace:`,
    opts.actionUrl,
    ``,
    `Si no esperabas este correo, podés ignorarlo. Tu cuenta seguirá segura.`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `Activá tu acceso a ${opts.restaurantName}`, bodyHtml }),
    text,
  }
}
