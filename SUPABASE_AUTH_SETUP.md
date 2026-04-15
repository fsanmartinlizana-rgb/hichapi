# Configuración Supabase Auth — Crítica para emails

Sin esto, los links de invitación expiran muy rápido o se rompen.

## 1. Site URL + Redirect URLs

**Supabase Dashboard → Authentication → URL Configuration**

### Site URL
La URL canónica de tu app. **Debe ser una que funcione** (no GoDaddy parqueado).

✅ Ejemplo correcto: `https://hichapi.vercel.app`
❌ Ejemplo roto:     `https://hichapi.com` (parking de GoDaddy → links muertos)

Si querés usar tu dominio custom:
1. Apuntá `hichapi.com` a Vercel (CNAME `cname.vercel-dns.com`).
2. En Vercel → Project → Settings → Domains → agregá `hichapi.com`.
3. Una vez que el dominio responda, podés volver a usarlo como Site URL.

### Redirect URLs (allow-list)
Lista de URLs que pueden recibir el redirect post-auth. Agregá TODAS las que uses:

```
https://hichapi.vercel.app/**
https://hichapi.com/**
http://localhost:3000/**
```

(El `/**` permite cualquier path bajo ese dominio.)

## 2. Email Templates (opcional pero recomendado)

**Authentication → Email Templates**

Si tenés `RESEND_API_KEY` configurado, HiChapi usa SUS templates branded en lugar de los de Supabase. Pero si Supabase manda el email default (cuando no hay Resend), los templates de Supabase también usan el `Site URL` como base.

## 3. OTP Expiry — extender vida del link

**Authentication → Sign In / Up → Email**

- **Email OTP Expiration**: por default es **3600 segundos (1 hora)**. Subilo a `86400` (24h) para que los usuarios tengan más tiempo para hacer click.

> Esto es lo que arregla el "Email link is invalid or has expired" cuando el usuario tarda en abrir el correo.

## 4. SMTP / Email Provider

Supabase tiene un SMTP por defecto con rate limits MUY estrictos (2 emails/hora en plan Free). Para producción seria:

### Opción A — usar Resend (recomendado)
1. `RESEND_API_KEY` configurado en Vercel.
2. HiChapi usa `generateLink` (no envía email desde Supabase) y manda el email branded vía Resend.
3. Resend tiene 3.000 emails/mes gratis.

### Opción B — Custom SMTP en Supabase
**Authentication → Email → SMTP Settings** → habilitar y poner credenciales (Resend SMTP, SendGrid, Mailgun, etc.).
Esto reemplaza el SMTP default de Supabase.

## 5. Rate Limits del SMTP default

Si NO tenés Resend ni SMTP custom, Supabase usa su SMTP shared con estos límites por proyecto:
- **2 emails / hora** para signup
- **2 emails / hora** para invite
- **2 emails / hora** para magic link

Si pasás esto, los emails dejan de enviarse silenciosamente. **Usá Resend** para evitar este límite.

## Checklist de verificación

Después de configurar, andá a `tu-app/api/admin/diagnostics` (logueado) y revisá:

```json
{
  "ai":    { "any_configured": true,  ... },
  "email": { "configured": true, "provider": "resend" },
  "site":  { "url": "https://...", "env": "production" }
}
```

Si `email.configured` es `false` → te falta `RESEND_API_KEY` en Vercel.
Si `site.url` apunta a un dominio sin DNS → cambialo o sacá la env var (la app usará el origen de la request).
