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

    <div style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.25);border-radius:12px;padding:16px 18px;margin-bottom:22px;">
      <p style="margin:0 0 8px;font-size:13px;color:#fff;font-weight:600;">Cómo empezar en 2 pasos:</p>
      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.7);">
        <li>Hacé click en <strong style="color:#fff;">Aceptar invitación</strong> abajo.</li>
        <li>Elegí tu contraseña (mínimo 12 caracteres) y ¡ya estás adentro!</li>
      </ol>
    </div>

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
      ¿El botón no funciona? Copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0 0 20px;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.actionUrl}
    </p>

    <p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,0.6);">
      <strong style="color:#fff;">Con este acceso vas a poder:</strong>
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:13px;line-height:1.8;color:rgba(255,255,255,0.6);">
      <li>Entrar al panel de <strong style="color:#fff;">${escapeHtml(opts.restaurantName)}</strong> con tu rol de ${escapeHtml(roleLabel)}</li>
      <li>Ver y gestionar las funciones habilitadas para tu rol (mesas, comandas, cocina, etc.)</li>
      <li>Recibir notificaciones de pedidos, turnos y cambios operativos</li>
    </ul>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0 20px;" />
    <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.5);">
      <strong style="color:rgba(255,255,255,0.7);">⚠ Importante:</strong>
    </p>
    <ul style="margin:0 0 12px;padding-left:18px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.45);">
      <li>El enlace es de <strong style="color:rgba(255,255,255,0.6);">un solo uso</strong> y expira en <strong style="color:rgba(255,255,255,0.6);">1 hora</strong>.</li>
      <li>Hacé click vos directamente, sin compartirlo. Algunos clientes de email (Outlook, Gmail) hacen "preview" del link y lo consumen automáticamente.</li>
      <li>Si ya expiró, podés pedir uno nuevo desde la pantalla de error.</li>
    </ul>
    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.4);">
      Si no fuiste vos o no esperabas esta invitación, ignorá este correo — tu cuenta seguirá segura.
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
  const subject = `¡Bienvenido a HiChapi! ${opts.restaurantName} ya está activo`

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">¡Tu restaurante está en línea! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong>
      ya tiene su cuenta HiChapi activa. Estamos felices de tenerte acá.
    </p>

    <div style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.25);border-radius:12px;padding:16px 18px;margin-bottom:22px;">
      <p style="margin:0 0 10px;font-size:13px;color:#fff;font-weight:600;">🚀 Checklist para los primeros 15 minutos:</p>
      <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);">
        <li><strong style="color:#fff;">Carta digital</strong> — Subí tus platos (foto, PDF o Excel también sirven).</li>
        <li><strong style="color:#fff;">Mesas</strong> — Creá las mesas y descargá los QR para imprimir.</li>
        <li><strong style="color:#fff;">Equipo</strong> — Invitá a tu garzón, cocina y anfitrión.</li>
      </ol>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.dashboardUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          Entrar al panel
        </a>
      </td></tr>
    </table>

    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      ¿El botón no funciona? Copia este enlace en tu navegador:
    </p>
    <p style="margin:0 0 18px;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.dashboardUrl}
    </p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:22px 0 18px;" />
    <p style="margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.45);">
      <strong style="color:rgba(255,255,255,0.7);">💡 Tip:</strong>
      Si necesitás ayuda, chateá con <strong>Chapi</strong> (el botón flotante en el panel)
      o escribinos a <a href="mailto:soporte@hichapi.com" style="color:${BRAND_ORANGE};text-decoration:none;">soporte@hichapi.com</a>.
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
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">¡Reserva confirmada! ✅</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Hola <strong style="color:#fff;">${escapeHtml(opts.guestName)}</strong>, tu mesa en
      <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong> está reservada.
    </p>

    <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.6);">
      Guardá este correo — desde acá podés ver el detalle, modificar o cancelar tu reserva.
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

// ── Cupón de fidelidad (wallet virtual) ──────────────────────────────────────

interface LoyaltyCouponOpts {
  restaurantName: string
  customerName?:  string
  rewardName:     string
  rewardDetail?:  string
  code:           string
  expiresAt?:     string | null
  claimUrl:       string    // ej: /register?coupon=CH-XXXX&email=foo@bar.cl
  alreadyUser:    boolean   // si true, el CTA es "Ver mi wallet", no "Crear cuenta"
}

export function loyaltyCouponEmail(opts: LoyaltyCouponOpts): { subject: string; html: string; text: string } {
  const subject = `🎁 Tienes un cupón de ${opts.restaurantName}`
  const greeting = opts.customerName ? `Hola ${escapeHtml(opts.customerName)},` : 'Hola,'
  const expiryLine = opts.expiresAt
    ? `<tr>
        <td style="padding:8px 12px;font-size:14px;color:rgba(255,255,255,0.5);">Válido hasta</td>
        <td style="padding:8px 12px;font-size:14px;color:#fff;">${escapeHtml(opts.expiresAt)}</td>
       </tr>`
    : ''

  const ctaLabel = opts.alreadyUser ? 'Ver en mi wallet' : 'Crear cuenta y guardar cupón'
  const bottomCopy = opts.alreadyUser
    ? 'Tu cupón ya está disponible en tu wallet. Podés mostrarlo en el local cuando lo quieras canjear.'
    : 'Creá tu cuenta gratis en HiChapi con este correo y tu cupón quedará guardado en tu wallet virtual para cuando visites el local.'

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">¡Tienes un regalo! 🎁</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      ${greeting} <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong>
      te regaló un cupón canjeable en tu próxima visita.
    </p>

    <div style="background:rgba(255,107,53,0.08);border:1px dashed rgba(255,107,53,0.4);border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
        ${escapeHtml(opts.rewardName)}
      </div>
      ${opts.rewardDetail ? `<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:12px;">${escapeHtml(opts.rewardDetail)}</div>` : ''}
      <div style="display:inline-block;font-family:'Courier New',monospace;font-size:26px;font-weight:800;letter-spacing:4px;color:#fff;background:rgba(0,0,0,0.35);border-radius:10px;padding:12px 20px;">
        ${escapeHtml(opts.code)}
      </div>
    </div>

    ${opts.expiresAt ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:24px;">
      ${expiryLine}
    </table>` : ''}

    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      ${bottomCopy}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td align="center" style="padding:8px 0 24px;">
        <a href="${opts.claimUrl}"
           style="display:inline-block;background:${BRAND_ORANGE};color:#fff;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:14px;text-decoration:none;">
          ${ctaLabel}
        </a>
      </td></tr>
    </table>

    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4);">
      Si el botón no funciona, copia y pega este enlace en tu navegador:
    </p>
    <p style="margin:0;font-size:11px;word-break:break-all;color:${BRAND_ORANGE};">
      ${opts.claimUrl}
    </p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0 20px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.4);">
      Presenta el código al garzón cuando quieras canjearlo. Si no reconoces este correo, podés ignorarlo.
    </p>
  `

  const text = [
    `¡Tienes un regalo!`,
    ``,
    `${opts.customerName ? 'Hola ' + opts.customerName + ', ' : ''}${opts.restaurantName} te regaló un cupón.`,
    ``,
    `Recompensa: ${opts.rewardName}`,
    ...(opts.rewardDetail ? [`Detalle: ${opts.rewardDetail}`] : []),
    `Código: ${opts.code}`,
    ...(opts.expiresAt ? [`Válido hasta: ${opts.expiresAt}`] : []),
    ``,
    bottomCopy,
    ``,
    `${ctaLabel}: ${opts.claimUrl}`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `${opts.rewardName} — código ${opts.code}`, bodyHtml }),
    text,
  }
}

// ── Factura electrónica al receptor ──────────────────────────────────────────

interface FacturaEmailOpts {
  restaurantName:  string
  razonReceptor:   string
  folio:           number
  totalAmount:     number
  emittedAt:       string   // ISO date string
  hasXml:          boolean
  hasPdf:          boolean
  items?:          Array<{ name: string; quantity: number; unit_price: number }>
}

export function facturaEmail(opts: FacturaEmailOpts): { subject: string; html: string; text: string } {
  const subject = `Factura Electrónica N° ${opts.folio} — ${opts.restaurantName}`
  const fecha   = new Date(opts.emittedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  const monto   = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(opts.totalAmount)

  const adjuntosLine = [
    opts.hasXml ? 'XML (DTE firmado)' : null,
    opts.hasPdf ? 'PDF (representación impresa)' : null,
  ].filter(Boolean).join(' y ')

  // Tabla de ítems (opcional — sólo se renderiza cuando se proporcionan ítems)
  const itemsTableHtml = opts.items && opts.items.length > 0
    ? `
    <!-- Detalle de ítems -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:14px;margin-bottom:24px;">
      <tr>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Producto</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Cant.</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">P. Unit.</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Subtotal</th>
      </tr>
      ${opts.items.map(item => {
        const unitPrice = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.unit_price)
        const subtotal  = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.unit_price * item.quantity)
        return `
      <tr>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.85);border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">${item.quantity}</td>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${unitPrice}</td>
        <td style="padding:10px 12px;font-size:13px;color:#fff;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${subtotal}</td>
      </tr>`
      }).join('')}
    </table>`
    : ''

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">
      Factura Electrónica N° ${opts.folio}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Estimado(a) <strong style="color:#fff;">${escapeHtml(opts.razonReceptor)}</strong>,<br/>
      adjuntamos su factura electrónica emitida por <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong>.
    </p>

    ${itemsTableHtml}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Folio</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${opts.folio}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Fecha emisión</td>
        <td style="padding:12px 16px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${fecha}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);">Monto total</td>
        <td style="padding:12px 16px;font-size:16px;font-weight:800;color:${BRAND_ORANGE};">${monto}</td>
      </tr>
    </table>

    ${adjuntosLine ? `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6);">
      📎 Se adjunta el documento en formato ${adjuntosLine}.
    </p>` : ''}

    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.35);">
      Este documento tiene validez tributaria ante el SII. Consérvelo para sus registros contables.
    </p>
  `

  const itemLines = opts.items && opts.items.length > 0
    ? opts.items.map(item => {
        const subtotal = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.unit_price * item.quantity)
        return `  ${item.name} x${item.quantity} — ${subtotal}`
      }).join('\n')
    : null

  const text = [
    `Factura Electrónica N° ${opts.folio}`,
    ``,
    `Estimado(a) ${opts.razonReceptor},`,
    `Adjuntamos su factura electrónica emitida por ${opts.restaurantName}.`,
    ``,
    ...(itemLines ? [`Detalle:`, itemLines, ``] : []),
    `Folio:         ${opts.folio}`,
    `Fecha emisión: ${fecha}`,
    `Monto total:   ${monto}`,
    ``,
    adjuntosLine ? `Adjuntos: ${adjuntosLine}` : '',
    ``,
    `Este documento tiene validez tributaria ante el SII.`,
    ``,
    `— ${opts.restaurantName}`,
  ].filter(l => l !== undefined).join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `Factura N° ${opts.folio} por ${monto} de ${opts.restaurantName}`, bodyHtml }),
    text,
  }
}

// ── Acuse de Recibo (AEC) al emisor ──────────────────────────────────────────

interface AecEmailOpts {
  razonEmisor:   string
  razonReceptor: string
  folio:         number
  tipoDte:       number
  totalAmount:   number
  estado:        'aceptado' | 'rechazado' | 'reclamado'
  glosa?:        string
}

const AEC_ESTADO_LABEL: Record<string, { label: string; color: string; emoji: string }> = {
  aceptado:  { label: 'Aceptada',  color: '#34D399', emoji: '✅' },
  rechazado: { label: 'Rechazada', color: '#F87171', emoji: '❌' },
  reclamado: { label: 'Reclamada', color: '#FB923C', emoji: '⚠️' },
}

export function aecEmail(opts: AecEmailOpts): { subject: string; html: string; text: string } {
  const cfg     = AEC_ESTADO_LABEL[opts.estado] ?? AEC_ESTADO_LABEL.aceptado
  const subject = `${cfg.emoji} Acuse de Recibo — Factura N° ${opts.folio} ${cfg.label}`
  const monto   = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(opts.totalAmount)

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">
      ${cfg.emoji} Acuse de Recibo
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Estimado(a) <strong style="color:#fff;">${escapeHtml(opts.razonEmisor)}</strong>,<br/>
      <strong style="color:${cfg.color};">${escapeHtml(opts.razonReceptor)}</strong>
      ha procesado su factura electrónica con el siguiente resultado:
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Folio</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${opts.folio}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Monto total</td>
        <td style="padding:12px 16px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${monto}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);${opts.glosa ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">Estado</td>
        <td style="padding:12px 16px;font-size:15px;font-weight:800;color:${cfg.color};${opts.glosa ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">${cfg.label.toUpperCase()}</td>
      </tr>
      ${opts.glosa ? `
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);">Motivo</td>
        <td style="padding:12px 16px;font-size:14px;color:#fff;">${escapeHtml(opts.glosa)}</td>
      </tr>` : ''}
    </table>

    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.35);">
      Se adjunta el XML del Acuse de Recibo firmado digitalmente según el estándar SII Chile.
      Consérvelo para sus registros contables.
    </p>
  `

  const text = [
    `Acuse de Recibo — Factura N° ${opts.folio}`,
    ``,
    `Estimado(a) ${opts.razonEmisor},`,
    `${opts.razonReceptor} ha procesado su factura con el siguiente resultado:`,
    ``,
    `Folio:   ${opts.folio}`,
    `Monto:   ${monto}`,
    `Estado:  ${cfg.label.toUpperCase()}`,
    ...(opts.glosa ? [`Motivo:  ${opts.glosa}`] : []),
    ``,
    `Se adjunta el XML del Acuse de Recibo firmado digitalmente.`,
    ``,
    `— ${opts.razonReceptor}`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview: `Factura N° ${opts.folio} — ${cfg.label} por ${opts.razonReceptor}`, bodyHtml }),
    text,
  }
}

// ── Boleta electrónica al cliente ────────────────────────────────────────────

export interface BoletaEmailOpts {
  restaurantName: string
  folio:          number
  totalAmount:    number   // en CLP (entero)
  emittedAt:      string   // ISO date string
  items:          Array<{ name: string; quantity: number; unit_price: number }>
  hasXml:         boolean
  hasPdf:         boolean
}

export interface EmailResult {
  subject: string
  html:    string
  text:    string
}

export function boletaEmail(opts: BoletaEmailOpts): EmailResult {
  const subject = `Boleta Electrónica N° ${opts.folio} — ${opts.restaurantName}`
  const fecha   = new Date(opts.emittedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  const monto   = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(opts.totalAmount)
  const preview = `Boleta N° ${opts.folio} por ${monto} de ${opts.restaurantName}`

  const adjuntosLine = [
    opts.hasXml ? 'XML (DTE firmado)' : null,
    opts.hasPdf ? 'PDF (representación impresa)' : null,
  ].filter(Boolean).join(' y ')

  const itemRows = opts.items.map(item => {
    const unitPrice = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.unit_price)
    const subtotal  = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.unit_price * item.quantity)
    return `
      <tr>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.85);border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">${item.quantity}</td>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${unitPrice}</td>
        <td style="padding:10px 12px;font-size:13px;color:#fff;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${subtotal}</td>
      </tr>`
  }).join('')

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">
      Boleta Electrónica N° ${opts.folio}
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      Gracias por tu compra en <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong>.
      A continuación encontrarás el detalle de tu boleta electrónica.
    </p>

    <!-- Detalle de ítems -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:14px;margin-bottom:24px;">
      <tr>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Producto</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Cant.</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">P. Unit.</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Subtotal</th>
      </tr>
      ${itemRows}
    </table>

    <!-- Resumen -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Folio</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${opts.folio}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">Fecha emisión</td>
        <td style="padding:12px 16px;font-size:14px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06);">${fecha}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:rgba(255,255,255,0.5);">Total</td>
        <td style="padding:12px 16px;font-size:18px;font-weight:800;color:${BRAND_ORANGE};">${monto}</td>
      </tr>
    </table>

    ${adjuntosLine ? `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.6);">
      📎 Se adjunta el documento en formato ${adjuntosLine}.
    </p>` : ''}

    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.35);">
      Este documento es tu comprobante de compra. Consérvalo para cualquier consulta.
    </p>
  `

  const itemLines = opts.items.map(item => {
    const subtotal = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.unit_price * item.quantity)
    return `  ${item.name} x${item.quantity} — ${subtotal}`
  }).join('\n')

  const text = [
    `Boleta Electrónica N° ${opts.folio}`,
    ``,
    `Gracias por tu compra en ${opts.restaurantName}.`,
    ``,
    `Detalle:`,
    itemLines,
    ``,
    `Folio:         ${opts.folio}`,
    `Fecha emisión: ${fecha}`,
    `Total:         ${monto}`,
    ``,
    ...(adjuntosLine ? [`Adjuntos: ${adjuntosLine}`, ``] : []),
    `Este documento es tu comprobante de compra.`,
    ``,
    `— ${opts.restaurantName}`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview, bodyHtml }),
    text,
  }
}

// ── Stock crítico ────────────────────────────────────────────────────────────

export interface StockCriticalItem {
  name:        string
  current_qty: number
  min_qty:     number
  unit:        string
  supplier?:   string | null
}

export interface StockCriticalEmailOpts {
  restaurantName: string
  items:          StockCriticalItem[]   // todos con current_qty <= min_qty
}

const STOCK_RED   = '#F87171'
const STOCK_AMBER = '#FB923C'

export function stockCriticalEmail(opts: StockCriticalEmailOpts): EmailResult {
  const n       = opts.items.length
  const subject = `⚠️ ${n} insumo(s) con stock crítico — ${opts.restaurantName}`
  const preview = `${n} insumo(s) requieren reabastecimiento urgente en ${opts.restaurantName}`

  const itemRows = opts.items.map(item => {
    const color       = item.current_qty < 0 ? STOCK_RED : STOCK_AMBER
    const supplierCell = item.supplier
      ? `<td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(item.supplier)}</td>`
      : `<td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.06);">—</td>`
    return `
      <tr>
        <td style="padding:10px 12px;font-size:13px;color:#fff;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(item.name)}</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:700;color:${color};text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">${item.current_qty}</td>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">${item.min_qty}</td>
        <td style="padding:10px 12px;font-size:13px;color:rgba(255,255,255,0.6);text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(item.unit)}</td>
        ${supplierCell}
      </tr>`
  }).join('')

  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">⚠️ Stock crítico detectado</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);">
      <strong style="color:${BRAND_ORANGE};">${escapeHtml(opts.restaurantName)}</strong> tiene
      <strong style="color:#fff;">${n} insumo(s)</strong> por debajo del umbral mínimo.
      Revisá el inventario y reabastecé a la brevedad.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="background:rgba(255,255,255,0.04);border-radius:14px;margin-bottom:24px;">
      <tr>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Insumo</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Actual</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Mínimo</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Unidad</th>
        <th style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.4);text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08);">Proveedor</th>
      </tr>
      ${itemRows}
    </table>

    <div style="background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.25);border-radius:12px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.7);">
        <strong style="color:${STOCK_AMBER};">Ámbar</strong> = stock en cero o por debajo del mínimo &nbsp;·&nbsp;
        <strong style="color:${STOCK_RED};">Rojo</strong> = stock negativo (requiere corrección urgente)
      </p>
    </div>

    <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.35);">
      Este correo fue generado automáticamente por HiChapi al detectar insumos en estado crítico.
      Podés gestionar el inventario desde el panel de stock.
    </p>
  `

  const itemLines = opts.items.map(item => {
    const status    = item.current_qty < 0 ? '[NEGATIVO]' : '[CRÍTICO]'
    const supplier  = item.supplier ? ` | Proveedor: ${item.supplier}` : ''
    return `  ${status} ${item.name}: ${item.current_qty} ${item.unit} (mín. ${item.min_qty})${supplier}`
  }).join('\n')

  const text = [
    `⚠️ ${n} insumo(s) con stock crítico — ${opts.restaurantName}`,
    ``,
    `Los siguientes insumos requieren reabastecimiento urgente:`,
    ``,
    itemLines,
    ``,
    `Ámbar = stock en cero o por debajo del mínimo`,
    `Rojo  = stock negativo (requiere corrección urgente)`,
    ``,
    `Gestioná el inventario desde el panel de stock de HiChapi.`,
    ``,
    `— Equipo HiChapi`,
  ].join('\n')

  return {
    subject,
    html: baseLayout({ title: subject, preview, bodyHtml }),
    text,
  }
}
