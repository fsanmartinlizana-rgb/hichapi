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

// ── Bienvenida al restaurante ────────────────────────────────────────────────

interface WelcomeEmailOpts {
  restaurantName: string
  dashboardUrl:   string
}

export function welcomeEmail(opts: WelcomeEmailOpts): { subject: string; html: string; text: string } {
  const subject = '¡Bienvenido a HiChapi! 🎉'

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">¡Bienvenido a HiChapi!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      <strong style="color:#fff;">${escapeHtml(opts.restaurantName)}</strong> ya tiene su cuenta lista.
      Estamos felices de tenerte acá.
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Desde tu panel podrás:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.7);">
      <li><strong style="color:#fff;">Carta digital</strong> — Publica tu menú y actualízalo en tiempo real</li>
      <li><strong style="color:#fff;">Mesas</strong> — Gestiona la ocupación y reservas de tu local</li>
      <li><strong style="color:#fff;">Comandas</strong> — Envía pedidos a cocina al instante</li>
    </ul>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.dashboardUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          Ir al panel
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.dashboardUrl}
    </p>
  `

  const text = [
    `¡Bienvenido a HiChapi!`,
    ``,
    `${opts.restaurantName} ya tiene su cuenta lista. Estamos felices de tenerte acá.`,
    ``,
    `Desde tu panel podrás:`,
    `• Carta digital — Publica tu menú y actualízalo en tiempo real`,
    `• Mesas — Gestiona la ocupación y reservas de tu local`,
    `• Comandas — Envía pedidos a cocina al instante`,
    ``,
    `Ir al panel: ${opts.dashboardUrl}`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `${opts.restaurantName} ya está en HiChapi`, bodyHtml }),
    text,
  }
}

// ── Confirmación de reserva ──────────────────────────────────────────────────

interface ReservationConfirmOpts {
  restaurantName: string
  guestName:      string
  date:           string
  time:           string
  partySize:      number
  address?:       string
  statusUrl:      string
}

export function reservationConfirmEmail(opts: ReservationConfirmOpts): { subject: string; html: string; text: string } {
  const subject = `Tu reserva en ${opts.restaurantName} está confirmada`

  const addressRow = opts.address
    ? `<tr>
        <td style="padding:8px 12px;font-size:14px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Dirección</td>
        <td style="padding:8px 12px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(opts.address)}</td>
       </tr>`
    : ''

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">¡Reserva confirmada!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Hola <strong style="color:#fff;">${escapeHtml(opts.guestName)}</strong>, tu mesa en
      <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong> está lista.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Fecha</td>
        <td style="padding:8px 12px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(opts.date)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Hora</td>
        <td style="padding:8px 12px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(opts.time)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Personas</td>
        <td style="padding:8px 12px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${opts.partySize}</td>
      </tr>
      ${addressRow}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.statusUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          Ver mi reserva
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.statusUrl}
    </p>
  `

  const addressLine = opts.address ? `Dirección: ${opts.address}\n` : ''

  const text = [
    `¡Reserva confirmada!`,
    ``,
    `Hola ${opts.guestName}, tu mesa en ${opts.restaurantName} está lista.`,
    ``,
    `Fecha: ${opts.date}`,
    `Hora: ${opts.time}`,
    `Personas: ${opts.partySize}`,
    ...(opts.address ? [`Dirección: ${opts.address}`] : []),
    ``,
    `Ver mi reserva: ${opts.statusUrl}`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `${opts.date} a las ${opts.time} — ${opts.partySize} personas`, bodyHtml }),
    text,
  }
}

// ── Restablecer contraseña ───────────────────────────────────────────────────

interface PasswordResetOpts {
  resetUrl: string
}

export function passwordResetEmail(opts: PasswordResetOpts): { subject: string; html: string; text: string } {
  const subject = 'Restablecer tu contraseña — HiChapi'

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Restablecer contraseña</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en HiChapi.
      Hacé click en el botón para elegir una nueva contraseña.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.resetUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          Restablecer contraseña
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.resetUrl}
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0 20px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.4);">
      Este enlace expira en 1 hora. Si no solicitaste restablecer tu contraseña, podés ignorar este correo.
      Tu cuenta seguirá segura.
    </p>
  `

  const text = [
    `Restablecer contraseña`,
    ``,
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta en HiChapi.`,
    ``,
    `Para elegir una nueva contraseña, abrí este enlace:`,
    opts.resetUrl,
    ``,
    `Este enlace expira en 1 hora. Si no solicitaste esto, podés ignorar este correo.`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: 'Elegí una nueva contraseña para tu cuenta', bodyHtml }),
    text,
  }
}

// ── Reporte diario ───────────────────────────────────────────────────────────

interface DailyReportOpts {
  restaurantName: string
  date:           string
  totalSales:     number
  avgTicket:      number
  dishCount:      number
  occupancy:      number
  reportUrl:      string
}

function formatCLP(amount: number): string {
  return '$' + amount.toLocaleString('es-CL')
}

export function dailyReportEmail(opts: DailyReportOpts): { subject: string; html: string; text: string } {
  const subject = `Resumen del día — ${opts.restaurantName}`

  const kpiCell = (label: string, value: string) => `
    <td style="padding:12px;text-align:center;width:25%;">
      <div style="font-size:20px;font-weight:700;color:${BRAND_ORANGE};margin-bottom:4px;">${value}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);">${label}</div>
    </td>`

  const bodyHtml = `
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff;">Resumen del día</h1>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.5);">
      ${escapeHtml(opts.restaurantName)} · ${escapeHtml(opts.date)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:24px;">
      <tr>
        ${kpiCell('Ventas', formatCLP(opts.totalSales))}
        ${kpiCell('Ticket promedio', formatCLP(opts.avgTicket))}
        ${kpiCell('Platos vendidos', String(opts.dishCount))}
        ${kpiCell('Ocupación', `${opts.occupancy}%`)}
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.reportUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          Ver reporte completo
        </a>
      </td></tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.reportUrl}
    </p>
  `

  const text = [
    `Resumen del día — ${opts.restaurantName}`,
    `Fecha: ${opts.date}`,
    ``,
    `• Ventas: ${formatCLP(opts.totalSales)}`,
    `• Ticket promedio: ${formatCLP(opts.avgTicket)}`,
    `• Platos vendidos: ${opts.dishCount}`,
    `• Ocupación: ${opts.occupancy}%`,
    ``,
    `Ver reporte completo: ${opts.reportUrl}`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `Ventas ${formatCLP(opts.totalSales)} · ${opts.dishCount} platos · ${opts.occupancy}% ocupación`, bodyHtml }),
    text,
  }
}
